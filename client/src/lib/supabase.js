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

export const supabase = OFFLINE ? offlineSupabase : createClient(supabaseUrl, supabaseAnonKey);
