import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";

const router = Router();

function canAccessPatient(req, patientId) {
  return req.user.role === "admin" || req.user.role === "doctor" || req.user.uid === patientId;
}

function toJson(row) {
  return {
    id: row.id,
    patientId: row.patient_id,
    diagnosis: row.diagnosis,
    date: row.date,
    physician: row.physician,
    physicianId: row.physician_id,
    remarks: row.remarks,
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
    .from("medical_history")
    .select("*")
    .eq("patient_id", patientId)
    .order("date", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map(toJson));
});

router.post("/", requireAuth, requireRole("admin", "doctor"), async (req, res) => {
  const { patientId, diagnosis, date, remarks } = req.body;
  if (!patientId || !diagnosis) {
    return res.status(400).json({ error: "patientId and diagnosis are required" });
  }

  const { data, error } = await supabase
    .from("medical_history")
    .insert({
      patient_id: patientId,
      diagnosis,
      date: date || new Date().toISOString().slice(0, 10),
      physician: req.user.name || req.user.email,
      physician_id: req.user.uid,
      remarks: remarks || "",
    })
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  await logAudit(req.user, "medical_history.create", "patient", patientId, { diagnosis });
  res.status(201).json(toJson(data));
});

export default router;
