import { useEffect, useRef, useState } from "react";
import api from "../../lib/api.js";
import Card from "../../components/Card.jsx";
import { isWebNfcSupported, scanOnce } from "../../lib/webNfc.js";
import { useToast } from "../../context/ToastContext.jsx";

const emptyForm = {
  name: "", email: "", password: "", ic: "", dob: "", age: "", gender: "Male",
  bloodType: "O+", allergies: "", chronicIllnesses: "", height: "", weight: "",
  phone: "", emergencyContactName: "", emergencyContactPhone: "",
};

export default function AdminRegisterCard() {
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [cardUid, setCardUid] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [nfcScanning, setNfcScanning] = useState(false);
  const [showManual, setShowManual] = useState(!isWebNfcSupported());
  const abortRef = useRef(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const handleScan = (e) => {
    e.preventDefault();
    if (!cardUid.trim()) return;
    setStep(2);
  };

  const startNfcScan = async () => {
    setError(null);
    setNfcScanning(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      toast.info("Hold the unassigned NFC card near your device...", { duration: 6000 });
      const uid = await scanOnce({ signal: controller.signal });
      setCardUid(uid);
      setStep(2);
    } catch (err) {
      setError(err.message || "NFC scan failed or was cancelled.");
    } finally {
      setNfcScanning(false);
    }
  };

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const { data } = await api.post("/nfc/register", { cardUid, ...form });
      setSuccess(data);
      setForm(emptyForm);
      setCardUid("");
      setStep(1);
      toast.success(`Card registered to ${data.name}.`);
    } catch (err) {
      setError(err.response?.data?.error || "Registration failed.");
    } finally {
      setSaving(false);
    }
  };

  if (step === 1) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Register New Card</h1>

        {isWebNfcSupported() && (
          <Card>
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <span className={`text-5xl ${nfcScanning ? "animate-pulse" : ""}`}>📶</span>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {nfcScanning
                  ? "Waiting for a tap — hold the unassigned card against the back of your device."
                  : "Your device supports real NFC scanning. Tap the button, then hold the new physical card near your phone."}
              </p>
              <button
                onClick={startNfcScan}
                disabled={nfcScanning}
                className="w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {nfcScanning ? "Scanning..." : "Tap New NFC Card"}
              </button>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                onClick={() => setShowManual((v) => !v)}
                className="text-xs font-medium text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
              >
                {showManual ? "Hide manual entry" : "Enter Card UID manually instead"}
              </button>
            </div>
          </Card>
        )}

        {showManual && (
          <Card>
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <span className="text-5xl">⌨️</span>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {isWebNfcSupported()
                  ? "Enter the unassigned card's UID manually if a physical tap isn't available."
                  : "No physical NFC reader detected on this device/browser. Enter the unassigned card's UID manually to simulate scanning it in."}
              </p>
              <form onSubmit={handleScan} className="w-full space-y-3">
                <input
                  value={cardUid}
                  onChange={(e) => setCardUid(e.target.value)}
                  placeholder="e.g. 09F1A2B3"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-3 py-2 text-center text-sm tracking-widest"
                  required
                />
                <button className="w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                  Scan New NFC Card
                </button>
              </form>
            </div>
          </Card>
        )}

        {success && (
          <Card>
            <p className="text-sm font-semibold text-green-600">
              Card registered to {success.name} (UID: {success.cardUid}).
            </p>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Patient Information Input</h1>
      <Card title={`Card UID: ${cardUid}`}>
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
              type="button"
              onClick={() => setStep(1)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50"
            >
              Back
            </button>
            <button
              disabled={saving}
              className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {saving ? "Registering..." : "Confirm Registration"}
            </button>
          </div>
        </form>
      </Card>
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
