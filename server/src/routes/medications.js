import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";

const router = Router();

const RENEWAL_FREQUENCIES = new Set(["none", "weekly", "monthly", "quarterly", "yearly"]);

function canAccessPatient(req, patientId) {
  return req.user.role === "admin" || req.user.role === "doctor" || req.user.uid === patientId;
}

// Adds one renewal interval to a "YYYY-MM-DD" date string. Returns null for
// "none" -- a medication with no renewal cycle has no computed end date.
function addInterval(dateStr, frequency) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  switch (frequency) {
    case "weekly":
      date.setUTCDate(date.getUTCDate() + 7);
      break;
    case "monthly":
      date.setUTCMonth(date.getUTCMonth() + 1);
      break;
    case "quarterly":
      date.setUTCMonth(date.getUTCMonth() + 3);
      break;
    case "yearly":
      date.setUTCFullYear(date.getUTCFullYear() + 1);
      break;
    default:
      return null;
  }
  return date.toISOString().slice(0, 10);
}

function toJson(row) {
  return {
    id: row.id,
    patientId: row.patient_id,
    name: row.name,
    dosage: row.dosage,
    frequency: row.frequency,
    renewalFrequency: row.renewal_frequency,
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
  const { patientId, name, dosage, frequency, startDate, notes } = req.body;
  if (!patientId || !name || !dosage) {
    return res.status(400).json({ error: "patientId, name, and dosage are required" });
  }
  const renewalFrequency = RENEWAL_FREQUENCIES.has(req.body.renewalFrequency) ? req.body.renewalFrequency : "none";

  const effectiveStart = startDate || new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("medications")
    .insert({
      patient_id: patientId,
      name,
      dosage,
      frequency: frequency || "",
      renewal_frequency: renewalFrequency,
      start_date: effectiveStart,
      // A medication that renews has a real due date computed from its
      // cycle; one that doesn't stays open-ended (no end date at all).
      end_date: addInterval(effectiveStart, renewalFrequency),
      prescribed_by: req.user.name || req.user.email,
      prescribed_by_id: req.user.uid,
      notes: notes || "",
    })
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  await logAudit(req.user, "medication.add", "patient", patientId, { name, dosage, renewalFrequency });
  res.status(201).json(toJson(data));
});

// Renews a medication that's due (or overdue) for renewal, pushing its due
// date forward by one more cycle from today.
router.patch("/:id/renew", requireAuth, requireRole("admin", "doctor"), async (req, res) => {
  const { data: existing } = await supabase.from("medications").select("*").eq("id", req.params.id).maybeSingle();
  if (!existing) return res.status(404).json({ error: "Medication not found" });
  if (!existing.renewal_frequency || existing.renewal_frequency === "none") {
    return res.status(400).json({ error: "This medication has no renewal cycle to renew" });
  }

  const today = new Date().toISOString().slice(0, 10);
  const newEndDate = addInterval(today, existing.renewal_frequency);

  const { data, error } = await supabase
    .from("medications")
    .update({ end_date: newEndDate })
    .eq("id", req.params.id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  await logAudit(req.user, "medication.renew", "patient", data.patient_id, { name: data.name, newEndDate });
  res.json(toJson(data));
});

export default router;
