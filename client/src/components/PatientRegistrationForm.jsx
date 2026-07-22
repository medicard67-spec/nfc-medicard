import { useState } from "react";
import api from "../lib/api.js";
import Card from "./Card.jsx";

const emptyForm = {
  name: "", email: "", password: "", ic: "", dob: "", age: "", gender: "Male",
  bloodType: "O+", allergies: "", chronicIllnesses: "", height: "", weight: "",
  phone: "", emergencyContactName: "", emergencyContactPhone: "",
};

export default function PatientRegistrationForm({ onRegistered }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { data } = await api.post("/patients", form);
      setSuccess(data);
      setForm(emptyForm);
      onRegistered?.(data);
    } catch (err) {
      setError(err.response?.data?.error || "Registration failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Full Name" value={form.name} onChange={update("name")} required />
          <Input label="Email (login)" type="email" value={form.email} onChange={update("email")} required />
          <Input label="Temporary Password" value={form.password} onChange={update("password")} required />
          <Input label="IC Number" value={form.ic} onChange={update("ic")} />
          <Input label="Date of Birth" type="date" value={form.dob} onChange={update("dob")} />
          <Input label="Age" type="number" value={form.age} onChange={update("age")} />
          <Select label="Gender" value={form.gender} onChange={update("gender")} options={["Male", "Female", "Other"]} />
          <Select label="Blood Type" value={form.bloodType} onChange={update("bloodType")} options={["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]} />
          <Input label="Allergies (comma separated)" value={form.allergies} onChange={update("allergies")} />
          <Input label="Chronic Illnesses (comma separated)" value={form.chronicIllnesses} onChange={update("chronicIllnesses")} />
          <Input label="Height (cm)" type="number" value={form.height} onChange={update("height")} />
          <Input label="Weight (kg)" type="number" value={form.weight} onChange={update("weight")} />
          <Input label="Phone" value={form.phone} onChange={update("phone")} />
          <Input label="Emergency Contact Name" value={form.emergencyContactName} onChange={update("emergencyContactName")} />
          <Input label="Emergency Contact Phone" value={form.emergencyContactPhone} onChange={update("emergencyContactPhone")} />

          <div className="col-span-full flex items-center gap-3">
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              disabled={saving}
              className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {saving ? "Registering..." : "Register Patient"}
            </button>
          </div>
        </form>
      </Card>

      {success && (
        <Card>
          <p className="text-sm font-semibold text-green-600">
            Patient registered: {success.name} ({success.email}). No NFC card is bound yet — this
            patient can still be looked up via the Patient Directory.
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

function Input({ label, ...props }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">{label}</label>
      <input {...props} className="w-full rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-3 py-2 text-sm" />
    </div>
  );
}

function Select({ label, options, ...props }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">{label}</label>
      <select {...props} className="w-full rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-3 py-2 text-sm">
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}
