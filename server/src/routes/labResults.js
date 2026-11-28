import { Router } from "express";
import multer from "multer";
import { supabase, LAB_RESULTS_BUCKET } from "../lib/supabase.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { uploadBuffer, signFileUrl, fileNameOf } from "../lib/upload.js";
import { malaysiaToday } from "../lib/time.js";
import { isDate } from "./medications.js";
import { logAudit } from "../lib/audit.js";
import { notify, careTeamIds, patientName } from "../lib/notify.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

function canAccessPatient(req, patientId) {
  return req.user.role === "admin" || req.user.role === "doctor" || req.user.uid === patientId;
}

async function toSignedJson(row) {
  return { ...toJson(row), fileUrl: await signFileUrl(row.file_url) };
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
  res.json(await Promise.all(data.map(toSignedJson)));
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
    if (date && !isDate(date)) return res.status(400).json({ error: "Please pick a valid date." });

    let fileUrl = null;
    let fileName = null;
    if (req.file) {
      fileName = fileNameOf(req.file);
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
        date: date || malaysiaToday(),
        flagged: flagged === "true" || flagged === true,
        file_url: fileUrl,
        file_name: fileName,
      })
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    await logAudit(req.user, "lab_result.create", "patient", patientId, { testName });
    await notify(patientId, "lab.new", { test: testName, flagged: data.flagged }, "/patient/labs");
    if (data.flagged) {
      // an abnormal result goes to every doctor treating this patient, not only the one who added it
      const team = (await careTeamIds(patientId)).filter((id) => id !== req.user.uid);
      await notify(team, "lab.abnormal", { patient: await patientName(patientId), test: testName, by: req.user.name || req.user.email },
        `/doctor/patient/${patientId}?tab=Lab%20Results`);
    }
    res.status(201).json(await toSignedJson(data));
  }
);

export default router;
