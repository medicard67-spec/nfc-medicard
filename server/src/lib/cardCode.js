import { createClient } from "@supabase/supabase-js";

// The emailed code that proves a patient owns the account a card is being
// linked to. Supabase Auth sends it (its "Magic Link" email, which must show
// {{ .Token }}) and checks it, so we never store the code ourselves.
//
// Each call gets its own short-lived client: verifying a code signs that
// client in as the patient, and the shared service-role client in
// supabase.js must never pick up a patient's session.
function freshClient() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function sendCardCode(email) {
  const { error } = await freshClient().auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  if (error) throw error;
}

// true when the code matches the one just emailed to this address
export async function checkCardCode(email, code) {
  const client = freshClient();
  const { data, error } = await client.auth.verifyOtp({ email, token: String(code).trim(), type: "email" });
  if (error || !data?.session) return false;
  // the check created a login session we don't need: end just that one
  await client.auth.signOut({ scope: "local" }).catch(() => {});
  return true;
}

// "f***s@gmail.com", so the screen shows where the code went without the full address
export function maskEmail(email) {
  const [name, domain] = String(email || "").split("@");
  if (!domain) return "";
  const shown = name.length <= 2 ? name[0] : `${name[0]}***${name[name.length - 1]}`;
  return `${shown}@${domain}`;
}
