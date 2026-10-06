import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, MailCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import BackgroundImage from "../components/BackgroundImage.jsx";
import logo from "../assets/logo.png";

export default function ForgotPassword() {
  const location = useLocation();
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState(location.state?.email || "");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setError(err.message || "Couldn't send the reset email. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <BackgroundImage />
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-white p-1.5 shadow-soft ring-1 ring-slate-200 dark:ring-slate-800">
            <img src={logo} alt="NFC MediCard" className="h-full w-full object-contain" />
          </div>
          <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">Reset your password</h1>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-card dark:border-slate-800 dark:bg-slate-900">
          {sent ? (
            <div className="space-y-3 text-center">
              <MailCheck size={36} strokeWidth={1.5} className="mx-auto text-brand-600 dark:text-brand-300" />
              <p className="text-sm text-slate-700 dark:text-slate-200">
                If an account exists for <span className="font-semibold">{email.trim()}</span>, we've sent a link to
                reset your password.
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Check your spam folder if it doesn't arrive in a few minutes. The link expires after an hour.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Enter the email you sign in with and we'll send you a link to choose a new password.
              </p>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Email</label>
                <input
                  type="email"
                  required
                  autoFocus
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  placeholder="you@medicard.dev"
                />
              </div>
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-brand-700 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-800 disabled:opacity-60"
              >
                {submitting ? "Sending..." : "Send reset link"}
              </button>
            </form>
          )}
        </div>

        <Link
          to="/login"
          className="mt-4 flex items-center justify-center gap-1.5 text-sm font-medium text-slate-600 hover:text-brand-700 dark:text-slate-300 dark:hover:text-brand-300"
        >
          <ArrowLeft size={15} /> Back to sign in
        </Link>
      </div>
    </div>
  );
}
