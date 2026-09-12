import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Nfc, QrCode, Keyboard } from "lucide-react";
import api from "../../lib/api.js";
import Card from "../../components/Card.jsx";
import { isWebNfcSupported, scanOnce } from "../../lib/webNfc.js";
import { useToast } from "../../context/ToastContext.jsx";
import QrScannerView from "../../components/QrScannerView.jsx";

export default function DoctorScan() {
  const [cardUid, setCardUid] = useState("");
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [nfcScanning, setNfcScanning] = useState(false);
  // Always available, not just as a fallback when Web NFC is unsupported —
  // useful for typing a known UID directly, or for a USB HID card reader.
  const [showManual, setShowManual] = useState(true);
  const [showQr, setShowQr] = useState(false);
  const abortRef = useRef(null);
  const manualInputRef = useRef(null);
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => () => abortRef.current?.abort(), []);

  // Keeps the manual UID field focused so a USB HID card reader (which just
  // "types" the UID into whatever's focused, like a keyboard) works without
  // anyone touching the mouse — including refocusing after a failed lookup
  // so the next tap is ready to go immediately.
  useEffect(() => {
    if (showManual) manualInputRef.current?.focus();
  }, [showManual, error]);

  const lookupCard = async (uid, method) => {
    setError(null);
    setScanning(true);
    try {
      const { data } = await api.get(`/nfc/${uid.trim()}`, { params: { method } });
      navigate("/doctor/emergency", { state: data });
    } catch (err) {
      setError(err.response?.data?.error || "Failed to read card.");
      setCardUid("");
    } finally {
      setScanning(false);
    }
  };

  const handleManualScan = (e) => {
    e.preventDefault();
    lookupCard(cardUid, "manual");
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
      await lookupCard(uid, "nfc");
    } catch (err) {
      setNfcScanning(false);
      setError(err.message || "NFC scan failed or was cancelled.");
    }
  };

  const handleQrDecode = (text) => {
    setShowQr(false);
    lookupCard(text, "qr");
  };

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Scan NFC Card</h1>

      {isWebNfcSupported() && (
        <Card>
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <Nfc size={44} strokeWidth={1.5} className={`text-brand-600 dark:text-brand-300 ${nfcScanning ? "animate-pulse" : ""}`} />
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
          </div>
        </Card>
      )}

      <Card>
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <QrCode size={44} strokeWidth={1.5} className="text-brand-600 dark:text-brand-300" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No NFC on this device? Scan the QR code printed on the patient's card instead — works
            with any phone camera.
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

      <div className="text-center">
        <button
          onClick={() => setShowManual((v) => !v)}
          className="text-xs font-medium text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
        >
          {showManual ? "Hide manual entry" : "Enter Card UID manually instead"}
        </button>
      </div>

      {showManual && (
        <Card>
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <Keyboard size={44} strokeWidth={1.5} className="text-slate-400 dark:text-slate-500" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Type the UID to simulate a scan, or tap a card on a connected USB card reader — this
              field stays focused so a desk reader can look patients up one after another.
            </p>
            <form onSubmit={handleManualScan} className="w-full space-y-3">
              <input
                ref={manualInputRef}
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
