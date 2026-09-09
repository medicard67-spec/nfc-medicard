// Fully self-contained, offline-capable copy of the MediCard API + frontend,
// for use as a presentation backup when there's no internet in the room.
//
// - No Supabase, no external network calls of any kind — everything lives in
//   an in-memory dataset seeded to match `npm run seed`'s real demo data.
// - Serves both the built frontend (client/dist-offline) AND the API on one
//   port, so running the whole demo is just: node server/offline-server.js
// - Auth is a simple base64 token (not real JWT security) — this file is for
//   a local, offline demo only. Never deploy this; it has no real security.
//
// Usage:
//   cd client && npm run build:offline   (builds dist-offline pointed at this server)
//   cd server && node offline-server.js
//   open http://localhost:4444
import express from "express";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.OFFLINE_PORT || 4444;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// ---------------------------------------------------------------------------
// In-memory dataset — mirrors server/src/seed.js so the offline demo shows
// the same familiar accounts and records as the live site.
// ---------------------------------------------------------------------------
const now = () => new Date().toISOString();
const uid = (prefix) => `${prefix}-${crypto.randomBytes(4).toString("hex")}`;

const db = {
  profiles: [
    { id: "admin-1", role: "admin", name: "System Administrator", email: "admin@medicard.dev" },
    { id: "doctor-1", role: "doctor", name: "Dr. Sarah Jenkins", email: "doctor@medicard.dev" },
    { id: "doctor-2", role: "doctor", name: "Dr. Robert Chan", email: "doctor2@medicard.dev" },
    { id: "patient-1", role: "patient", name: "Ahmad Faiz Bin Rahman", email: "patient@medicard.dev" },
    { id: "patient-2", role: "patient", name: "Nur Aisyah Binti Kamal", email: "patient2@medicard.dev" },
  ],
  passwords: {
    "admin@medicard.dev": "password123",
    "doctor@medicard.dev": "password123",
    "doctor2@medicard.dev": "password123",
    "patient@medicard.dev": "password123",
    "patient2@medicard.dev": "password123",
  },
  doctors: [
    { id: "doctor-1", name: "Dr. Sarah Jenkins", email: "doctor@medicard.dev", department: "Cardiology", hospital: "Hospital Kuala Lumpur (HKL)", avatar_url: null },
    { id: "doctor-2", name: "Dr. Robert Chan", email: "doctor2@medicard.dev", department: "Endocrinology", hospital: "Gleneagles Kuala Lumpur", avatar_url: null },
  ],
  patients: [
    {
      id: "patient-1", name: "Ahmad Faiz Bin Rahman", email: "patient@medicard.dev",
      ic: "010203-14-1234", dob: "2001-02-03", age: 25, gender: "Male", blood_type: "O+",
      allergies: ["Penicillin", "Peanuts"], chronic_illnesses: ["Type 2 Diabetes"],
      height: 172, weight: 68, phone: "012-3456789",
      emergency_contact_name: "Rahman Bin Ismail", emergency_contact_phone: "013-9876543",
      card_uid: "04A3B2C1", avatar_url: null, created_at: "2026-06-01T02:00:00.000Z",
    },
    {
      id: "patient-2", name: "Nur Aisyah Binti Kamal", email: "patient2@medicard.dev",
      ic: "980512-10-5678", dob: "1998-05-12", age: 28, gender: "Female", blood_type: "A-",
      allergies: ["Sulfa drugs"], chronic_illnesses: [],
      height: 160, weight: 55, phone: "019-2223344",
      emergency_contact_name: "Kamal Bin Yusof", emergency_contact_phone: "017-5556677",
      card_uid: "07D8E9F0", avatar_url: null, created_at: "2026-06-05T02:00:00.000Z",
    },
  ],
  medical_history: [
    { id: "hist-1", patient_id: "patient-1", diagnosis: "Routine diabetes follow-up", date: "2026-06-02", physician: "Dr. Sarah Jenkins", physician_id: "doctor-1", remarks: "Blood sugar stable. Continue current medication.", image_urls: [], created_at: "2026-06-02T03:00:00.000Z" },
    { id: "hist-2", patient_id: "patient-1", diagnosis: "Seasonal allergic rhinitis", date: "2026-03-15", physician: "Dr. Robert Chan", physician_id: "doctor-2", remarks: "Prescribed antihistamines for 2 weeks.", image_urls: [], created_at: "2026-03-15T03:00:00.000Z" },
  ],
  lab_results: [
    { id: "lab-1", patient_id: "patient-1", test_name: "HbA1c (Blood Sugar Panel)", physician: "Dr. Sarah Jenkins", physician_id: "doctor-1", date: "2026-06-02", flagged: false, file_url: null, file_name: null, created_at: "2026-06-02T03:05:00.000Z" },
  ],
  radiology: [],
  messages: [
    { id: "msg-1", patient_id: "patient-1", doctor_id: "doctor-1", sender_role: "doctor", sender_name: "Dr. Sarah Jenkins", text: "Your latest lab results look good. Keep up with your medication schedule.", read: false, created_at: "2026-06-02T04:00:00.000Z" },
  ],
  appointments: [
    { id: "appt-1", patient_id: "patient-1", doctor_id: "doctor-1", doctor_name: "Dr. Sarah Jenkins", date: "2026-08-10", notes: "3-month diabetes review", status: "scheduled", created_at: "2026-06-02T04:00:00.000Z" },
  ],
  vitals: [
    { id: "vital-1", patient_id: "patient-1", heart_rate: 78, note: "Resting, ward round", recorded_at: "2026-06-02T04:00:00.000Z" },
  ],
  audit_log: [],
};

function findUserByUid(u) {
  return db.profiles.find((p) => p.id === u);
}
function findUserByEmail(email) {
  return db.profiles.find((p) => p.email === email);
}

// ---------------------------------------------------------------------------
// Audit trail — mirrors server/src/lib/audit.js, including the doctor's
// hospital being tagged onto every doctor-initiated entry.
// ---------------------------------------------------------------------------
function logAudit(user, action, targetType, targetId, details = null) {
  let mergedDetails = details;
  if (user.role === "doctor") {
    const doctor = db.doctors.find((d) => d.id === user.uid);
    if (doctor?.hospital) mergedDetails = { ...(details || {}), hospital: doctor.hospital };
  }
  db.audit_log.unshift({
    id: uid("audit"),
    actor_id: user.uid,
    actor_name: user.name || user.email,
    actor_role: user.role,
    action,
    target_type: targetType,
    target_id: targetId ? String(targetId) : null,
    details: mergedDetails,
    created_at: now(),
  });
}

// Seed a bit of realistic-looking history so the Audit Log isn't empty on first run.
logAudit({ uid: "admin-1", role: "admin", name: "System Administrator" }, "patient.register", "patient", "patient-1", { name: "Ahmad Faiz Bin Rahman" });
logAudit({ uid: "doctor-1", role: "doctor", name: "Dr. Sarah Jenkins" }, "medical_history.create", "patient", "patient-1", { diagnosis: "Routine diabetes follow-up" });

// ---------------------------------------------------------------------------
// JSON shapes — copied verbatim from the real route files so the offline
// frontend (built from the same code) renders identically.
// ---------------------------------------------------------------------------
function toPatientJson(row) {
  return {
    uid: row.id, name: row.name, email: row.email, ic: row.ic, dob: row.dob, age: row.age,
    gender: row.gender, bloodType: row.blood_type, allergies: row.allergies,
    chronicIllnesses: row.chronic_illnesses, height: row.height, weight: row.weight, phone: row.phone,
    emergencyContactName: row.emergency_contact_name, emergencyContactPhone: row.emergency_contact_phone,
    cardUid: row.card_uid, avatarUrl: row.avatar_url, createdAt: row.created_at,
  };
}
function toEmergencyProfileJson(row) {
  return {
    uid: row.id, cardUid: row.card_uid, name: row.name, avatarUrl: row.avatar_url,
    age: row.age, gender: row.gender, bloodType: row.blood_type, allergies: row.allergies,
    chronicIllnesses: row.chronic_illnesses, emergencyContactName: row.emergency_contact_name,
    emergencyContactPhone: row.emergency_contact_phone,
  };
}
function toHistoryJson(row) {
  return { id: row.id, patientId: row.patient_id, diagnosis: row.diagnosis, date: row.date, physician: row.physician, physicianId: row.physician_id, remarks: row.remarks, imageUrls: row.image_urls || [], createdAt: row.created_at };
}
function toLabJson(row) {
  return { id: row.id, patientId: row.patient_id, testName: row.test_name, physician: row.physician, physicianId: row.physician_id, date: row.date, flagged: row.flagged, fileUrl: row.file_url, fileName: row.file_name, createdAt: row.created_at };
}
function toRadiologyJson(row) {
  return { id: row.id, patientId: row.patient_id, type: row.type, anatomy: row.anatomy, classification: row.classification, fileUrl: row.file_url, fileName: row.file_name, uploadedBy: row.uploaded_by, uploadedAt: row.uploaded_at };
}
function toMessageJson(row) {
  return { id: row.id, patientId: row.patient_id, doctorId: row.doctor_id, senderRole: row.sender_role, senderName: row.sender_name, text: row.text, read: row.read, createdAt: row.created_at };
}
function toAppointmentJson(row) {
  return { id: row.id, patientId: row.patient_id, doctorId: row.doctor_id, doctorName: row.doctor_name, date: row.date, notes: row.notes, status: row.status, createdAt: row.created_at };
}
function toAuditJson(row) {
  return { id: row.id, actorId: row.actor_id, actorName: row.actor_name, actorRole: row.actor_role, action: row.action, targetType: row.target_type, targetId: row.target_id, details: row.details, createdAt: row.created_at };
}
function dataUrl(file) {
  return `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
}

// ---------------------------------------------------------------------------
// Fake auth — a base64 token standing in for a real Supabase JWT. Only
// meaningful on this laptop, for this demo; never expose this server publicly.
// ---------------------------------------------------------------------------
function issueToken(user) {
  return Buffer.from(JSON.stringify({ uid: user.id, role: user.role, name: user.name, email: user.email })).toString("base64");
}
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing bearer token" });
  try {
    req.user = JSON.parse(Buffer.from(token, "base64").toString("utf8"));
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: "Insufficient permissions" });
    next();
  };
}
function canAccessPatient(req, patientId) {
  return req.user.role === "admin" || req.user.role === "doctor" || req.user.uid === patientId;
}

const app = express();
app.use(express.json());

// ---- Offline login (replaces Supabase Auth for this build) ----------------
app.post("/api/offline/login", (req, res) => {
  const { email, password } = req.body || {};
  const user = findUserByEmail(email);
  if (!user || db.passwords[email] !== password) {
    return res.status(401).json({ error: "Invalid email or password." });
  }
  res.json({ token: issueToken(user), uid: user.id, email: user.email, name: user.name, role: user.role });
});

// ---- users ------------------------------------------------------------
app.get("/api/users/me", requireAuth, (req, res) => {
  const { uid: userId, role } = req.user;
  let extra = {};
  if (role === "patient") {
    const p = db.patients.find((x) => x.id === userId);
    extra = p ? toPatientJson(p) : {};
  } else if (role === "doctor") {
    const d = db.doctors.find((x) => x.id === userId);
    extra = d ? { department: d.department, hospital: d.hospital, avatarUrl: d.avatar_url } : {};
  }
  res.json({ ...req.user, ...extra });
});

app.get("/api/users/doctors", requireAuth, requireRole("admin", "doctor"), (_req, res) => {
  res.json(
    [...db.doctors].sort((a, b) => a.name.localeCompare(b.name))
      .map((d) => ({ uid: d.id, name: d.name, email: d.email, department: d.department, hospital: d.hospital, avatarUrl: d.avatar_url }))
  );
});

// ---- patients -----------------------------------------------------------
app.get("/api/patients", requireAuth, requireRole("admin", "doctor"), (req, res) => {
  const search = (req.query.search || "").toString().trim().toLowerCase();
  let rows = [...db.patients];
  if (search) rows = rows.filter((p) => p.name.toLowerCase().includes(search) || p.ic.toLowerCase().includes(search));
  res.json(rows.sort((a, b) => a.name.localeCompare(b.name)).map(toPatientJson));
});

app.get("/api/patients/:id", requireAuth, (req, res) => {
  if (!canAccessPatient(req, req.params.id)) return res.status(403).json({ error: "Insufficient permissions" });
  const p = db.patients.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: "Patient not found" });
  res.json(toPatientJson(p));
});

app.patch("/api/patients/:id", requireAuth, requireRole("admin", "doctor"), (req, res) => {
  const p = db.patients.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: "Patient not found" });
  const allowedMap = {
    name: "name", ic: "ic", dob: "dob", age: "age", gender: "gender", bloodType: "blood_type",
    allergies: "allergies", chronicIllnesses: "chronic_illnesses", height: "height",
    weight: "weight", phone: "phone", emergencyContactName: "emergency_contact_name",
    emergencyContactPhone: "emergency_contact_phone",
  };
  for (const [key, column] of Object.entries(allowedMap)) {
    if (key in req.body) p[column] = req.body[key];
  }
  logAudit(req.user, "patient.update", "patient", p.id, { fields: Object.keys(req.body) });
  res.json(toPatientJson(p));
});

// Bind an unused card UID to an existing, cardless patient — mirrors
// server/src/routes/patients.js's POST /:id/card.
app.post("/api/patients/:id/card", requireAuth, requireRole("admin"), (req, res) => {
  const { cardUid } = req.body;
  if (!cardUid) return res.status(400).json({ error: "cardUid is required" });
  const p = db.patients.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: "Patient not found" });
  if (p.card_uid) return res.status(409).json({ error: "This patient already has a card assigned." });
  if (db.patients.some((x) => x.card_uid === cardUid)) return res.status(409).json({ error: "This card UID is already registered." });
  p.card_uid = cardUid;
  logAudit(req.user, "nfc.register", "patient", p.id, { cardUid, name: p.name, existingPatient: true });
  res.json(toPatientJson(p));
});

app.post("/api/patients/:id/avatar", requireAuth, upload.single("file"), (req, res) => {
  if (!canAccessPatient(req, req.params.id)) return res.status(403).json({ error: "Insufficient permissions" });
  if (!req.file) return res.status(400).json({ error: "file is required" });
  const p = db.patients.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: "Patient not found" });
  p.avatar_url = dataUrl(req.file);
  logAudit(req.user, "patient.avatar_update", "patient", p.id, {});
  res.json(toPatientJson(p));
});

// ---- medical history ------------------------------------------------------
app.get("/api/medical-history", requireAuth, (req, res) => {
  const { patientId } = req.query;
  if (!patientId) return res.status(400).json({ error: "patientId query param required" });
  if (!canAccessPatient(req, patientId)) return res.status(403).json({ error: "Insufficient permissions" });
  const rows = db.medical_history.filter((h) => h.patient_id === patientId).sort((a, b) => b.date.localeCompare(a.date));
  res.json(rows.map(toHistoryJson));
});

app.post("/api/medical-history", requireAuth, requireRole("admin", "doctor"), upload.array("images", 6), (req, res) => {
  const { patientId, diagnosis, date, remarks } = req.body;
  if (!patientId || !diagnosis) return res.status(400).json({ error: "patientId and diagnosis are required" });
  const row = {
    id: uid("hist"), patient_id: patientId, diagnosis, date: date || now().slice(0, 10),
    physician: req.user.name || req.user.email, physician_id: req.user.uid, remarks: remarks || "",
    image_urls: (req.files || []).map(dataUrl), created_at: now(),
  };
  db.medical_history.unshift(row);
  logAudit(req.user, "medical_history.create", "patient", patientId, { diagnosis, images: row.image_urls.length });
  res.status(201).json(toHistoryJson(row));
});

// ---- lab results ------------------------------------------------------
app.get("/api/lab-results", requireAuth, (req, res) => {
  const { patientId } = req.query;
  if (!patientId) return res.status(400).json({ error: "patientId query param required" });
  if (!canAccessPatient(req, patientId)) return res.status(403).json({ error: "Insufficient permissions" });
  const rows = db.lab_results.filter((l) => l.patient_id === patientId).sort((a, b) => b.date.localeCompare(a.date));
  res.json(rows.map(toLabJson));
});

app.post("/api/lab-results", requireAuth, requireRole("admin", "doctor"), upload.single("file"), (req, res) => {
  const { patientId, testName, date, flagged } = req.body;
  if (!patientId || !testName) return res.status(400).json({ error: "patientId and testName are required" });
  const row = {
    id: uid("lab"), patient_id: patientId, test_name: testName, physician: req.user.name || req.user.email,
    physician_id: req.user.uid, date: date || now().slice(0, 10), flagged: flagged === "true" || flagged === true,
    file_url: req.file ? dataUrl(req.file) : null, file_name: req.file ? req.file.originalname : null, created_at: now(),
  };
  db.lab_results.unshift(row);
  logAudit(req.user, "lab_result.create", "patient", patientId, { testName });
  res.status(201).json(toLabJson(row));
});

// ---- radiology / imaging ------------------------------------------------
app.get("/api/radiology", requireAuth, (req, res) => {
  const { patientId } = req.query;
  if (!patientId) return res.status(400).json({ error: "patientId query param required" });
  if (!canAccessPatient(req, patientId)) return res.status(403).json({ error: "Insufficient permissions" });
  const rows = db.radiology.filter((r) => r.patient_id === patientId).sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at));
  res.json(rows.map(toRadiologyJson));
});

app.post("/api/radiology", requireAuth, requireRole("admin", "doctor"), upload.single("file"), (req, res) => {
  const { patientId, type, anatomy, classification } = req.body;
  if (!patientId || !type || !req.file) return res.status(400).json({ error: "patientId, type, and file are required" });
  const row = {
    id: uid("rad"), patient_id: patientId, type, anatomy: anatomy || "", classification: classification || "",
    file_url: dataUrl(req.file), file_name: req.file.originalname, uploaded_by: req.user.name || req.user.email,
    uploaded_at: now(),
  };
  db.radiology.unshift(row);
  logAudit(req.user, "radiology.create", "patient", patientId, { type });
  res.status(201).json(toRadiologyJson(row));
});

// ---- NFC / QR / manual card scan ------------------------------------------
const SCAN_METHODS = new Set(["nfc", "qr", "manual"]);
app.get("/api/nfc/:cardUid", requireAuth, requireRole("admin", "doctor"), (req, res) => {
  const method = SCAN_METHODS.has(req.query.method) ? req.query.method : "manual";
  const p = db.patients.find((x) => x.card_uid === req.params.cardUid);
  if (!p) return res.status(404).json({ error: "This card is not registered to any patient." });
  logAudit(req.user, "nfc.scan", "patient", p.id, { cardUid: req.params.cardUid, method });
  res.json(toEmergencyProfileJson(p));
});

app.post("/api/nfc/register", requireAuth, requireRole("admin"), (req, res) => {
  const { cardUid, email, password, name } = req.body;
  if (!cardUid || !email || !password || !name) return res.status(400).json({ error: "cardUid, email, password, and name are required" });
  if (db.patients.some((p) => p.card_uid === cardUid)) return res.status(409).json({ error: "This card UID is already registered." });

  const id = uid("patient");
  db.profiles.push({ id, role: "patient", name, email });
  db.passwords[email] = password;
  const row = {
    id, name, email, ic: req.body.ic || "", dob: req.body.dob || null, age: req.body.age ? Number(req.body.age) : null,
    gender: req.body.gender || "", blood_type: req.body.bloodType || "", allergies: [], chronic_illnesses: [],
    height: null, weight: null, phone: req.body.phone || "",
    emergency_contact_name: req.body.emergencyContactName || "", emergency_contact_phone: req.body.emergencyContactPhone || "",
    card_uid: cardUid, avatar_url: null, created_at: now(),
  };
  db.patients.push(row);
  logAudit(req.user, "nfc.register", "patient", id, { cardUid, name });
  res.status(201).json(toPatientJson(row));
});

// ---- messages ------------------------------------------------------
app.get("/api/messages/unread-count", requireAuth, (req, res) => {
  const { role, uid: userId } = req.user;
  if (role === "admin") return res.json({ count: 0 });
  const count = db.messages.filter((m) =>
    !m.read && (role === "patient" ? m.patient_id === userId && m.sender_role === "doctor" : m.doctor_id === userId && m.sender_role === "patient")
  ).length;
  res.json({ count });
});

app.get("/api/messages", requireAuth, (req, res) => {
  const { patientId } = req.query;
  if (!patientId) return res.status(400).json({ error: "patientId query param required" });
  if (!canAccessPatient(req, patientId)) return res.status(403).json({ error: "Insufficient permissions" });
  const rows = db.messages.filter((m) => m.patient_id === patientId).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 100);
  res.json(rows.map(toMessageJson));
});

app.post("/api/messages/mark-read", requireAuth, (req, res) => {
  const { patientId } = req.body;
  if (!patientId) return res.status(400).json({ error: "patientId is required" });
  if (!canAccessPatient(req, patientId)) return res.status(403).json({ error: "Insufficient permissions" });
  const otherRole = req.user.role === "patient" ? "doctor" : "patient";
  db.messages.forEach((m) => {
    if (m.patient_id === patientId && m.sender_role === otherRole && !m.read) m.read = true;
  });
  res.json({ ok: true });
});

app.post("/api/messages", requireAuth, (req, res) => {
  const { patientId, doctorId, text } = req.body;
  if (!patientId || !text) return res.status(400).json({ error: "patientId and text are required" });
  if (!canAccessPatient(req, patientId)) return res.status(403).json({ error: "Insufficient permissions" });
  const row = {
    id: uid("msg"), patient_id: patientId, doctor_id: req.user.role === "doctor" ? req.user.uid : doctorId || null,
    sender_role: req.user.role, sender_name: req.user.name || req.user.email, text, read: false, created_at: now(),
  };
  db.messages.unshift(row);
  res.status(201).json(toMessageJson(row));
});

// ---- appointments ------------------------------------------------------
app.get("/api/appointments/mine", requireAuth, requireRole("doctor"), (req, res) => {
  const nameById = new Map(db.patients.map((p) => [p.id, p.name]));
  const rows = db.appointments.filter((a) => a.doctor_id === req.user.uid).sort((a, b) => a.date.localeCompare(b.date));
  res.json(rows.map((row) => ({ ...toAppointmentJson(row), patientName: nameById.get(row.patient_id) || "Unknown" })));
});

app.get("/api/appointments", requireAuth, (req, res) => {
  const { patientId } = req.query;
  if (!patientId) return res.status(400).json({ error: "patientId query param required" });
  if (!canAccessPatient(req, patientId)) return res.status(403).json({ error: "Insufficient permissions" });
  const rows = db.appointments.filter((a) => a.patient_id === patientId).sort((a, b) => a.date.localeCompare(b.date));
  res.json(rows.map(toAppointmentJson));
});

app.post("/api/appointments", requireAuth, requireRole("admin", "doctor"), (req, res) => {
  const { patientId, date, notes } = req.body;
  if (!patientId || !date) return res.status(400).json({ error: "patientId and date are required" });
  const row = {
    id: uid("appt"), patient_id: patientId, doctor_id: req.user.role === "doctor" ? req.user.uid : null,
    doctor_name: req.user.name || req.user.email, date, notes: notes || "", status: "scheduled", created_at: now(),
  };
  db.appointments.push(row);
  res.status(201).json(toAppointmentJson(row));
});

// ---- doctor ------------------------------------------------------
app.post("/api/doctor/avatar", requireAuth, requireRole("doctor"), upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "file is required" });
  const d = db.doctors.find((x) => x.id === req.user.uid);
  if (!d) return res.status(404).json({ error: "Doctor not found" });
  d.avatar_url = dataUrl(req.file);
  res.json({ department: d.department, avatarUrl: d.avatar_url });
});

app.get("/api/doctor/stats", requireAuth, requireRole("doctor"), (req, res) => {
  const doctorId = req.user.uid;
  const history = db.medical_history.filter((h) => h.physician_id === doctorId);
  const appointments = db.appointments.filter((a) => a.doctor_id === doctorId);
  const myPatientCount = new Set(history.map((h) => h.patient_id)).size;
  const today = now().slice(0, 10);
  const upcomingAppointments = appointments.filter((a) => a.date >= today).length;

  const nowD = new Date();
  const weekBuckets = new Map();
  for (let i = 7; i >= 0; i--) {
    const d = new Date(nowD.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    weekBuckets.set(d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), 0);
  }
  const weekKeys = Array.from(weekBuckets.keys());
  history.forEach((h) => {
    const createdAt = new Date(h.created_at);
    const weeksAgo = Math.floor((nowD - createdAt) / (7 * 24 * 60 * 60 * 1000));
    const idx = 7 - weeksAgo;
    if (idx >= 0 && idx < weekKeys.length) weekBuckets.set(weekKeys[idx], weekBuckets.get(weekKeys[idx]) + 1);
  });

  res.json({
    myPatientCount, totalRecordsLogged: history.length, upcomingAppointments,
    weeklyActivity: Array.from(weekBuckets.entries()).map(([week, records]) => ({ week, records })),
  });
});

// ---- admin ------------------------------------------------------
app.get("/api/admin/stats", requireAuth, requireRole("admin"), (_req, res) => {
  const nowD = new Date();
  const startOfMonth = new Date(nowD.getFullYear(), nowD.getMonth(), 1);
  const thirtyDaysAgo = new Date(nowD.getTime() - 30 * 24 * 60 * 60 * 1000);

  let newRegistrationsThisMonth = 0, totalCardsIssued = 0;
  const genderDistribution = { Male: 0, Female: 0, Other: 0 };
  db.patients.forEach((p) => {
    if (new Date(p.created_at) >= startOfMonth) newRegistrationsThisMonth++;
    if (p.card_uid) totalCardsIssued++;
    genderDistribution[p.gender === "Male" || p.gender === "Female" ? p.gender : "Other"]++;
  });

  let activeTreatmentCases = 0;
  const monthBuckets = new Map();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(nowD.getFullYear(), nowD.getMonth() - i, 1);
    monthBuckets.set(d.toLocaleString("en-US", { month: "short", year: "2-digit" }), 0);
  }
  db.medical_history.forEach((h) => {
    const createdAt = new Date(h.created_at);
    if (createdAt >= thirtyDaysAgo) activeTreatmentCases++;
    const key = createdAt.toLocaleString("en-US", { month: "short", year: "2-digit" });
    if (monthBuckets.has(key)) monthBuckets.set(key, monthBuckets.get(key) + 1);
  });

  res.json({
    totalPatients: db.patients.length, totalDoctors: db.doctors.length, totalCardsIssued,
    newRegistrationsThisMonth, activeTreatmentCases, genderDistribution,
    hospitalAnalytics: Array.from(monthBuckets.entries()).map(([month, visits]) => ({ month, visits })),
  });
});

app.get("/api/admin/reports", requireAuth, requireRole("admin"), (_req, res) => {
  const patientNameById = new Map(db.patients.map((p) => [p.id, p.name]));
  const reports = [...db.medical_history]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 50)
    .map((h) => ({
      id: h.id, patientId: h.patient_id, patientName: patientNameById.get(h.patient_id) || "Unknown",
      physician: h.physician, physicianId: h.physician_id, diagnosis: h.diagnosis, submittedAt: h.created_at,
    }));
  res.json({
    doctors: db.doctors.map((d) => ({ uid: d.id, name: d.name, email: d.email, department: d.department, hospital: d.hospital })),
    reports,
  });
});

app.post("/api/users", requireAuth, requireRole("admin"), (req, res) => {
  const { email, password, name, role, department, hospital } = req.body;
  if (!email || !password || !name || !role) return res.status(400).json({ error: "email, password, name, role are required" });
  if (!["doctor", "admin"].includes(role)) return res.status(400).json({ error: "role must be 'doctor' or 'admin'" });

  const id = uid(role);
  db.profiles.push({ id, role, name, email });
  db.passwords[email] = password;
  if (role === "doctor") {
    db.doctors.push({ id, name, email, department: department || "General", hospital, avatar_url: null });
  }
  res.status(201).json({ uid: id, email, name, role });
});

// ---- audit log ------------------------------------------------------
app.get("/api/audit", requireAuth, requireRole("admin"), (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  res.json(db.audit_log.slice(0, limit).map(toAuditJson));
});

// ---- serve the built offline frontend ------------------------------------
const distDir = path.join(__dirname, "..", "client", "dist-offline");
app.use(express.static(distDir));
app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(distDir, "index.html")));

app.listen(PORT, () => {
  console.log(`\nMediCard OFFLINE demo server running — no internet required.`);
  console.log(`Open: http://localhost:${PORT}\n`);
  console.log(`Demo logins (password for all: password123):`);
  console.log(`  Admin:    admin@medicard.dev`);
  console.log(`  Doctor:   doctor@medicard.dev   (Dr. Sarah Jenkins - Cardiology)`);
  console.log(`  Doctor:   doctor2@medicard.dev  (Dr. Robert Chan - Endocrinology)`);
  console.log(`  Patient:  patient@medicard.dev  (card UID: 04A3B2C1)`);
  console.log(`  Patient:  patient2@medicard.dev (card UID: 07D8E9F0)\n`);
});
