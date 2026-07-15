import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { toPatientJson } from "./users.js";
import { logAudit } from "../lib/audit.js";

const router = Router();

function canAccessPatient(req, patientId) {
  return req.user.role === "admin" || req.user.role === "doctor" || req.user.uid === patientId;
}

async function createPatientAccount({ email, password, name, ic, dob, age, gender, bloodType, allergies, chronicIllnesses, height, weight, phone, emergencyContactName, emergencyContactPhone, cardUid, registeredBy }) {
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError) throw new Error(createError.message);

  const uid = created.user.id;

  const { error: profileError } = await supabase
    .from("profiles")
    .insert({ id: uid, role: "patient", name, email });
  if (profileError) throw new Error(profileError.message);

  const patientRow = {
    id: uid,
    name,
    email,
    ic: ic || "",
    dob: dob || null,
    age: age ? Number(age) : null,
    gender: gender || "",
    blood_type: bloodType || "",
    allergies: toArray(allergies),
    chronic_illnesses: toArray(chronicIllnesses),
    height: height ? Number(height) : null,
    weight: weight ? Number(weight) : null,
    phone: phone || "",
    emergency_contact_name: emergencyContactName || "",
    emergency_contact_phone: emergencyContactPhone || "",
    card_uid: cardUid || null,
    registered_by: registeredBy || null,
  };

  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .insert(patientRow)
    .select()
    .single();
  if (patientError) throw new Error(patientError.message);

  return toPatientJson(patient);
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return String(value).split(",").map((v) => v.trim()).filter(Boolean);
}

// List patients (admin/doctor only), optional ?search= by name or IC.
router.get("/", requireAuth, requireRole("admin", "doctor"), async (req, res) => {
  const search = (req.query.search || "").toString().trim();
  let query = supabase.from("patients").select("*").order("name");
  if (search) {
    query = query.or(`name.ilike.%${search}%,ic.ilike.%${search}%`);
  }
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map(toPatientJson));
});

// Manually register a new patient (admin or doctor), with no NFC card required.
router.post("/", requireAuth, requireRole("admin", "doctor"), async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: "email, password, and name are required" });
  }

  try {
    const patient = await createPatientAccount({
      ...req.body,
      registeredBy: req.user.name || req.user.email,
    });
    await logAudit(req.user, "patient.register", "patient", patient.uid, { name: patient.name, manual: true });
    res.status(201).json(patient);
  } catch (err) {
    console.error("Manual patient registration failed:", err);
    res.status(400).json({ error: err.message });
  }
});

// Get a single patient's full profile.
router.get("/:id", requireAuth, async (req, res) => {
  if (!canAccessPatient(req, req.params.id)) {
    return res.status(403).json({ error: "Insufficient permissions" });
  }
  const { data, error } = await supabase.from("patients").select("*").eq("id", req.params.id).single();
  if (error || !data) return res.status(404).json({ error: "Patient not found" });
  res.json(toPatientJson(data));
});

// Update a patient's profile (admin or doctor).
router.patch("/:id", requireAuth, requireRole("admin", "doctor"), async (req, res) => {
  const allowedMap = {
    name: "name", ic: "ic", dob: "dob", age: "age", gender: "gender", bloodType: "blood_type",
    allergies: "allergies", chronicIllnesses: "chronic_illnesses", height: "height",
    weight: "weight", phone: "phone", emergencyContactName: "emergency_contact_name",
    emergencyContactPhone: "emergency_contact_phone",
  };
  const updates = { updated_at: new Date().toISOString() };
  for (const [key, column] of Object.entries(allowedMap)) {
    if (key in req.body) updates[column] = req.body[key];
  }

  const { data, error } = await supabase
    .from("patients")
    .update(updates)
    .eq("id", req.params.id)
    .select()
    .single();
  if (error || !data) return res.status(404).json({ error: "Patient not found" });
  await logAudit(req.user, "patient.update", "patient", req.params.id, { fields: Object.keys(updates) });
  res.json(toPatientJson(data));
});

// Vitals (inpatient tracking) - list + add reading.
router.get("/:id/vitals", requireAuth, async (req, res) => {
  if (!canAccessPatient(req, req.params.id)) {
    return res.status(403).json({ error: "Insufficient permissions" });
  }
  const { data, error } = await supabase
    .from("vitals")
    .select("*")
    .eq("patient_id", req.params.id)
    .order("recorded_at", { ascending: false })
    .limit(30);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map((v) => ({ id: v.id, patientId: v.patient_id, heartRate: v.heart_rate, note: v.note, recordedAt: v.recorded_at })));
});

router.post("/:id/vitals", requireAuth, requireRole("admin", "doctor"), async (req, res) => {
  const { heartRate, note } = req.body;
  const { data, error } = await supabase
    .from("vitals")
    .insert({ patient_id: req.params.id, heart_rate: Number(heartRate), note: note || "" })
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ id: data.id, patientId: data.patient_id, heartRate: data.heart_rate, note: data.note, recordedAt: data.recorded_at });
});

export { createPatientAccount };
export default router;
