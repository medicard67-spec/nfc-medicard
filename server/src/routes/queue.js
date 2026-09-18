import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";

const router = Router();

function toJson(row) {
  return {
    id: row.id,
    patientId: row.patient_id,
    patientName: row.patient_name,
    number: row.number,
    room: row.room,
    checkedInBy: row.checked_in_by,
    createdAt: row.created_at,
  };
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
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

  const { count, error: countError } = await supabase
    .from("queue_tickets")
    .select("id", { count: "exact", head: true })
    .gte("created_at", startOfToday());
  if (countError) return res.status(500).json({ error: countError.message });

  const { data, error } = await supabase
    .from("queue_tickets")
    .insert({
      patient_id: patient.id,
      patient_name: patient.name,
      number: (count || 0) + 1,
      room,
      checked_in_by: req.user.name || req.user.email,
    })
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });

  await logAudit(req.user, "queue.checkin", "patient", patient.id, { number: data.number, room, name: patient.name });
  res.status(201).json(toJson(data));
});

// Today's queue, newest first — the registration desk's own running list.
router.get("/", requireAuth, requireRole("admin"), async (_req, res) => {
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

export default router;
