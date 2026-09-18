import { useEffect, useRef, useState } from "react";
import { Nfc, Usb, QrCode, ArrowRight, ClipboardList, DoorOpen, RotateCcw } from "lucide-react";
import api from "../../lib/api.js";
import Card from "../../components/Card.jsx";
import Avatar from "../../components/Avatar.jsx";
import { isWebNfcSupported, scanOnce } from "../../lib/webNfc.js";
import { isDeskReaderSupported, readCardUid } from "../../lib/deskReader.js";
import { useToast } from "../../context/ToastContext.jsx";
import QrScannerView from "../../components/QrScannerView.jsx";

const ROOM_SUGGESTIONS = ["Room 1", "Room 2", "Room 3", "Room 4", "Consultation A", "Consultation B"];

export default function AdminCheckIn() {
  const toast = useToast();
  const [step, setStep] = useState("scan"); // scan | assign | done
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [nfcScanning, setNfcScanning] = useState(false);
  const [deskScanning, setDeskScanning] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [cardUid, setCardUid] = useState("");
  const [patient, setPatient] = useState(null);
  const [room, setRoom] = useState("");
  const [saving, setSaving] = useState(false);
  const [ticket, setTicket] = useState(null);
  const [today, setToday] = useState([]);
  const [loadingToday, setLoadingToday] = useState(true);
  const abortRef = useRef(null);
  const manualInputRef = useRef(null);

  const nfcSupported = isWebNfcSupported();
  const deskSupported = isDeskReaderSupported();
  const waiting = nfcScanning || deskScanning;

  const loadToday = () => {
    setLoadingToday(true);
    api.get("/queue").then((res) => setToday(res.data)).finally(() => setLoadingToday(false));
  };

  useEffect(loadToday, []);
  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    if (step === "scan") manualInputRef.current?.focus();
  }, [step, error]);

  const lookupPatient = async (uid, method) => {
    setError(null);
    setScanning(true);
    try {
      const { data } = await api.get(`/nfc/${uid.trim()}`, { params: { method } });
      setPatient(data);
      setRoom("");
      setStep("assign");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to read card.");
    } finally {
      setScanning(false);
    }
  };

  const handleManualScan = (e) => {
    e.preventDefault();
    lookupPatient(cardUid, "manual");
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
      await lookupPatient(uid, "nfc");
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
      await lookupPatient(uid, "nfc");
    } catch (err) {
      setDeskScanning(false);
      setError(err.message || "Desk reader scan failed.");
    }
  };

  const handleQrDecode = (text) => {
    setShowQr(false);
    lookupPatient(text, "qr");
  };

  const assignRoom = async (e) => {
    e.preventDefault();
    if (!room.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const { data } = await api.post("/queue", { patientId: patient.uid, room: room.trim() });
      setTicket(data);
      setStep("done");
      loadToday();
    } catch (err) {
      setError(err.response?.data?.error || "Check-in failed.");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setStep("scan");
    setCardUid("");
    setPatient(null);
    setRoom("");
    setTicket(null);
    setError(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Registration Desk</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Scan a patient in and hand them a queue number and room — instead of opening their full
          record.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          {step === "scan" && (
            <>
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
                    <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                      {nfcScanning ? "Waiting for a tap..." : deskScanning ? "Waiting for a tap on the desk reader..." : scanning ? "Looking up patient..." : "Scan a Patient Card"}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Tap a phone, use a desk reader, or type the card's UID below.
                    </p>
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
                    Scan the QR code printed on the patient's card instead of tapping or typing.
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
            </>
          )}

          {step === "assign" && patient && (
            <Card>
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
                <Avatar name={patient.name} url={patient.avatarUrl} size="md" />
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-100">{patient.name}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{patient.gender}, {patient.age ?? "?"} yrs</p>
                </div>
              </div>

              <form onSubmit={assignRoom} className="mt-4 space-y-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Room</label>
                  <input
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    placeholder="e.g. Room 3"
                    list="room-suggestions"
                    autoFocus
                    required
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <datalist id="room-suggestions">
                    {ROOM_SUGGESTIONS.map((r) => (
                      <option key={r} value={r} />
                    ))}
                  </datalist>
                </div>
                {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={reset}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={saving}
                    className="flex-1 rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                  >
                    {saving ? "Checking in..." : "Check In & Assign Room"}
                  </button>
                </div>
              </form>
            </Card>
          )}

          {step === "done" && ticket && (
            <Card>
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-50 dark:bg-brand-900">
                  <span className="text-3xl font-bold text-brand-700 dark:text-brand-300">#{ticket.number}</span>
                </div>
                <div>
                  <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">{ticket.patientName}</p>
                  <p className="mt-1 flex items-center justify-center gap-1.5 text-slate-600 dark:text-slate-300">
                    <DoorOpen size={16} /> {ticket.room}
                  </p>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Show the patient their number — they can also see it on their own account.
                </p>
                <button
                  onClick={reset}
                  className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  <RotateCcw size={15} /> Check In Next Patient
                </button>
              </div>
            </Card>
          )}
        </div>

        <Card title="Today's Queue">
          {loadingToday ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">Loading...</p>
          ) : today.length === 0 ? (
            <div className="py-4 text-center">
              <ClipboardList size={28} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
              <p className="text-sm text-slate-400 dark:text-slate-500">No one checked in yet today.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {today.map((t) => (
                <li key={t.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{t.patientName}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t.room}</p>
                  </div>
                  <span className="text-sm font-bold text-brand-700 dark:text-brand-300">#{t.number}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
