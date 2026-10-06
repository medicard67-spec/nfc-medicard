import { createClient } from "@supabase/supabase-js";
import { offlineSupabase } from "./offlineAuth.js";

// Offline demo build (npm run build:offline) talks to server/offline-server.js
// instead of real Supabase — see offlineAuth.js. Everything else in the app
// (AuthContext, api.js) is unaware of the difference; both objects expose the
// same `auth.*` methods.
const OFFLINE = import.meta.env.VITE_OFFLINE === "true";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!OFFLINE && (!supabaseUrl || !supabaseAnonKey)) {
  console.error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy client/.env.example to client/.env and fill them in."
  );
}

// Read before createClient: the client consumes and strips the link's hash
// tokens on startup, and this is the only reliable way to know the page was
// opened from a password-reset email even if Supabase redirected to the site
// root instead of /reset-password.
export const openedFromRecoveryLink =
  typeof window !== "undefined" && window.location.hash.includes("type=recovery");

export const supabase = OFFLINE ? offlineSupabase : createClient(supabaseUrl, supabaseAnonKey);
