import { useState } from "react";
import api from "../../lib/api.js";
import Card from "../../components/Card.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { MALAYSIA_HOSPITALS } from "../../lib/malaysiaHospitals.js";

const emptyForm = {
  name: "",
  email: "",
  password: "",
  department: "",
  hospital: "",
};

function Input({ label, ...props }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">{label}</label>
      <input
        {...props}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
      />
    </div>
  );
}

export default function AdminAddDoctor() {
  const toast = useToast();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const { data } = await api.post("/users", { ...form, role: "doctor" });
      setSuccess(data);
      setForm(emptyForm);
      toast.success(`Doctor account created for ${data.name}.`);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create doctor account.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Add Doctor</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Create a doctor account. Hospital of origin is restricted to hospitals located in
          Malaysia.
        </p>
      </div>

      <Card>
        <form onSubmit={submit} className="space-y-4">
          <Input label="Full Name" required value={form.name} onChange={update("name")} placeholder="Dr. Jane Tan" />
          <Input
            label="Email (login)"
            type="email"
            required
            value={form.email}
            onChange={update("email")}
            placeholder="doctor@hospital.my"
          />
          <Input
            label="Temporary Password"
            required
            value={form.password}
            onChange={update("password")}
            placeholder="At least 6 characters"
          />
          <Input
            label="Department"
            required
            value={form.department}
            onChange={update("department")}
            placeholder="e.g. Cardiology"
          />

          <div>
            <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
              Hospital of Origin (Malaysia only)
            </label>
            <select
              required
              value={form.hospital}
              onChange={update("hospital")}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="" disabled>
                Select a hospital...
              </option>
              {MALAYSIA_HOSPITALS.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <button
            disabled={saving}
            className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? "Creating..." : "Create Doctor Account"}
          </button>
        </form>
      </Card>

      {success && (
        <Card>
          <p className="text-sm font-semibold text-green-600 dark:text-green-400">
            Doctor account created for {success.name}.
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            A verification email has been sent to {success.email} — they must confirm it before
            they can log in.
          </p>
        </Card>
      )}
    </div>
  );
}
