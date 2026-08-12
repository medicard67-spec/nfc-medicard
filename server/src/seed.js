// Seeds the Supabase project with demo accounts and sample clinical data.
// Run with server/.env pointed at your Supabase project: npm run seed  (from /server)
import "dotenv/config";
import { supabase } from "./lib/supabase.js";

async function createAccount({ email, password, name, role, extra = {} }) {
  let userId;
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError) {
    if (createError.message.toLowerCase().includes("already been registered")) {
      const { data: list } = await supabase.auth.admin.listUsers();
      const existing = list.users.find((u) => u.email === email);
      if (!existing) throw createError;
      userId = existing.id;
    } else {
      throw createError;
    }
  } else {
    userId = created.user.id;
  }

  await supabase.from("profiles").upsert({ id: userId, role, name, email });

  if (role === "doctor") {
    await supabase.from("doctors").upsert({
      id: userId,
      name,
      email,
      department: extra.department || "General",
      hospital: extra.hospital || "",
    });
  }

  return userId;
}

async function main() {
  console.log("Seeding NFC MediCard demo data in Supabase...");

  await createAccount({
    email: "admin@medicard.dev",
    password: "password123",
    name: "System Administrator",
    role: "admin",
  });

  const doctor1Id = await createAccount({
    email: "doctor@medicard.dev",
    password: "password123",
    name: "Dr. Sarah Jenkins",
    role: "doctor",
    extra: { department: "Cardiology", hospital: "Hospital Kuala Lumpur (HKL)" },
  });

  const doctor2Id = await createAccount({
    email: "doctor2@medicard.dev",
    password: "password123",
    name: "Dr. Robert Chan",
    role: "doctor",
    extra: { department: "Endocrinology", hospital: "Gleneagles Kuala Lumpur" },
  });

  const patient1Id = await createAccount({
    email: "patient@medicard.dev",
    password: "password123",
    name: "Ahmad Faiz Bin Rahman",
    role: "patient",
  });

  await supabase.from("patients").upsert({
    id: patient1Id,
    name: "Ahmad Faiz Bin Rahman",
    email: "patient@medicard.dev",
    ic: "010203-14-1234",
    dob: "2001-02-03",
    age: 25,
    gender: "Male",
    blood_type: "O+",
    allergies: ["Penicillin", "Peanuts"],
    chronic_illnesses: ["Type 2 Diabetes"],
    height: 172,
    weight: 68,
    phone: "012-3456789",
    emergency_contact_name: "Rahman Bin Ismail",
    emergency_contact_phone: "013-9876543",
    card_uid: "04A3B2C1",
  });

  const patient2Id = await createAccount({
    email: "patient2@medicard.dev",
    password: "password123",
    name: "Nur Aisyah Binti Kamal",
    role: "patient",
  });

  await supabase.from("patients").upsert({
    id: patient2Id,
    name: "Nur Aisyah Binti Kamal",
    email: "patient2@medicard.dev",
    ic: "980512-10-5678",
    dob: "1998-05-12",
    age: 28,
    gender: "Female",
    blood_type: "A-",
    allergies: ["Sulfa drugs"],
    chronic_illnesses: [],
    height: 160,
    weight: 55,
    phone: "019-2223344",
    emergency_contact_name: "Kamal Bin Yusof",
    emergency_contact_phone: "017-5556677",
    card_uid: "07D8E9F0",
  });

  await supabase.from("medical_history").insert([
    {
      patient_id: patient1Id,
      diagnosis: "Routine diabetes follow-up",
      date: "2026-06-02",
      physician: "Dr. Sarah Jenkins",
      physician_id: doctor1Id,
      remarks: "Blood sugar stable. Continue current medication.",
    },
    {
      patient_id: patient1Id,
      diagnosis: "Seasonal allergic rhinitis",
      date: "2026-03-15",
      physician: "Dr. Robert Chan",
      physician_id: doctor2Id,
      remarks: "Prescribed antihistamines for 2 weeks.",
    },
  ]);

  await supabase.from("lab_results").insert({
    patient_id: patient1Id,
    test_name: "HbA1c (Blood Sugar Panel)",
    physician: "Dr. Sarah Jenkins",
    physician_id: doctor1Id,
    date: "2026-06-02",
    flagged: false,
  });

  await supabase.from("messages").insert({
    patient_id: patient1Id,
    doctor_id: doctor1Id,
    sender_role: "doctor",
    sender_name: "Dr. Sarah Jenkins",
    text: "Your latest lab results look good. Keep up with your medication schedule.",
  });

  await supabase.from("appointments").insert({
    patient_id: patient1Id,
    doctor_id: doctor1Id,
    doctor_name: "Dr. Sarah Jenkins",
    date: "2026-08-10",
    notes: "3-month diabetes review",
    status: "scheduled",
  });

  await supabase.from("vitals").insert({
    patient_id: patient1Id,
    heart_rate: 78,
    note: "Resting, ward round",
  });

  console.log("\nSeed complete. Demo logins (all passwords: password123):");
  console.log("  Admin:    admin@medicard.dev");
  console.log("  Doctor:   doctor@medicard.dev   (Dr. Sarah Jenkins - Cardiology)");
  console.log("  Doctor:   doctor2@medicard.dev  (Dr. Robert Chan - Endocrinology)");
  console.log("  Patient:  patient@medicard.dev  (card UID: 04A3B2C1)");
  console.log("  Patient:  patient2@medicard.dev (card UID: 07D8E9F0)");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
