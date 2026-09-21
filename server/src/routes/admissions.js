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
    admittedBy: row.admitted_by,
    admittedById: row.admitted_by_id,
    ward: row.ward,
    reason: row.reason,
    admittedAt: row.admitted_at,
    dischargedAt: row.discharged_at,
    dischargedBy: row.discharged_by,
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
    .from("admissions")
    .select("*")
    .eq("patient_id", patientId)
    .order("admitted_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map(toJson));
});

router.post("/", requireAuth, requireRole("admin", "doctor"), async (req, res) => {
  const { patientId, ward, reason } = req.body;
  if (!patientId) return res.status(400).json({ error: "patientId is required" });

  const { data: existing } = await supabase
    .from("admissions")
    .select("id")
    .eq("patient_id", patientId)
    .is("discharged_at", null)
    .maybeSingle();
  if (existing) return res.status(409).json({ error: "Patient already has an open admission" });

  const { data, error } = await supabase
    .from("admissions")
    .insert({
      patient_id: patientId,
      admitted_by: req.user.name || req.user.email,
      admitted_by_id: req.user.uid,
      ward: ward || "",
      reason: reason || "",
    })
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  await logAudit(req.user, "admission.admit", "patient", patientId, { ward, reason });
  res.status(201).json(toJson(data));
});

router.patch("/:id/discharge", requireAuth, requireRole("admin", "doctor"), async (req, res) => {
  const { data: admission } = await supabase.from("admissions").select("*").eq("id", req.params.id).maybeSingle();
  if (!admission) return res.status(404).json({ error: "Admission not found" });
  if (admission.discharged_at) return res.status(400).json({ error: "Admission already discharged" });

  const { data, error } = await supabase
    .from("admissions")
    .update({ discharged_at: new Date().toISOString(), discharged_by: req.user.name || req.user.email })
    .eq("id", req.params.id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  await logAudit(req.user, "admission.discharge", "patient", admission.patient_id, { ward: admission.ward });
  res.json(toJson(data));
});

export default router;
