import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { createPatientAccount } from "./patients.js";
import { logAudit } from "../lib/audit.js";

const router = Router();

const SCAN_METHODS = new Set(["nfc", "qr", "manual"]);

// A card scan returns only what's needed to act in an emergency, not the
// patient's full chart (IC, email, full contact info stay behind the
// separate, explicit "open full record" lookup at GET /patients/:id).
function toEmergencyProfileJson(row) {
  return {
    uid: row.id,
    cardUid: row.card_uid,
    name: row.name,
    avatarUrl: row.avatar_url,
    age: row.age,
    gender: row.gender,
    bloodType: row.blood_type,
    allergies: row.allergies,
    chronicIllnesses: row.chronic_illnesses,
    emergencyContactName: row.emergency_contact_name,
    emergencyContactPhone: row.emergency_contact_phone,
  };
}

// Doctor/Admin scans a card -> immediate, read-only vital health summary for
// emergency use. ?method= records how the card UID was obtained (real NFC
// tap, QR scan, or typed in) for the emergency-access audit trail. The full
// patient chart is a separate, deliberate lookup (GET /patients/:id) from
// the "Open Full Record" action, not something a scan exposes by default.
router.get("/:cardUid", requireAuth, requireRole("admin", "doctor"), async (req, res) => {
  const method = SCAN_METHODS.has(req.query.method) ? req.query.method : "manual";
  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .eq("card_uid", req.params.cardUid)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) {
    return res.status(404).json({ error: "This card is not registered to any patient." });
  }
  await logAudit(req.user, "nfc.scan", "patient", data.id, { cardUid: req.params.cardUid, method });
  res.json(toEmergencyProfileJson(data));
});

// Admin: register a new physical card and create the patient account behind it.
router.post("/register", requireAuth, requireRole("admin"), async (req, res) => {
  const { cardUid, email, password, name } = req.body;
  if (!cardUid || !email || !password || !name) {
    return res.status(400).json({ error: "cardUid, email, password, and name are required" });
  }

  const { data: existingCard } = await supabase
    .from("patients")
    .select("id")
    .eq("card_uid", cardUid)
    .maybeSingle();
  if (existingCard) {
    return res.status(409).json({ error: "This card UID is already registered." });
  }

  try {
    const patient = await createPatientAccount({ ...req.body, registeredBy: req.user.name || req.user.email });
    await logAudit(req.user, "nfc.register", "patient", patient.uid, { cardUid, name: patient.name });
    res.status(201).json(patient);
  } catch (err) {
    console.error("Card registration failed:", err);
    res.status(400).json({ error: err.message });
  }
});

export default router;
