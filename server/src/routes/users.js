import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

// Returns the logged-in user's own profile, merged with role-specific data.
router.get("/me", requireAuth, async (req, res) => {
  const { uid, role } = req.user;
  let extra = {};

  if (role === "patient") {
    const { data } = await supabase.from("patients").select("*").eq("id", uid).single();
    extra = data ? toPatientJson(data) : {};
  } else if (role === "doctor") {
    const { data } = await supabase.from("doctors").select("*").eq("id", uid).single();
    extra = data ? { department: data.department } : {};
  }

  res.json({ ...req.user, ...extra });
});

// Admin-only: create a doctor or admin account.
router.post("/", requireAuth, requireRole("admin"), async (req, res) => {
  const { email, password, name, role, department } = req.body;
  if (!email || !password || !name || !role) {
    return res.status(400).json({ error: "email, password, name, role are required" });
  }
  if (!["doctor", "admin"].includes(role)) {
    return res.status(400).json({ error: "role must be 'doctor' or 'admin'" });
  }

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
  });
  if (createError) {
    return res.status(400).json({ error: createError.message });
  }

  supabase.auth.resend({ type: "signup", email }).catch((err) => {
    console.error("Failed to send verification email:", err.message);
  });

  const uid = created.user.id;
  const { error: profileError } = await supabase
    .from("profiles")
    .insert({ id: uid, role, name, email });
  if (profileError) {
    return res.status(400).json({ error: profileError.message });
  }

  if (role === "doctor") {
    const { error: doctorError } = await supabase
      .from("doctors")
      .insert({ id: uid, name, email, department: department || "General" });
    if (doctorError) {
      return res.status(400).json({ error: doctorError.message });
    }
  }

  res.status(201).json({ uid, email, name, role });
});

// List doctors (admin or doctor).
router.get("/doctors", requireAuth, requireRole("admin", "doctor"), async (_req, res) => {
  const { data, error } = await supabase.from("doctors").select("*").order("name");
  if (error) return res.status(500).json({ error: error.message });

  res.json(data.map((d) => ({ uid: d.id, name: d.name, email: d.email, department: d.department })));
});

export function toPatientJson(row) {
  return {
    uid: row.id,
    name: row.name,
    email: row.email,
    ic: row.ic,
    dob: row.dob,
    age: row.age,
    gender: row.gender,
    bloodType: row.blood_type,
    allergies: row.allergies,
    chronicIllnesses: row.chronic_illnesses,
    height: row.height,
    weight: row.weight,
    phone: row.phone,
    emergencyContactName: row.emergency_contact_name,
    emergencyContactPhone: row.emergency_contact_phone,
    cardUid: row.card_uid,
    createdAt: row.created_at,
  };
}

export default router;
