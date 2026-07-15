import { Router } from "express";
import multer from "multer";
import { supabase, LAB_RESULTS_BUCKET } from "../lib/supabase.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { uploadBuffer } from "../lib/upload.js";
import { logAudit } from "../lib/audit.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

function canAccessPatient(req, patientId) {
  return req.user.role === "admin" || req.user.role === "doctor" || req.user.uid === patientId;
}

function toJson(row) {
  return {
    id: row.id,
    patientId: row.patient_id,
    testName: row.test_name,
    physician: row.physician,
    physicianId: row.physician_id,
    date: row.date,
    flagged: row.flagged,
    fileUrl: row.file_url,
    fileName: row.file_name,
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
    .from("lab_results")
    .select("*")
    .eq("patient_id", patientId)
    .order("date", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map(toJson));
});

router.post(
  "/",
  requireAuth,
  requireRole("admin", "doctor"),
  upload.single("file"),
  async (req, res) => {
    const { patientId, testName, date, flagged } = req.body;
    if (!patientId || !testName) {
      return res.status(400).json({ error: "patientId and testName are required" });
    }

    let fileUrl = null;
    let fileName = null;
    if (req.file) {
      fileName = req.file.originalname;
      const destPath = `${patientId}/${Date.now()}-${fileName}`;
      fileUrl = await uploadBuffer(LAB_RESULTS_BUCKET, req.file.buffer, destPath, req.file.mimetype);
    }

    const { data, error } = await supabase
      .from("lab_results")
      .insert({
        patient_id: patientId,
        test_name: testName,
        physician: req.user.name || req.user.email,
        physician_id: req.user.uid,
        date: date || new Date().toISOString().slice(0, 10),
        flagged: flagged === "true" || flagged === true,
        file_url: fileUrl,
        file_name: fileName,
      })
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    await logAudit(req.user, "lab_result.create", "patient", patientId, { testName });
    res.status(201).json(toJson(data));
  }
);

export default router;
