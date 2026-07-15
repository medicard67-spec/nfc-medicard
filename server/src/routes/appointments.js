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
    doctorName: row.doctor_name,
    date: row.date,
    notes: row.notes,
    status: row.status,
    createdAt: row.created_at,
  };
}

router.get("/", requireAuth, async (req, res) => {
  const { patientId } = req.query;
  if (!patientId) return res.status(400).json({ error: "patientId query param required" });
  if (!canAccessPatient(req, patientId)) {
    return res.status(403).json({ error: "Insufficient permissions" });
  }

  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("patient_id", patientId)
    .order("date", { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map(toJson));
});

router.post("/", requireAuth, requireRole("admin", "doctor"), async (req, res) => {
  const { patientId, date, notes } = req.body;
  if (!patientId || !date) {
    return res.status(400).json({ error: "patientId and date are required" });
  }

  const { data, error } = await supabase
    .from("appointments")
    .insert({
      patient_id: patientId,
      doctor_id: req.user.role === "doctor" ? req.user.uid : null,
      doctor_name: req.user.name || req.user.email,
      date,
      notes: notes || "",
      status: "scheduled",
    })
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(toJson(data));
});

export default router;
