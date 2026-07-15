import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { toPatientJson } from "./users.js";
import { createPatientAccount } from "./patients.js";
import { logAudit } from "../lib/audit.js";

const router = Router();

// Doctor/Admin scans a card -> look up the bound patient profile.
router.get("/:cardUid", requireAuth, requireRole("admin", "doctor"), async (req, res) => {
  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .eq("card_uid", req.params.cardUid)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) {
    return res.status(404).json({ error: "This card is not registered to any patient." });
  }
  await logAudit(req.user, "nfc.scan", "patient", data.id, { cardUid: req.params.cardUid });
  res.json(toPatientJson(data));
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
