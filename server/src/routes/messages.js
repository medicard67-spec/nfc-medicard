import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { requireAuth } from "../middleware/auth.js";

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

// Unread count for the badge in the nav. Patients see unread messages sent to
// them by doctors; doctors see unread messages sent to them by patients.
router.get("/unread-count", requireAuth, async (req, res) => {
  const { role, uid } = req.user;
  if (role === "admin") return res.json({ count: 0 });

  let query = supabase.from("messages").select("id", { count: "exact", head: true }).eq("read", false);
  query =
    role === "patient"
      ? query.eq("patient_id", uid).eq("sender_role", "doctor")
      : query.eq("doctor_id", uid).eq("sender_role", "patient");

  const { count, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ count: count || 0 });
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

  const { data, error } = await supabase
    .from("messages")
    .insert({
      patient_id: patientId,
      doctor_id: req.user.role === "doctor" ? req.user.uid : doctorId || null,
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
