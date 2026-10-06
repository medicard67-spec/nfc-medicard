import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, openedFromRecoveryLink } from "../lib/supabase.js";
import api from "../lib/api.js";

// The Android app's own origin (https://localhost) can't be opened from an
// email, so reset links always point at the public website when one is set.
const PUBLIC_URL = import.meta.env.VITE_PUBLIC_URL || window.location.origin;

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const loadProfile = useCallback(async () => {
    try {
      const { data } = await api.get("/users/me");
      setProfile(data);
    } catch (err) {
      console.error("Failed to load profile:", err);
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session) await loadProfile();
      setLoading(false);
    });

    if (openedFromRecoveryLink) navigate("/reset-password", { replace: true });

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (event === "PASSWORD_RECOVERY") navigate("/reset-password", { replace: true });
      setSession(newSession);
      if (newSession) {
        await loadProfile();
      } else {
        setProfile(null);
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [loadProfile, navigate]);

  const login = async (email, password) => {
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      if (signInError.message?.toLowerCase().includes("email not confirmed")) {
        setError("email_not_confirmed");
      } else {
        setError("Invalid email or password.");
      }
      throw signInError;
    }
    // Login.jsx navigates to "/" right after this resolves, and "/" decides
    // where to send the user based on `role` (derived from `profile`). The
    // onAuthStateChange listener also kicks off loadProfile(), but that's a
    // separate, unawaited fetch — normally it finishes before signIn's own
    // network round trip does, but nothing here actually guarantees the
    // ordering. Awaiting it explicitly closes that race so "/" always sees
    // an up-to-date role, rather than bouncing back to /login because
    // profile hadn't loaded yet.
    await loadProfile();
  };

  const resendVerificationEmail = async (email) => {
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (resendError) throw resendError;
  };

  const requestPasswordReset = async (email) => {
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${PUBLIC_URL}/reset-password`,
    });
    if (resetError) throw resetError;
  };

  const updatePassword = async (password) => {
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) throw updateError;
  };

  const logout = () => supabase.auth.signOut();

  const value = {
    user: session?.user || null,
    profile,
    role: profile?.role || null,
    loading,
    error,
    login,
    logout,
    resendVerificationEmail,
    requestPasswordReset,
    updatePassword,
    refreshProfile: loadProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
