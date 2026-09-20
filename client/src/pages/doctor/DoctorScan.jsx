import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Nfc, QrCode, Usb, ArrowRight } from "lucide-react";
import api from "../../lib/api.js";
import Card from "../../components/Card.jsx";
import { isNfcSupported, scanOnce } from "../../lib/nfc.js";
import { isDeskReaderSupported, readCardUid } from "../../lib/deskReader.js";
import { useToast } from "../../context/ToastContext.jsx";
import QrScannerView from "../../components/QrScannerView.jsx";

export default function DoctorScan() {
  const [cardUid, setCardUid] = useState("");
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [nfcScanning, setNfcScanning] = useState(false);
  const [deskScanning, setDeskScanning] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const abortRef = useRef(null);
  const manualInputRef = useRef(null);
  const navigate = useNavigate();
  const toast = useToast();

  const nfcSupported = isNfcSupported();
  const deskSupported = isDeskReaderSupported();
  const waiting = nfcScanning || deskScanning;

  useEffect(() => () => abortRef.current?.abort(), []);

  // Keeps the manual UID field focused so a USB HID card reader (which just
  // "types" the UID into whatever's focused, like a keyboard) works without
  // anyone touching the mouse — including refocusing after a failed lookup
  // so the next tap is ready to go immediately.
  useEffect(() => {
    manualInputRef.current?.focus();
  }, [error]);

  const lookupCard = async (uid, method) => {
    setError(null);
    setScanning(true);
    try {
      const { data } = await api.get(`/nfc/${uid.trim()}`, { params: { method } });
      navigate(`/doctor/patient/${data.uid}`);
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

  const startDeskScan = async () => {
    setError(null);
    setDeskScanning(true);
    try {
      const uid = await readCardUid();
      setDeskScanning(false);
      await lookupCard(uid, "nfc");
    } catch (err) {
      setDeskScanning(false);
      setError(err.message || "Desk reader scan failed.");
    }
  };

  const handleQrDecode = (text) => {
    setShowQr(false);
    lookupCard(text, "qr");
  };

  const heading = nfcScanning
    ? "Waiting for a tap..."
    : deskScanning
    ? "Waiting for a tap on the desk reader..."
    : scanning
    ? "Looking up patient..."
    : "Scan a Patient Card";

  const subtext = nfcScanning
    ? "Hold the card against the back of your device."
    : deskScanning
    ? "Hold the card on the reader — close its own software first."
    : scanning
    ? "One moment..."
    : "Tap a phone, use a desk reader, or type the card's UID below.";

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Scan NFC Card</h1>

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
                  disabled={waiting || scanning}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  <Nfc size={15} /> Tap Phone
                </button>
              )}
              {deskSupported && (
                <button
                  onClick={startDeskScan}
                  disabled={waiting || scanning}
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

          <form onSubmit={handleManualScan} className="flex w-full gap-2">
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
              disabled={scanning}
              className="flex items-center justify-center rounded-lg bg-slate-800 px-3.5 text-white hover:bg-slate-900 disabled:opacity-60 dark:bg-slate-700 dark:hover:bg-slate-600"
              aria-label="Look up UID"
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
    </div>
  );
}
