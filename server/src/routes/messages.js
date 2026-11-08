import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

function canAccessPatient(req, patientId) {
  return req.user.role === "admin" || req.user.role === "doctor" || req.user.uid === patientId;
}

function toJson(row) {
  return {
    id: row.id,
    patientId: row.patient_id,
    doctorId: row.doctor_id,
    senderRole: row.sender_role,
    senderName: row.sender_name,
    text: row.text,
    read: row.read,
    createdAt: row.created_at,
  };
}

// Messages a doctor should see: ones to or from them, plus patient messages to
// the "care team" that aren't addressed to any one doctor.
function doctorFilter(uid) {
  return `doctor_id.eq.${uid},and(doctor_id.is.null,sender_role.eq.patient)`;
}

// Unread count for the badge in the nav. Patients see unread messages sent to
// them by doctors; doctors see unread messages sent to them by patients.
router.get("/unread-count", requireAuth, async (req, res) => {
  const { role, uid } = req.user;
  if (role === "admin") return res.json({ count: 0 });

  let query = supabase.from("messages").select("id", { count: "exact", head: true }).eq("read", false);
  query =
    role === "patient"
      ? query.eq("patient_id", uid).eq("sender_role", "doctor")
      : query.eq("sender_role", "patient").or(doctorFilter(uid));

  const { count, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ count: count || 0 });
});

// A doctor's conversations, one per patient, newest first: the last message
// and how many of the patient's messages are still unread.
router.get("/inbox", requireAuth, requireRole("doctor"), async (req, res) => {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .or(doctorFilter(req.user.uid))
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return res.status(500).json({ error: error.message });

  const threads = new Map();
  for (const row of data) {
    if (!threads.has(row.patient_id)) {
      threads.set(row.patient_id, { patientId: row.patient_id, lastMessage: toJson(row), unread: 0 });
    }
    if (row.sender_role === "patient" && !row.read) threads.get(row.patient_id).unread += 1;
  }

  const ids = [...threads.keys()];
  if (ids.length) {
    const { data: patients, error: patientsError } = await supabase
      .from("patients")
      .select("id, name, avatar_url")
      .in("id", ids);
    if (patientsError) return res.status(500).json({ error: patientsError.message });
    for (const p of patients) {
      Object.assign(threads.get(p.id), { patientName: p.name, avatarUrl: p.avatar_url });
    }
  }
  res.json([...threads.values()].map((th) => ({ patientName: "Unknown", avatarUrl: null, ...th })));
});

router.get("/", requireAuth, async (req, res) => {
  const { patientId } = req.query;
  if (!patientId) return res.status(400).json({ error: "patientId query param required" });
  if (!canAccessPatient(req, patientId)) {
    return res.status(403).json({ error: "Insufficient permissions" });
  }

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map(toJson));
});

// Mark the other party's messages in this thread as read.
router.post("/mark-read", requireAuth, async (req, res) => {
  const { patientId } = req.body;
  if (!patientId) return res.status(400).json({ error: "patientId is required" });
  if (!canAccessPatient(req, patientId)) {
    return res.status(403).json({ error: "Insufficient permissions" });
  }

  const otherRole = req.user.role === "patient" ? "doctor" : "patient";
  const { error } = await supabase
    .from("messages")
    .update({ read: true })
    .eq("patient_id", patientId)
    .eq("sender_role", otherRole)
    .eq("read", false);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

router.post("/", requireAuth, async (req, res) => {
  const { patientId, doctorId, text } = req.body;
  if (!patientId || !text) {
    return res.status(400).json({ error: "patientId and text are required" });
  }
  if (!canAccessPatient(req, patientId)) {
    return res.status(403).json({ error: "Insufficient permissions" });
  }

  // A patient's reply goes to the doctor who last messaged them, so it shows
  // in that doctor's inbox and unread badge.
  let toDoctor = req.user.role === "doctor" ? req.user.uid : doctorId || null;
  if (req.user.role === "patient" && !toDoctor) {
    const { data: last } = await supabase
      .from("messages")
      .select("doctor_id")
      .eq("patient_id", patientId)
      .eq("sender_role", "doctor")
      .not("doctor_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    toDoctor = last?.doctor_id || null;
  }

  const { data, error } = await supabase
    .from("messages")
    .insert({
      patient_id: patientId,
      doctor_id: toDoctor,
      sender_role: req.user.role,
      sender_name: req.user.name || req.user.email,
      text,
    })
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(toJson(data));
});

export default router;
