import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { malaysiaToday } from "../lib/time.js";

const TZ = "Asia/Kuala_Lumpur";
const monthKey = (d) => d.toLocaleString("en-US", { month: "short", year: "2-digit", timeZone: TZ });

const router = Router();

router.use(requireAuth, requireRole("admin"));

router.get("/stats", async (_req, res) => {
  const [patientsRes, doctorsRes, historyRes] = await Promise.all([
    supabase.from("patients").select("gender, card_uid, created_at"),
    supabase.from("doctors").select("id"),
    supabase.from("medical_history").select("created_at"),
  ]);

  if (patientsRes.error) return res.status(500).json({ error: patientsRes.error.message });
  if (doctorsRes.error) return res.status(500).json({ error: doctorsRes.error.message });
  if (historyRes.error) return res.status(500).json({ error: historyRes.error.message });

  const patients = patientsRes.data;
  const doctors = doctorsRes.data;
  const history = historyRes.data;

  // months follow Malaysian dates (the server itself runs on UTC)
  const now = new Date();
  const [year, month] = malaysiaToday().split("-").map(Number);
  const startOfMonth = new Date(`${malaysiaToday().slice(0, 7)}-01T00:00:00+08:00`);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  let newRegistrationsThisMonth = 0;
  let totalCardsIssued = 0;
  const genderDistribution = { Male: 0, Female: 0, Other: 0 };

  patients.forEach((p) => {
    const createdAt = new Date(p.created_at);
    if (createdAt >= startOfMonth) newRegistrationsThisMonth++;
    if (p.card_uid) totalCardsIssued++;
    const g = p.gender === "Male" || p.gender === "Female" ? p.gender : "Other";
    genderDistribution[g]++;
  });

  let activeTreatmentCases = 0;
  const monthBuckets = new Map();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(year, month - 1 - i, 15));
    const key = monthKey(d);
    monthBuckets.set(key, 0);
  }

  history.forEach((h) => {
    const createdAt = new Date(h.created_at);
    if (createdAt >= thirtyDaysAgo) activeTreatmentCases++;
    const key = monthKey(createdAt);
    if (monthBuckets.has(key)) monthBuckets.set(key, monthBuckets.get(key) + 1);
  });

  res.json({
    totalPatients: patients.length,
    totalDoctors: doctors.length,
    totalCardsIssued,
    newRegistrationsThisMonth,
    activeTreatmentCases,
    genderDistribution,
    hospitalAnalytics: Array.from(monthBuckets.entries()).map(([month, visits]) => ({ month, visits })),
  });
});

router.get("/reports", async (_req, res) => {
  const [doctorsRes, historyRes, patientsRes] = await Promise.all([
    supabase.from("doctors").select("*"),
    supabase.from("medical_history").select("*").order("created_at", { ascending: false }).limit(50),
    supabase.from("patients").select("id, name"),
  ]);

  if (doctorsRes.error) return res.status(500).json({ error: doctorsRes.error.message });
  if (historyRes.error) return res.status(500).json({ error: historyRes.error.message });
  if (patientsRes.error) return res.status(500).json({ error: patientsRes.error.message });

  const patientNameById = new Map(patientsRes.data.map((p) => [p.id, p.name]));

  const reports = historyRes.data.map((h) => ({
    id: h.id,
    patientId: h.patient_id,
    patientName: patientNameById.get(h.patient_id) || "Unknown",
    physician: h.physician,
    physicianId: h.physician_id,
    diagnosis: h.diagnosis,
    submittedAt: h.created_at,
  }));

  res.json({
    doctors: doctorsRes.data.map((d) => ({ uid: d.id, name: d.name, email: d.email, department: d.department, hospital: d.hospital })),
    reports,
  });
});

export default router;
