// Drop-in replacement for the handful of `supabase.auth.*` calls the app
// uses, backed by the offline demo server (server/offline-server.js) instead
// of real Supabase Auth. Only used when built with VITE_OFFLINE=true — see
// supabase.js. Not real security; for a local, no-internet demo build only.
const STORAGE_KEY = "medicard_offline_session";
const apiBase = import.meta.env.VITE_API_URL || "http://localhost:4444/api";

let listeners = [];

function readSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSession(session) {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore storage errors (private mode, etc.) — session still works in-memory this tab
  }
  listeners.forEach((cb) => cb(session ? "SIGNED_IN" : "SIGNED_OUT", session));
}

export const offlineSupabase = {
  auth: {
    getSession: async () => ({ data: { session: readSession() } }),

    onAuthStateChange: (callback) => {
      listeners.push(callback);
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              listeners = listeners.filter((cb) => cb !== callback);
            },
          },
        },
      };
    },

    signInWithPassword: async ({ email, password }) => {
      try {
        const res = await fetch(`${apiBase}/offline/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const body = await res.json();
        if (!res.ok) return { error: { message: body.error || "Invalid email or password." } };

        const session = { access_token: body.token, user: { id: body.uid, email: body.email } };
        writeSession(session);
        return { error: null };
      } catch (err) {
        return { error: { message: "Could not reach the offline demo server. Is it running?" } };
      }
    },

    signOut: async () => {
      writeSession(null);
      return { error: null };
    },

    // No real email flow offline — demo accounts are already "confirmed".
    resend: async () => ({ error: null }),
  },
};
