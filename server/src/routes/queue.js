import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";
import { notify } from "../lib/notify.js";
import { malaysiaNow, malaysiaDayStart } from "../lib/time.js";
import { sendDbError } from "../lib/dbError.js";

const router = Router();

function toJson(row) {
  return {
    id: row.id,
    patientId: row.patient_id,
    patientName: row.patient_name,
    number: row.number,
    room: row.room,
    checkedInBy: row.checked_in_by,
    status: row.status || "waiting",
    calledAt: row.called_at,
    calledBy: row.called_by,
    createdAt: row.created_at,
  };
}

// Today's queue starts at midnight in Malaysia (the server itself runs on UTC).
function startOfToday() {
  return malaysiaDayStart();
}

// The patient's ticket still open today (waiting or called), if any.
async function openTicket(patientId) {
  const { data } = await supabase
    .from("queue_tickets")
    .select("*")
    .eq("patient_id", patientId)
    .gte("created_at", startOfToday())
    .in("status", ["waiting", "called"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data || null;
}

// Gives a new ticket the next number for today. Two check-ins at the same
// moment could both pick the same number, so after saving it checks for a
// clash and, if this ticket was the later one, moves it to the next free number.
async function createTicket(fields) {
  const highest = async () => {
    const { data } = await supabase
      .from("queue_tickets")
      .select("number")
      .gte("created_at", startOfToday())
      .order("number", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data?.number || 0;
  };
  const number = (await highest()) + 1;
  const { data: ticket, error } = await supabase
    .from("queue_tickets")
    .insert({ ...fields, number })
    .select()
    .single();
  if (error) return { error };

  let current = ticket;
  for (let i = 0; i < 5; i++) {
    const { data: same } = await supabase
      .from("queue_tickets")
      .select("id, created_at")
      .eq("number", current.number)
      .gte("created_at", startOfToday())
      .neq("id", current.id);
    const earlier = (same || []).some((t) => t.created_at < current.created_at || (t.created_at === current.created_at && t.id < current.id));
    if (!earlier) break;
    const { data: moved } = await supabase
      .from("queue_tickets")
      .update({ number: (await highest()) + 1 })
      .eq("id", current.id)
      .select()
      .single();
    if (!moved) break;
    current = moved;
  }
  return { data: current };
}

// Registration desk: scan a card, assign the next queue number for today
// plus a room, instead of opening the patient's full record.
router.post("/", requireAuth, requireRole("admin"), async (req, res) => {
  const { patientId, room } = req.body;
  if (!patientId || !room) return res.status(400).json({ error: "patientId and room are required" });

  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .select("id, name")
    .eq("id", patientId)
    .maybeSingle();
  if (patientError) return res.status(500).json({ error: patientError.message });
  if (!patient) return res.status(404).json({ error: "Patient not found" });

  // already in today's queue: show that ticket instead of a second one
  const existing = await openTicket(patient.id);
  if (existing) return res.json({ ...toJson(existing), alreadyCheckedIn: true });

  const { data, error } = await createTicket({
    patient_id: patient.id,
    patient_name: patient.name,
    room,
    checked_in_by: req.user.name || req.user.email,
  });
  if (error) return sendDbError(res, error);

  await logAudit(req.user, "queue.checkin", "patient", patient.id, { number: data.number, room, name: patient.name });
  await notify(patient.id, "queue.checkin", { number: data.number, room }, "/patient");
  res.status(201).json(toJson(data));
});

// A patient checks themselves in by tapping their own MediCard on their
// phone. Only with an appointment today, so nobody joins a queue from home
// by accident; the ticket goes to the appointment's doctor.
router.post("/self", requireAuth, requireRole("patient"), async (req, res) => {
  const cardUid = String(req.body.cardUid || "").replace(/[\s:-]/g, "").toUpperCase();
  const { data: patient } = await supabase
    .from("patients")
    .select("id, name, card_uid, card_status")
    .eq("id", req.user.uid)
    .maybeSingle();
  if (!patient) return res.status(404).json({ error: "Patient not found" });
  if (!cardUid || patient.card_uid !== cardUid || patient.card_status === "lost") {
    return res.status(403).json({ code: "not-your-card", error: "Tap your own active MediCard to check in." });
  }

  const existing = await openTicket(patient.id);
  if (existing) return res.json({ ...toJson(existing), alreadyCheckedIn: true });

  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, doctor_name, start_time")
    .eq("patient_id", patient.id)
    .eq("date", malaysiaNow().date)
    .eq("status", "scheduled")
    .order("start_time", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!appointment) {
    return res.status(404).json({ code: "no-appointment", error: "You have no appointment today. Please go to the registration desk." });
  }

  const room = appointment.doctor_name || "Waiting area";
  const { data, error } = await createTicket({ patient_id: patient.id, patient_name: patient.name, room, checked_in_by: "Self check-in (card tap)" });
  if (error) return sendDbError(res, error);

  await logAudit(req.user, "queue.self_checkin", "patient", patient.id, { number: data.number, room, name: patient.name, cardUid });
  await notify(patient.id, "queue.checkin", { number: data.number, room }, "/patient");
  res.status(201).json(toJson(data));
});

// Today's queue, newest first — the registration desk's running list (doctors see it too).
router.get("/", requireAuth, requireRole("admin", "doctor"), async (_req, res) => {
  const { data, error } = await supabase
    .from("queue_tickets")
    .select("*")
    .gte("created_at", startOfToday())
    .order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map(toJson));
});

// The logged-in patient's own current ticket for today, if any — so their
// home page can show "You're #7 — Room 3" after being checked in.
router.get("/mine", requireAuth, requireRole("patient"), async (req, res) => {
  const { data, error } = await supabase
    .from("queue_tickets")
    .select("*")
    .eq("patient_id", req.user.uid)
    .gte("created_at", startOfToday())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data ? toJson(data) : null);
});

// Call a patient in: their ticket becomes "called" and they get a "your
// turn" notification (pop-up, sound and vibration in the app). The next
// person waiting for the same room is told they're next.
router.patch("/:id/call", requireAuth, requireRole("admin", "doctor"), async (req, res) => {
  const { data: ticket } = await supabase.from("queue_tickets").select("*").eq("id", req.params.id).maybeSingle();
  if (!ticket) return res.status(404).json({ error: "Queue ticket not found" });
  if (ticket.status === "done") return res.status(400).json({ error: "This patient has already been seen." });

  const { data, error } = await supabase
    .from("queue_tickets")
    .update({ status: "called", called_at: new Date().toISOString(), called_by: req.user.name || req.user.email })
    .eq("id", ticket.id)
    .select()
    .single();
  if (error) return sendDbError(res, error);

  await logAudit(req.user, "queue.call", "patient", ticket.patient_id, { number: ticket.number, room: ticket.room, name: ticket.patient_name });
  // a fresh notification every call, so "call again" alerts the patient again
  await notify(ticket.patient_id, "queue.called", { number: ticket.number, room: ticket.room }, "/patient");

  const { data: next } = await supabase
    .from("queue_tickets")
    .select("*")
    .eq("room", ticket.room)
    .eq("status", "waiting")
    .gte("created_at", startOfToday())
    .gt("number", ticket.number)
    .order("number", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (next) {
    await notify(next.patient_id, "queue.next", { number: next.number, room: next.room }, "/patient", `queue-next:${next.id}`);
  }
  res.json(toJson(data));
});

// Mark a patient as seen, which takes them off the waiting list.
router.patch("/:id/done", requireAuth, requireRole("admin", "doctor"), async (req, res) => {
  const { data, error } = await supabase
    .from("queue_tickets")
    .update({ status: "done" })
    .eq("id", req.params.id)
    .select()
    .maybeSingle();
  if (error) return sendDbError(res, error);
  if (!data) return res.status(404).json({ error: "Queue ticket not found" });
  res.json(toJson(data));
});

export default router;
