import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth, requireRole("doctor"));

router.get("/stats", async (req, res) => {
  const doctorId = req.user.uid;

  const [historyRes, appointmentsRes] = await Promise.all([
    supabase.from("medical_history").select("patient_id, created_at").eq("physician_id", doctorId),
    supabase.from("appointments").select("id, date").eq("doctor_id", doctorId),
  ]);

  if (historyRes.error) return res.status(500).json({ error: historyRes.error.message });
  if (appointmentsRes.error) return res.status(500).json({ error: appointmentsRes.error.message });

  const history = historyRes.data;
  const appointments = appointmentsRes.data;

  const myPatientCount = new Set(history.map((h) => h.patient_id)).size;

  const today = new Date().toISOString().slice(0, 10);
  const upcomingAppointments = appointments.filter((a) => a.date >= today).length;

  const now = new Date();
  const weekBuckets = new Map();
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    weekBuckets.set(key, 0);
  }
  const weekKeys = Array.from(weekBuckets.keys());

  history.forEach((h) => {
    const createdAt = new Date(h.created_at);
    const weeksAgo = Math.floor((now - createdAt) / (7 * 24 * 60 * 60 * 1000));
    const idx = 7 - weeksAgo;
    if (idx >= 0 && idx < weekKeys.length) {
      const key = weekKeys[idx];
      weekBuckets.set(key, weekBuckets.get(key) + 1);
    }
  });

  res.json({
    myPatientCount,
    totalRecordsLogged: history.length,
    upcomingAppointments,
    weeklyActivity: Array.from(weekBuckets.entries()).map(([week, records]) => ({ week, records })),
  });
});

export default router;
