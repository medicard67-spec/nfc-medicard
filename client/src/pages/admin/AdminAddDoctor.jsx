import { useState } from "react";
import api from "../../lib/api.js";
import Card from "../../components/Card.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { MALAYSIA_HOSPITALS } from "../../lib/malaysiaHospitals.js";
import { HOSPITAL_DEPARTMENTS } from "../../lib/hospitalDepartments.js";
import { t } from "../../i18n/index.js";

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
      toast.success(t("Doctor account created for {name}.", { name: data.name }));
    } catch (err) {
      setError(err.response?.data?.error || t("Failed to create doctor account."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">{t("Add Doctor")}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t("Create a doctor account. Hospital of origin is restricted to hospitals located in Malaysia.")}
        </p>
      </div>

      <Card>
        <form onSubmit={submit} className="space-y-4">
          <Input label={t("Full Name")} required value={form.name} onChange={update("name")} placeholder={t("Dr. Jane Tan")} />
          <Input
            label={t("Email (login)")}
            type="email"
            required
            value={form.email}
            onChange={update("email")}
            placeholder={t("doctor@hospital.my")}
          />
          <Input
            label={t("Temporary Password")}
            required
            value={form.password}
            onChange={update("password")}
            placeholder={t("At least 6 characters")}
          />
          <Input
            label={t("Department")}
            required
            list="department-suggestions"
            value={form.department}
            onChange={update("department")}
            placeholder={t("e.g. Cardiology")}
          />
          <datalist id="department-suggestions">
            {HOSPITAL_DEPARTMENTS.map((dep) => (
              <option key={dep} value={dep} />
            ))}
          </datalist>

          <div>
            <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
              {t("Hospital of Origin (Malaysia only)")}
            </label>
            <select
              required
              value={form.hospital}
              onChange={update("hospital")}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="" disabled>
                {t("Select a hospital...")}
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
            {saving ? t("Creating...") : t("Create Doctor Account")}
          </button>
        </form>
      </Card>

      {success && (
        <Card>
          <p className="text-sm font-semibold text-green-600 dark:text-green-400">
            {t("Doctor account created for")} {success.name}.
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {t("A verification email has been sent to")} {success.email} {t("— they must confirm it before they can log in.")}
          </p>
        </Card>
      )}
    </div>
  );
}
