import { Router } from "express";
import multer from "multer";
import { supabase, RADIOLOGY_BUCKET } from "../lib/supabase.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { uploadBuffer } from "../lib/upload.js";
import { logAudit } from "../lib/audit.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

function canAccessPatient(req, patientId) {
  return req.user.role === "admin" || req.user.role === "doctor" || req.user.uid === patientId;
}

function toJson(row) {
  return {
    id: row.id,
    patientId: row.patient_id,
    type: row.type,
    anatomy: row.anatomy,
    classification: row.classification,
    fileUrl: row.file_url,
    fileName: row.file_name,
    uploadedBy: row.uploaded_by,
    uploadedAt: row.uploaded_at,
  };
}

router.get("/", requireAuth, async (req, res) => {
  const { patientId } = req.query;
  if (!patientId) return res.status(400).json({ error: "patientId query param required" });
  if (!canAccessPatient(req, patientId)) {
    return res.status(403).json({ error: "Insufficient permissions" });
  }

  const { data, error } = await supabase
    .from("radiology")
    .select("*")
    .eq("patient_id", patientId)
    .order("uploaded_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map(toJson));
});

router.post(
  "/",
  requireAuth,
  requireRole("admin", "doctor"),
  upload.single("file"),
  async (req, res) => {
    const { patientId, type, anatomy, classification } = req.body;
    if (!patientId || !type || !req.file) {
      return res.status(400).json({ error: "patientId, type, and file are required" });
    }

    const destPath = `${patientId}/${Date.now()}-${req.file.originalname}`;
    const fileUrl = await uploadBuffer(RADIOLOGY_BUCKET, req.file.buffer, destPath, req.file.mimetype);

    const { data, error } = await supabase
      .from("radiology")
      .insert({
        patient_id: patientId,
        type,
        anatomy: anatomy || "",
        classification: classification || "",
        file_url: fileUrl,
        file_name: req.file.originalname,
        uploaded_by: req.user.name || req.user.email,
      })
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    await logAudit(req.user, "radiology.create", "patient", patientId, { type });
    res.status(201).json(toJson(data));
  }
);

export default router;
