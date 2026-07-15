import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../lib/api.js";
import Card from "../../components/Card.jsx";
import { isWebNfcSupported, scanOnce } from "../../lib/webNfc.js";
import { useToast } from "../../context/ToastContext.jsx";

export default function DoctorScan() {
  const [cardUid, setCardUid] = useState("");
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [nfcScanning, setNfcScanning] = useState(false);
  const [showManual, setShowManual] = useState(!isWebNfcSupported());
  const abortRef = useRef(null);
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => () => abortRef.current?.abort(), []);

  const lookupCard = async (uid) => {
    setError(null);
    setScanning(true);
    try {
      const { data } = await api.get(`/nfc/${uid.trim()}`);
      navigate(`/doctor/patient/${data.uid}`);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to read card.");
    } finally {
      setScanning(false);
    }
  };

  const handleManualScan = (e) => {
    e.preventDefault();
    lookupCard(cardUid);
  };

  const startNfcScan = async () => {
    setError(null);
    setNfcScanning(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      toast.info("Hold the patient's NFC card near your device...", { duration: 6000 });
      const uid = await scanOnce({ signal: controller.signal });
      setNfcScanning(false);
      await lookupCard(uid);
    } catch (err) {
      setNfcScanning(false);
      setError(err.message || "NFC scan failed or was cancelled.");
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Scan NFC Card</h1>

      {isWebNfcSupported() && (
        <Card>
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <span className={`text-5xl ${nfcScanning ? "animate-pulse" : ""}`}>📶</span>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {nfcScanning
                ? "Waiting for a tap — hold the patient's card against the back of your device."
                : "Your device supports real NFC scanning. Tap the button, then hold the patient's physical card near your phone."}
            </p>
            <button
              onClick={startNfcScan}
              disabled={nfcScanning || scanning}
              className="w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {nfcScanning ? "Scanning..." : scanning ? "Looking up patient..." : "Tap NFC Card"}
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
                ? "Enter the card's UID manually if a physical tap isn't available."
                : "No physical NFC reader detected on this device/browser. Enter the card's UID manually to simulate a tap (this is the same lookup a real hardware scan would trigger)."}
            </p>
            <form onSubmit={handleManualScan} className="w-full space-y-3">
              <input
                value={cardUid}
                onChange={(e) => setCardUid(e.target.value)}
                placeholder="e.g. 04A3B2C1"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-3 py-2 text-center text-sm tracking-widest focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                required
              />
              {!isWebNfcSupported() && error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={scanning}
                className="w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {scanning ? "Scanning..." : "Simulate Scan"}
              </button>
            </form>
          </div>
        </Card>
      )}
    </div>
  );
}
