import crypto from "node:crypto";
import { supabase } from "./supabase.js";

// The online MediCard: a patient's phone answers a staff reader with
// "MCP" + 32 hex characters instead of a card UID. Only its SHA-256 is stored.
const TOKEN_RE = /^MCP[0-9A-F]{32}$/;

// Card UIDs are stored as plain upper-case hex ("04A3A2ED3D0289"). A UID typed
// in lower case or copied as "04:a3:a2..." means the same card.
export function normalizeUid(value) {
  return String(value || "").replace(/[\s:-]/g, "").toUpperCase();
}

export function isPhoneToken(value) {
  return TOKEN_RE.test(String(value || ""));
}

export function newPhoneToken() {
  return `MCP${crypto.randomBytes(16).toString("hex").toUpperCase()}`;
}

export function hashPhoneToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

// A tapped phone -> the physical card UID it stands for, or null when the
// phone card was removed or its card has since been replaced.
export async function resolvePhoneToken(token) {
  const { data: online } = await supabase
    .from("online_cards")
    .select("id, patient_id, card_uid, revoked_at")
    .eq("token_hash", hashPhoneToken(token))
    .maybeSingle();
  if (!online || online.revoked_at) return null;
  const { data: patient } = await supabase.from("patients").select("card_uid").eq("id", online.patient_id).maybeSingle();
  if (!patient || patient.card_uid !== online.card_uid) return null;
  await supabase.from("online_cards").update({ last_used_at: new Date().toISOString() }).eq("id", online.id);
  return online.card_uid;
}
