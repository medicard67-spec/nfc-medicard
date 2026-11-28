import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";
import { malaysiaToday } from "../lib/time.js";

const router = Router();

const RENEWAL_FREQUENCIES = new Set(["none", "weekly", "monthly", "quarterly", "yearly"]);

function canAccessPatient(req, patientId) {
  return req.user.role === "admin" || req.user.role === "doctor" || req.user.uid === patientId;
}

// Adds one renewal interval to a "YYYY-MM-DD" date string. Returns null for
// "none" -- a medication with no renewal cycle has no computed end date.
// Months are added "calendar style": 31 Jan + 1 month is 28 (or 29) Feb, not
// 3 Mar, and 29 Feb + 1 year is 28 Feb.
export function addInterval(dateStr, frequency) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const months = { monthly: 1, quarterly: 3, yearly: 12 }[frequency];
  if (frequency === "weekly") {
    const date = new Date(Date.UTC(y, m - 1, d + 7));
    return date.toISOString().slice(0, 10);
  }
  if (!months) return null;
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

// A real calendar date written "YYYY-MM-DD" (rejects "2026-02-30" and typos).
export function isDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
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

  if (startDate && !isDate(startDate)) return res.status(400).json({ error: "Please pick a valid start date." });
  const effectiveStart = startDate || malaysiaToday();

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

  const today = malaysiaToday();
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
