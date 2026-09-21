import { Router } from "express";
import multer from "multer";
import { supabase, MEDICAL_IMAGES_BUCKET } from "../lib/supabase.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";
import { uploadBuffer } from "../lib/upload.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

function canAccessPatient(req, patientId) {
  return req.user.role === "admin" || req.user.role === "doctor" || req.user.uid === patientId;
}

function toJson(row) {
  return {
    id: row.id,
    patientId: row.patient_id,
    diagnosis: row.diagnosis,
    date: row.date,
    physician: row.physician,
    physicianId: row.physician_id,
    physicianDepartment: row.physician_department,
    remarks: row.remarks,
    imageUrls: row.image_urls || [],
    referredToDoctorId: row.referred_to_doctor_id,
    referredToDoctorName: row.referred_to_doctor_name,
    referredToDoctorDepartment: row.referred_to_doctor_department,
    referredToDepartment: row.referred_to_department,
    createdAt: row.created_at,
  };
}

router.get("/", requireAuth, async (req, res) => {
  const { patientId } = req.query;
  if (!patientId) return res.status(400).json({ error: "patientId query param required" });
  if (!canAccessPatient(req, patientId)) {
    return res.status(403).json({ error: "Insufficient permissions" });
  }

  // Sorted by when the record was actually published (created), not the
  // editable clinical "date" field, which a doctor can backdate.
  const { data, error } = await supabase
    .from("medical_history")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map(toJson));
});

router.post(
  "/",
  requireAuth,
  requireRole("admin", "doctor"),
  upload.array("images", 6),
  async (req, res) => {
    const { patientId, diagnosis, date, remarks, referredToDoctorName, referredToDepartment } = req.body;
    if (!patientId || !diagnosis) {
      return res.status(400).json({ error: "patientId and diagnosis are required" });
    }

    const { data: submittingDoctor } = await supabase
      .from("doctors")
      .select("department")
      .eq("id", req.user.uid)
      .maybeSingle();

    // The doctor field is free-typed (not a locked dropdown), so it may not
    // match anyone in the system -- e.g. an external referral. Resolve it
    // against known doctors case-insensitively when possible, but still
    // keep the typed name either way.
    let referredDoctor = null;
    const typedDoctorName = referredToDoctorName?.trim();
    if (typedDoctorName) {
      const { data } = await supabase
        .from("doctors")
        .select("id, name, department")
        .ilike("name", typedDoctorName)
        .maybeSingle();
      referredDoctor = data || null;
    }

    const files = req.files || [];
    const imageUrls = [];
    for (const [i, file] of files.entries()) {
      const destPath = `${patientId}/${Date.now()}-${i}-${file.originalname}`;
      imageUrls.push(await uploadBuffer(MEDICAL_IMAGES_BUCKET, file.buffer, destPath, file.mimetype));
    }

    const { data, error } = await supabase
      .from("medical_history")
      .insert({
        patient_id: patientId,
        diagnosis,
        date: date || new Date().toISOString().slice(0, 10),
        physician: req.user.name || req.user.email,
        physician_id: req.user.uid,
        physician_department: submittingDoctor?.department || "General",
        remarks: remarks || "",
        image_urls: imageUrls,
        referred_to_doctor_id: referredDoctor?.id || null,
        referred_to_doctor_name: referredDoctor?.name || typedDoctorName || null,
        referred_to_doctor_department: referredDoctor?.department || null,
        referred_to_department: referredToDepartment?.trim() || null,
      })
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    await logAudit(req.user, "medical_history.create", "patient", patientId, {
      diagnosis,
      images: imageUrls.length,
      referredToDoctor: typedDoctorName || undefined,
      referredToDepartment: referredToDepartment?.trim() || undefined,
    });
    res.status(201).json(toJson(data));
  }
);

router.patch("/:id", requireAuth, requireRole("admin", "doctor"), async (req, res) => {
  const allowedMap = { diagnosis: "diagnosis", date: "date", remarks: "remarks" };
  const updates = {};
  for (const [key, column] of Object.entries(allowedMap)) {
    if (key in req.body) updates[column] = req.body[key];
  }
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No editable fields provided" });
  }

  const { data, error } = await supabase
    .from("medical_history")
    .update(updates)
    .eq("id", req.params.id)
    .select()
    .single();
  if (error || !data) return res.status(404).json({ error: "Record not found" });
  await logAudit(req.user, "medical_history.update", "patient", data.patient_id, { fields: Object.keys(updates) });
  res.json(toJson(data));
});

export default router;
