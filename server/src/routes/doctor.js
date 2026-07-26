import { Router } from "express";
import multer from "multer";
import { supabase, AVATARS_BUCKET } from "../lib/supabase.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { uploadBuffer } from "../lib/upload.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.use(requireAuth, requireRole("doctor"));

// Upload/replace the logged-in doctor's own profile picture.
router.post("/avatar", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "file is required" });
  if (!req.file.mimetype.startsWith("image/")) {
    return res.status(400).json({ error: "File must be an image" });
  }

  const doctorId = req.user.uid;
  const destPath = `${doctorId}/avatar-${Date.now()}-${req.file.originalname}`;
  const avatarUrl = await uploadBuffer(AVATARS_BUCKET, req.file.buffer, destPath, req.file.mimetype);

  const { data, error } = await supabase
    .from("doctors")
    .update({ avatar_url: avatarUrl })
    .eq("id", doctorId)
    .select()
    .single();
  if (error || !data) return res.status(404).json({ error: "Doctor not found" });
  res.json({ department: data.department, avatarUrl: data.avatar_url });
});

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
