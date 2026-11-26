import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";
import { notify, adminIds } from "../lib/notify.js";
import { sendCardCode, checkCardCode, maskEmail } from "../lib/cardCode.js";

// "My MediCard": a patient checks a card they tap on their phone, links a
// new card with an emailed code, and reports a card lost or found. Admins
// can report lost/found for any patient too.
const router = Router();

export const CODE_MINUTES = 10;
export const MAX_ATTEMPTS = 5;
export const RESEND_SECONDS = 60;

// "04:a3:b2:c1" / "04 A3 B2 C1" -> "04A3B2C1", the format cards are stored in
export function normalizeUid(value) {
  return String(value || "").replace(/[\s:-]/g, "").toUpperCase();
}

const PATIENT_COLUMNS = "id, name, email, card_uid, card_status, card_lost_at, created_at";

async function loadPatient(id) {
  const { data } = await supabase.from("patients").select(PATIENT_COLUMNS).eq("id", id).maybeSingle();
  return data;
}

function cardJson(p) {
  return {
    cardUid: p.card_uid || null,
    status: p.card_uid ? p.card_status || "active" : "none",
    lostAt: p.card_lost_at || null,
  };
}

// Who a card UID belongs to: { owner } for a card in use, { retired } for a replaced one.
async function findCard(cardUid) {
  const { data: owner } = await supabase.from("patients").select("id").eq("card_uid", cardUid).maybeSingle();
  if (owner) return { owner };
  const { data: retired } = await supabase.from("retired_cards").select("card_uid, patient_id").eq("card_uid", cardUid).maybeSingle();
  return { retired: retired || null };
}

// The patient's current card plus the cards they had before.
router.get("/mine", requireAuth, requireRole("patient"), async (req, res) => {
  const me = await loadPatient(req.user.uid);
  if (!me) return res.status(404).json({ error: "Patient not found" });
  const { data: history } = await supabase
    .from("retired_cards")
    .select("card_uid, reason, linked_at, retired_at")
    .eq("patient_id", me.id)
    .order("retired_at", { ascending: false });
  res.json({
    ...cardJson(me),
    hasEmail: Boolean(me.email),
    history: (history || []).map((h) => ({ cardUid: h.card_uid, reason: h.reason, linkedAt: h.linked_at, retiredAt: h.retired_at })),
  });
});

// A patient tapped a card on their phone: is it theirs?
// result: mine | mine-lost | mine-old | not-yours | unlinked
// Someone else's card never reveals whose it is.
router.post("/check", requireAuth, requireRole("patient"), async (req, res) => {
  const cardUid = normalizeUid(req.body.cardUid);
  if (!cardUid) return res.status(400).json({ error: "cardUid is required" });
  const me = await loadPatient(req.user.uid);
  if (!me) return res.status(404).json({ error: "Patient not found" });

  let result;
  if (me.card_uid === cardUid) {
    result = me.card_status === "lost" ? "mine-lost" : "mine";
  } else {
    const { owner, retired } = await findCard(cardUid);
    if (owner) result = "not-yours";
    else if (retired) result = retired.patient_id === me.id ? "mine-old" : "not-yours";
    else result = "unlinked";
  }
  const canLink = result === "unlinked" && (!me.card_uid || me.card_status === "lost");
  res.json({ result, cardUid, canLink, card: cardJson(me) });
});

// Step 1 of linking a card: check it is free, then email the patient a code.
router.post("/link/start", requireAuth, requireRole("patient"), async (req, res) => {
  const cardUid = normalizeUid(req.body.cardUid);
  if (!cardUid) return res.status(400).json({ error: "cardUid is required" });
  const me = await loadPatient(req.user.uid);
  if (!me) return res.status(404).json({ error: "Patient not found" });
  if (me.card_uid && me.card_status !== "lost") {
    return res.status(409).json({ code: "has-card", error: "You already have an active card. Report it lost first to replace it." });
  }
  if (!me.email) {
    return res.status(400).json({ code: "no-email", error: "Your account has no email. Please link your card at the registration desk." });
  }
  const { owner, retired } = await findCard(cardUid);
  if (owner || retired) return res.status(409).json({ code: "card-taken", error: "This card can't be linked." });

  const { data: pending } = await supabase.from("card_link_requests").select("sent_at").eq("patient_id", me.id).maybeSingle();
  if (pending) {
    const wait = RESEND_SECONDS - Math.floor((Date.now() - new Date(pending.sent_at).getTime()) / 1000);
    if (wait > 0) return res.status(429).json({ code: "wait", retryAfter: wait, error: `Please wait ${wait} seconds before asking for another code.` });
  }

  try {
    await sendCardCode(me.email);
  } catch (err) {
    console.error("Card link code email failed:", err.message);
    return res.status(502).json({ code: "email-failed", error: "We couldn't send the email. Please try again later or visit the registration desk." });
  }

  const now = Date.now();
  const { error } = await supabase.from("card_link_requests").upsert({
    patient_id: me.id,
    card_uid: cardUid,
    attempts: 0,
    sent_at: new Date(now).toISOString(),
    expires_at: new Date(now + CODE_MINUTES * 60000).toISOString(),
  });
  if (error) return res.status(500).json({ error: error.message });
  await logAudit(req.user, "card.link_requested", "patient", me.id, { cardUid });
  res.json({ emailHint: maskEmail(me.email), expiresInMinutes: CODE_MINUTES, cardUid });
});

// Step 2: the patient typed the code. Right code -> the card is theirs.
router.post("/link/confirm", requireAuth, requireRole("patient"), async (req, res) => {
  const code = String(req.body.code || "").replace(/\s/g, "");
  if (!/^\d{6,10}$/.test(code)) return res.status(400).json({ code: "bad-code", error: "Enter the code from the email." });
  const me = await loadPatient(req.user.uid);
  if (!me) return res.status(404).json({ error: "Patient not found" });

  const { data: pending } = await supabase.from("card_link_requests").select("*").eq("patient_id", me.id).maybeSingle();
  if (!pending) return res.status(400).json({ code: "no-request", error: "Tap your card again to get a new code." });
  if (new Date(pending.expires_at).getTime() < Date.now() || pending.attempts >= MAX_ATTEMPTS) {
    await supabase.from("card_link_requests").delete().eq("patient_id", me.id);
    return res.status(410).json({ code: "expired", error: "This code has expired. Tap your card again to get a new one." });
  }

  const ok = await checkCardCode(me.email, code);
  if (!ok) {
    const attempts = pending.attempts + 1;
    if (attempts >= MAX_ATTEMPTS) {
      await supabase.from("card_link_requests").delete().eq("patient_id", me.id);
      await logAudit(req.user, "card.link_failed", "patient", me.id, { cardUid: pending.card_uid });
      return res.status(410).json({ code: "expired", error: "Too many wrong codes. Tap your card again to get a new one." });
    }
    await supabase.from("card_link_requests").update({ attempts }).eq("patient_id", me.id);
    return res.status(400).json({ code: "wrong-code", attemptsLeft: MAX_ATTEMPTS - attempts, error: "That code is not right." });
  }

  // someone may have linked the card in the meantime
  const { owner, retired } = await findCard(pending.card_uid);
  if (owner || retired) {
    await supabase.from("card_link_requests").delete().eq("patient_id", me.id);
    return res.status(409).json({ code: "card-taken", error: "This card can't be linked." });
  }

  const replaced = me.card_uid || null;
  if (replaced) {
    await supabase.from("retired_cards").upsert({ card_uid: replaced, patient_id: me.id, reason: "lost", linked_at: null });
  }
  const { data: updated, error } = await supabase
    .from("patients")
    .update({ card_uid: pending.card_uid, card_status: "active", card_lost_at: null, updated_at: new Date().toISOString() })
    .eq("id", me.id)
    .select(PATIENT_COLUMNS)
    .single();
  if (error || !updated) return res.status(500).json({ error: error?.message || "Could not link the card" });
  await supabase.from("card_link_requests").delete().eq("patient_id", me.id);

  await logAudit(req.user, "card.self_link", "patient", me.id, { cardUid: pending.card_uid, replaced, name: me.name });
  await notify(await adminIds(), "card.linked", { patient: me.name, cardUid: pending.card_uid, replaced }, "/admin/patients");
  res.json(cardJson(updated));
});

// Which patient a lost/found report is for: patients report their own,
// admins name one with { patientId }.
async function reportTarget(req, res) {
  const id = req.user.role === "patient" ? req.user.uid : req.body.patientId;
  if (!id) {
    res.status(400).json({ error: "patientId is required" });
    return null;
  }
  const p = await loadPatient(id);
  if (!p) {
    res.status(404).json({ error: "Patient not found" });
    return null;
  }
  if (!p.card_uid) {
    res.status(400).json({ code: "no-card", error: "There is no card to report." });
    return null;
  }
  return p;
}

async function setStatus(p, status) {
  const { data, error } = await supabase
    .from("patients")
    .update({ card_status: status, card_lost_at: status === "lost" ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq("id", p.id)
    .select(PATIENT_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

// Report a card lost: it stops opening records straight away.
router.post("/lost", requireAuth, requireRole("patient", "admin"), async (req, res) => {
  const p = await reportTarget(req, res);
  if (!p) return;
  if (p.card_status === "lost") return res.json(cardJson(p));
  try {
    const updated = await setStatus(p, "lost");
    await logAudit(req.user, "card.lost", "patient", p.id, { cardUid: p.card_uid, name: p.name });
    const by = req.user.name || req.user.email;
    if (req.user.role === "patient") {
      await notify(await adminIds(), "card.lost", { patient: p.name, cardUid: p.card_uid, by }, `/admin/patients/${p.id}`);
    } else {
      await notify(p.id, "card.lost", { patient: p.name, cardUid: p.card_uid, by }, "/patient/card");
    }
    res.json(cardJson(updated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Found it again: the card works as before.
router.post("/found", requireAuth, requireRole("patient", "admin"), async (req, res) => {
  const p = await reportTarget(req, res);
  if (!p) return;
  if (p.card_status !== "lost") return res.json(cardJson(p));
  try {
    const updated = await setStatus(p, "active");
    await logAudit(req.user, "card.found", "patient", p.id, { cardUid: p.card_uid, name: p.name });
    res.json(cardJson(updated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
