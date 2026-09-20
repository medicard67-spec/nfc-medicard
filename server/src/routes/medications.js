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
    name: row.name,
    dosage: row.dosage,
    frequency: row.frequency,
    startDate: row.start_date,
    endDate: row.end_date,
    prescribedBy: row.prescribed_by,
    prescribedById: row.prescribed_by_id,
    notes: row.notes,
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
    .from("medications")
    .select("*")
    .eq("patient_id", patientId)
    .order("start_date", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map(toJson));
});

router.post("/", requireAuth, requireRole("admin", "doctor"), async (req, res) => {
  const { patientId, name, dosage, frequency, startDate, endDate, notes } = req.body;
  if (!patientId || !name || !dosage) {
    return res.status(400).json({ error: "patientId, name, and dosage are required" });
  }

  const { data, error } = await supabase
    .from("medications")
    .insert({
      patient_id: patientId,
      name,
      dosage,
      frequency: frequency || "",
      start_date: startDate || new Date().toISOString().slice(0, 10),
      end_date: endDate || null,
      prescribed_by: req.user.name || req.user.email,
      prescribed_by_id: req.user.uid,
      notes: notes || "",
    })
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  await logAudit(req.user, "medication.add", "patient", patientId, { name, dosage });
  res.status(201).json(toJson(data));
});

// Mark a current medication as stopped, moving it into "past".
router.patch("/:id/discontinue", requireAuth, requireRole("admin", "doctor"), async (req, res) => {
  const endDate = req.body.endDate || new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("medications")
    .update({ end_date: endDate })
    .eq("id", req.params.id)
    .select()
    .single();
  if (error || !data) return res.status(404).json({ error: "Medication not found" });
  await logAudit(req.user, "medication.discontinue", "patient", data.patient_id, { name: data.name });
  res.json(toJson(data));
});

export default router;
