import { Router } from "express";
import multer from "multer";
import { supabase, AVATARS_BUCKET } from "../lib/supabase.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { toPatientJson } from "./users.js";
import { logAudit } from "../lib/audit.js";
import { notify, adminIds } from "../lib/notify.js";
import { uploadBuffer } from "../lib/upload.js";
import { getClientOrigin } from "../lib/env.js";
import { isPhoneToken, normalizeUid } from "../lib/onlineCard.js";
import { isDate } from "../lib/time.js";
import { sendDbError } from "../lib/dbError.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

function canAccessPatient(req, patientId) {
  return req.user.role === "admin" || req.user.role === "doctor" || req.user.uid === patientId;
}

async function createPatientAccount({ email, password, name, ic, dob, age, gender, bloodType, allergies, chronicIllnesses, height, weight, phone, emergencyContactName, emergencyContactPhone, cardUid, registeredBy }) {
  name = icName(name);
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
  });
  if (createError) throw new Error(createError.message);

  const uid = created.user.id;
  try {
    return await finishPatientAccount(uid, { email, name, ic, dob, age, gender, bloodType, allergies, chronicIllnesses, height, weight, phone, emergencyContactName, emergencyContactPhone, cardUid, registeredBy });
  } catch (err) {
    // don't leave a login behind with no profile: undo the whole account
    await supabase.from("patients").delete().eq("id", uid);
    await supabase.from("profiles").delete().eq("id", uid);
    await supabase.auth.admin.deleteUser(uid).catch(() => {});
    throw err;
  }
}

async function finishPatientAccount(uid, { email, name, ic, dob, age, gender, bloodType, allergies, chronicIllnesses, height, weight, phone, emergencyContactName, emergencyContactPhone, cardUid, registeredBy }) {
  // admin.createUser() does not itself send an email; trigger Supabase's
  // built-in "confirm signup" email so the patient must verify before login.
  supabase.auth
    .resend({ type: "signup", email, options: { emailRedirectTo: getClientOrigin() } })
    .catch((err) => {
      console.error("Failed to send verification email:", err.message);
    });

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

// Patient names are kept in capital letters, exactly as on the IC.
export function icName(name) {
  return String(name || "").replace(/\s+/g, " ").trim().toUpperCase();
}

// Why a card UID can't be given to a patient, or null when it can.
export async function cardUidProblem(cardUid) {
  if (isPhoneToken(cardUid)) return { status: 400, error: "That was a phone, not a MediCard. Tap the physical card instead." };
  const { data: existingCard } = await supabase.from("patients").select("id").eq("card_uid", cardUid).maybeSingle();
  if (existingCard) return { status: 409, error: "This card UID is already registered." };
  const { data: retiredCard } = await supabase.from("retired_cards").select("card_uid").eq("card_uid", cardUid).maybeSingle();
  if (retiredCard) return { status: 409, error: "This card was replaced before and can't be used again." };
  return null;
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
  // characters that would change the meaning of the filter itself are dropped
  const term = search.replace(/[,()"\\*%]/g, " ").replace(/\s+/g, " ").trim();
  if (term) {
    query = query.or(`name.ilike.%${term}%,ic.ilike.%${term}%`);
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
  if (String(password).length < 6) return res.status(400).json({ error: "The password must be at least 6 characters." });
  if (req.body.cardUid) req.body.cardUid = normalizeUid(req.body.cardUid);
  if (req.body.cardUid) {
    const problem = await cardUidProblem(req.body.cardUid);
    if (problem) return res.status(problem.status).json({ error: problem.error });
  }

  try {
    const patient = await createPatientAccount({
      ...req.body,
      registeredBy: req.user.name || req.user.email,
    });
    await logAudit(req.user, "patient.register", "patient", patient.uid, { name: patient.name, manual: true });
    if (req.user.role === "doctor") {
      // a doctor registered them without a card: the admins can issue one
      await notify(await adminIds(), "patient.registered", { patient: patient.name, by: req.user.name || req.user.email }, "/admin/patients");
    }
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

// Update a patient's profile. Admins/doctors can edit the full clinical
// record; a patient may only update their own contact details, not
// anything clinical or identity-related (name, IC, blood type, etc.).
router.patch("/:id", requireAuth, async (req, res) => {
  const isSelf = req.user.role === "patient" && req.user.uid === req.params.id;
  if (!isSelf && req.user.role !== "admin" && req.user.role !== "doctor") {
    return res.status(403).json({ error: "Insufficient permissions" });
  }

  const allowedMap = isSelf
    ? { phone: "phone", emergencyContactName: "emergency_contact_name", emergencyContactPhone: "emergency_contact_phone" }
    : {
        name: "name", ic: "ic", dob: "dob", age: "age", gender: "gender", bloodType: "blood_type",
        allergies: "allergies", chronicIllnesses: "chronic_illnesses", height: "height",
        weight: "weight", phone: "phone", emergencyContactName: "emergency_contact_name",
        emergencyContactPhone: "emergency_contact_phone",
      };
  const updates = { updated_at: new Date().toISOString() };
  for (const [key, column] of Object.entries(allowedMap)) {
    if (key in req.body) updates[column] = req.body[key];
  }
  // numbers and dates must really be numbers and dates (empty clears them)
  for (const [col, max] of [["age", 150], ["height", 300], ["weight", 500]]) {
    if (col in updates && updates[col] !== null && updates[col] !== "") {
      const n = Number(updates[col]);
      if (!Number.isFinite(n) || n <= 0 || n > max) return res.status(400).json({ error: `Please enter a valid ${col}.` });
      updates[col] = n;
    } else if (col in updates) updates[col] = null;
  }
  if ("dob" in updates && updates.dob && !isDate(updates.dob)) return res.status(400).json({ error: "Please pick a valid date of birth." });
  if ("name" in updates) {
    updates.name = icName(updates.name);
    if (!updates.name) return res.status(400).json({ error: "Name can't be empty." });
  }

  const { data, error } = await supabase
    .from("patients")
    .update(updates)
    .eq("id", req.params.id)
    .select()
    .single();
  if (error || !data) return res.status(404).json({ error: "Patient not found" });
  // the login profile carries the name too (shown on messages and the top bar)
  if ("name" in updates) await supabase.from("profiles").update({ name: updates.name }).eq("id", req.params.id);
  await logAudit(req.user, "patient.update", "patient", req.params.id, { fields: Object.keys(updates) });
  res.json(toPatientJson(data));
});

// Bind an unused card UID to an EXISTING patient who doesn't have one yet.
// "Register New Card" (POST /nfc/register) only ever creates a brand-new
// account, so a patient added earlier without a card (e.g. via "Add
// Patient") has no way to receive one later without this.
router.post("/:id/card", requireAuth, requireRole("admin"), async (req, res) => {
  const cardUid = normalizeUid(req.body.cardUid);
  if (!cardUid) return res.status(400).json({ error: "cardUid is required" });

  const { data: patient } = await supabase.from("patients").select("id, name, card_uid, card_status").eq("id", req.params.id).maybeSingle();
  if (!patient) return res.status(404).json({ error: "Patient not found" });
  // a card reported lost can be replaced; an active one can't be overwritten
  const replacing = patient.card_uid && patient.card_status === "lost" ? patient.card_uid : null;
  if (patient.card_uid && !replacing) return res.status(409).json({ error: "This patient already has a card assigned." });
  const problem = await cardUidProblem(cardUid);
  if (problem) return res.status(problem.status).json({ error: problem.error });

  if (replacing) {
    await supabase.from("retired_cards").upsert({ card_uid: replacing, patient_id: patient.id, reason: "lost" });
  }
  const { data, error } = await supabase
    .from("patients")
    .update({
      card_uid: cardUid,
      updated_at: new Date().toISOString(),
      ...(replacing ? { card_status: "active", card_lost_at: null } : {}),
    })
    .eq("id", req.params.id)
    .select()
    .single();
  if (error || !data) return res.status(404).json({ error: "Patient not found" });
  await logAudit(req.user, "nfc.register", "patient", data.id, { cardUid, name: data.name, existingPatient: true, replaced: replacing });
  res.json(toPatientJson(data));
});

// Upload/replace a patient's profile picture. Patients may upload their own;
// admin/doctor may also set one on a patient's behalf.
router.post("/:id/avatar", requireAuth, upload.single("file"), async (req, res) => {
  if (!canAccessPatient(req, req.params.id)) {
    return res.status(403).json({ error: "Insufficient permissions" });
  }
  if (!req.file) return res.status(400).json({ error: "file is required" });
  if (!req.file.mimetype.startsWith("image/")) {
    return res.status(400).json({ error: "File must be an image" });
  }

  const destPath = `${req.params.id}/avatar-${Date.now()}-${req.file.originalname}`;
  const avatarUrl = await uploadBuffer(AVATARS_BUCKET, req.file.buffer, destPath, req.file.mimetype);

  const { data, error } = await supabase
    .from("patients")
    .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
    .eq("id", req.params.id)
    .select()
    .single();
  if (error || !data) return res.status(404).json({ error: "Patient not found" });
  await logAudit(req.user, "patient.avatar_update", "patient", req.params.id, {});
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
  const bpm = Number(heartRate);
  if (!Number.isFinite(bpm) || bpm <= 0 || bpm > 300) return res.status(400).json({ error: "Enter a heart rate between 1 and 300." });
  const { data, error } = await supabase
    .from("vitals")
    .insert({ patient_id: req.params.id, heart_rate: Math.round(bpm), note: note || "" })
    .select()
    .single();
  if (error) return sendDbError(res, error);
  res.status(201).json({ id: data.id, patientId: data.patient_id, heartRate: data.heart_rate, note: data.note, recordedAt: data.recorded_at });
});

export { createPatientAccount };
export default router;
