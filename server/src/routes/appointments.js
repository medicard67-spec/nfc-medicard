import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { malaysiaNow } from "../lib/time.js";
import { isDate } from "../lib/time.js";
import { notify } from "../lib/notify.js";
import { sendDbError } from "../lib/dbError.js";

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
    // Postgres returns "14:30:00"; the app works in "14:30". Older appointments have none.
    time: row.start_time ? row.start_time.slice(0, 5) : null,
    notes: row.notes,
    status: row.status,
    createdAt: row.created_at,
  };
}

// A doctor's own appointments across all their patients (for a calendar view).
router.get("/mine", requireAuth, requireRole("doctor"), async (req, res) => {
  const [appointmentsRes, patientsRes] = await Promise.all([
    supabase
      .from("appointments")
      .select("*")
      .eq("doctor_id", req.user.uid)
      .order("date", { ascending: true })
      .order("start_time", { ascending: true, nullsFirst: true }),
    supabase.from("patients").select("id, name"),
  ]);
  if (appointmentsRes.error) return res.status(500).json({ error: appointmentsRes.error.message });
  if (patientsRes.error) return res.status(500).json({ error: patientsRes.error.message });

  const nameById = new Map(patientsRes.data.map((p) => [p.id, p.name]));
  res.json(
    appointmentsRes.data.map((row) => ({ ...toJson(row), patientName: nameById.get(row.patient_id) || "Unknown" }))
  );
});

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
    .order("date", { ascending: true })
    .order("start_time", { ascending: true, nullsFirst: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map(toJson));
});

router.post("/", requireAuth, requireRole("admin", "doctor"), async (req, res) => {
  const { patientId, date, notes } = req.body;
  // Optional, so older app versions that only send a date keep working.
  const time = req.body.time || null;
  if (!patientId || !date) {
    return res.status(400).json({ error: "patientId and date are required" });
  }
  if (!isDate(date)) {
    return res.status(400).json({ error: "Please pick a valid date." });
  }
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    return res.status(400).json({ error: "Please pick a valid time." });
  }
  const now = malaysiaNow();
  if (date < now.date) {
    return res.status(400).json({ error: "Appointments can't be set on a past date." });
  }
  if (time && date === now.date && time < now.time) {
    return res.status(400).json({ error: "That time has already passed today." });
  }

  const { data, error } = await supabase
    .from("appointments")
    .insert({
      patient_id: patientId,
      doctor_id: req.user.role === "doctor" ? req.user.uid : null,
      doctor_name: req.user.name || req.user.email,
      date,
      start_time: time,
      notes: notes || "",
      status: "scheduled",
    })
    .select()
    .single();
  if (error) return sendDbError(res, error);
  await notify(patientId, "appointment.booked", { doctor: req.user.name || req.user.email, date, time }, "/patient/appointments");
  res.status(201).json(toJson(data));
});

export default router;
