import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import BackgroundImage from "../components/BackgroundImage.jsx";
import logo from "../assets/logo.png";

const MIN_LENGTH = 8;

export default function ResetPassword() {
  const { user, loading, updatePassword, logout } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < MIN_LENGTH) {
      setError(`Use at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await updatePassword(password);
      // Sign out so the user proves the new password works on the way back in.
      await logout();
      navigate("/login", { replace: true, state: { passwordReset: true } });
    } catch (err) {
      setError(err.message || "Couldn't update your password. Please try again.");
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <BackgroundImage />
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-white p-1.5 shadow-soft ring-1 ring-slate-200 dark:ring-slate-800">
            <img src={logo} alt="NFC MediCard" className="h-full w-full object-contain" />
          </div>
          <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">Choose a new password</h1>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-card dark:border-slate-800 dark:bg-slate-900">
          {loading ? (
            <p className="text-center text-sm text-slate-500 dark:text-slate-400">Checking your reset link...</p>
          ) : !user ? (
            <div className="space-y-3 text-center">
              <p className="text-sm text-slate-700 dark:text-slate-200">
                This reset link is invalid or has expired.
              </p>
              <Link
                to="/forgot-password"
                className="inline-block text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"
              >
                Send a new link
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Resetting the password for <span className="font-medium text-slate-700 dark:text-slate-200">{user.email}</span>
              </p>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">New password</label>
                <input
                  type="password"
                  required
                  autoFocus
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">At least {MIN_LENGTH} characters.</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Confirm new password</label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className={inputClass}
                />
              </div>
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-brand-700 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-800 disabled:opacity-60"
              >
                {submitting ? "Saving..." : "Save new password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
