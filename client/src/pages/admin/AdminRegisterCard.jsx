import { useEffect, useRef, useState } from "react";
import { Nfc, Search, UserPlus, Usb, QrCode, ArrowRight } from "lucide-react";
import api from "../../lib/api.js";
import Card from "../../components/Card.jsx";
import { isWebNfcSupported, scanOnce } from "../../lib/webNfc.js";
import { isDeskReaderSupported, readCardUid } from "../../lib/deskReader.js";
import { useToast } from "../../context/ToastContext.jsx";
import QrCodeCard from "../../components/QrCodeCard.jsx";
import QrScannerView from "../../components/QrScannerView.jsx";

const emptyForm = {
  name: "", email: "", password: "", ic: "", dob: "", age: "", gender: "Male",
  bloodType: "O+", allergies: "", chronicIllnesses: "", height: "", weight: "",
  phone: "", emergencyContactName: "", emergencyContactPhone: "",
};

export default function AdminRegisterCard() {
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState("new"); // "new" | "existing" — who the scanned card gets bound to
  const [cardUid, setCardUid] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [justAssigned, setJustAssigned] = useState(false);
  const [nfcScanning, setNfcScanning] = useState(false);
  const [deskScanning, setDeskScanning] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const abortRef = useRef(null);
  const manualInputRef = useRef(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Keeps the manual UID field focused so a USB HID card reader (which just
  // "types" the UID into whatever's focused, like a keyboard) can scan cards
  // back-to-back at a registration desk without anyone touching the mouse.
  useEffect(() => {
    if (step === 1) manualInputRef.current?.focus();
  }, [step, error]);

  const handleScan = (e) => {
    e.preventDefault();
    if (!cardUid.trim()) return;
    setStep(2);
  };

  const handleQrDecode = (text) => {
    setShowQr(false);
    setCardUid(text);
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

  const startDeskScan = async () => {
    setError(null);
    setDeskScanning(true);
    try {
      const uid = await readCardUid();
      setCardUid(uid);
      setStep(2);
    } catch (err) {
      setError(err.message || "Desk reader scan failed.");
    } finally {
      setDeskScanning(false);
    }
  };

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const resetAll = () => {
    setForm(emptyForm);
    setCardUid("");
    setStep(1);
    setMode("new");
    setSearch("");
    setSearchResults([]);
    setSelectedPatient(null);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const { data } = await api.post("/nfc/register", { cardUid, ...form });
      setSuccess(data);
      setJustAssigned(false);
      resetAll();
      toast.success(`Card registered to ${data.name}.`);
    } catch (err) {
      setError(err.response?.data?.error || "Registration failed.");
    } finally {
      setSaving(false);
    }
  };

  const runSearch = async (e) => {
    e.preventDefault();
    if (!search.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const { data } = await api.get("/patients", { params: { search: search.trim() } });
      setSearchResults(data.filter((p) => !p.cardUid));
    } catch {
      setError("Search failed.");
    } finally {
      setSearching(false);
    }
  };

  const assignExisting = async () => {
    if (!selectedPatient) return;
    setSaving(true);
    setError(null);
    try {
      const { data } = await api.post(`/patients/${selectedPatient.uid}/card`, { cardUid });
      setSuccess(data);
      setJustAssigned(true);
      resetAll();
      toast.success(`Card assigned to ${data.name}.`);
    } catch (err) {
      setError(err.response?.data?.error || "Assigning the card failed.");
    } finally {
      setSaving(false);
    }
  };

  if (step === 1) {
    const nfcSupported = isWebNfcSupported();
    const deskSupported = isDeskReaderSupported();
    const waiting = nfcScanning || deskScanning;

    const heading = nfcScanning
      ? "Waiting for a tap..."
      : deskScanning
      ? "Waiting for a tap on the desk reader..."
      : "Scan an Unassigned Card";

    const subtext = nfcScanning
      ? "Hold the new card against the back of your device."
      : deskScanning
      ? "Hold the card on the reader — close its own software first."
      : "Tap a phone, use a desk reader, or type the card's UID below.";

    return (
      <div className="mx-auto max-w-md space-y-4">
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Register New Card</h1>

        <Card>
          <div className="flex flex-col items-center gap-5 py-2 text-center">
            <div className="relative flex h-20 w-20 items-center justify-center">
              {waiting && (
                <>
                  <span className="absolute inset-0 animate-ping rounded-full bg-brand-400/30" />
                  <span className="absolute inset-2 animate-ping rounded-full bg-brand-400/20 [animation-delay:200ms]" />
                </>
              )}
              <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-900 dark:text-brand-300">
                <Nfc size={30} strokeWidth={1.75} />
              </span>
            </div>

            <div>
              <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">{heading}</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtext}</p>
            </div>

            {(nfcSupported || deskSupported) && (
              <div className={`grid w-full gap-2 ${nfcSupported && deskSupported ? "grid-cols-2" : "grid-cols-1"}`}>
                {nfcSupported && (
                  <button
                    onClick={startNfcScan}
                    disabled={waiting}
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                  >
                    <Nfc size={15} /> Tap Phone
                  </button>
                )}
                {deskSupported && (
                  <button
                    onClick={startDeskScan}
                    disabled={waiting}
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                  >
                    <Usb size={15} /> Desk Reader
                  </button>
                )}
              </div>
            )}

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <div className="flex w-full items-center gap-3">
              <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              <span className="text-xs font-medium text-slate-400 dark:text-slate-500">or enter UID manually</span>
              <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            </div>

            <form onSubmit={handleScan} className="flex w-full gap-2">
              <input
                ref={manualInputRef}
                value={cardUid}
                onChange={(e) => setCardUid(e.target.value)}
                placeholder="e.g. 0443FADB3D0289"
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-center text-sm tracking-widest focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                required
              />
              <button
                type="submit"
                className="flex items-center justify-center rounded-lg bg-slate-800 px-3.5 text-white hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600"
                aria-label="Continue with this UID"
              >
                <ArrowRight size={17} />
              </button>
            </form>
          </div>
        </Card>

        <Card>
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <QrCode size={44} strokeWidth={1.5} className="text-brand-600 dark:text-brand-300" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Scan a printed QR code (e.g. from a previously issued card) with your device's camera
              instead of tapping or typing.
            </p>
            {showQr ? (
              <div className="w-full space-y-3">
                <QrScannerView onDecode={handleQrDecode} onError={(err) => setError(err.message || "Camera error.")} />
                <button
                  onClick={() => setShowQr(false)}
                  className="w-full rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowQr(true)}
                className="w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Scan QR Code
              </button>
            )}
          </div>
        </Card>

        {success && (
          <Card>
            <p className="text-sm font-semibold text-green-600">
              Card registered to {success.name} (UID: {success.cardUid}).
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {justAssigned
                ? "This patient can keep using their existing login — only the card is new."
                : `A verification email has been sent to ${success.email} — they must confirm it before they can log in.`}
            </p>
            <div className="mt-4">
              <QrCodeCard
                value={success.cardUid}
                label="Optional: print this QR code on the card as a fallback for phones without NFC."
              />
            </div>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Assign Card UID: {cardUid}</h1>

      <div className="flex gap-2">
        <button
          onClick={() => setMode("new")}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${
            mode === "new"
              ? "bg-brand-600 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          }`}
        >
          <UserPlus size={14} /> New Patient
        </button>
        <button
          onClick={() => setMode("existing")}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${
            mode === "existing"
              ? "bg-brand-600 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          }`}
        >
          <Search size={14} /> Existing Patient
        </button>
      </div>

      {mode === "new" ? (
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
      ) : (
        <Card>
          <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
            For a patient who already has an account but no card yet — search by name or IC, then
            assign this card to them. Their login and existing records are untouched.
          </p>
          <form onSubmit={runSearch} className="mb-4 flex gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or IC..."
              className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-3 py-2 text-sm"
            />
            <button
              disabled={searching}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {searching ? "Searching..." : "Search"}
            </button>
          </form>

          {searchResults.length === 0 && !searching && (
            <p className="text-sm text-slate-400">
              No cardless patients found yet — try a search above.
            </p>
          )}

          <div className="space-y-2">
            {searchResults.map((p) => (
              <button
                key={p.uid}
                type="button"
                onClick={() => setSelectedPatient(p)}
                className={`block w-full rounded-lg border px-3 py-2 text-left text-sm ${
                  selectedPatient?.uid === p.uid
                    ? "border-brand-500 bg-brand-50 dark:bg-brand-900/40"
                    : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                }`}
              >
                <span className="font-medium text-slate-800 dark:text-slate-100">{p.name}</span>
                <span className="ml-2 text-xs text-slate-400">{p.ic || p.email}</span>
              </button>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-3">
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50"
            >
              Back
            </button>
            <button
              type="button"
              onClick={assignExisting}
              disabled={saving || !selectedPatient}
              className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {saving ? "Assigning..." : selectedPatient ? `Assign Card to ${selectedPatient.name}` : "Select a patient"}
            </button>
          </div>
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
