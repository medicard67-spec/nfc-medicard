import { useEffect, useRef, useState } from "react";
import {
  CreditCard, Nfc, Download, RotateCw, CheckCircle2, XCircle, TriangleAlert, Ticket, Siren, Link2,
  Droplet, Phone, Pill, X, History, MailCheck, Smartphone,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import api from "../../lib/api.js";
import { isNfcSupported, scanOnce } from "../../lib/nfc.js";
import { downloadCardPdf } from "../../lib/medicardPrint.js";
import Card from "../../components/Card.jsx";
import CardStatusBadge from "../../components/CardStatusBadge.jsx";
import MediCardVisual from "../../components/MediCardVisual.jsx";
import { t, dateLocale } from "../../i18n/index.js";

const btnPrimary =
  "flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60";
const btnOutline =
  "flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800";

function shortDate(iso) {
  return iso ? new Date(iso).toLocaleDateString(dateLocale(), { day: "numeric", month: "short", year: "numeric" }) : "";
}

// "My MediCard": the patient's card (front/back picture, printable PDF,
// lost/found) and tapping a card on their phone to check it, link a new one
// with an emailed code, check in for today's appointment or show emergency info.
export default function PatientMyCard() {
  const { profile, refreshProfile } = useAuth();
  const [tab, setTab] = useState("card");
  const [card, setCard] = useState(null);

  const loadCard = () => api.get("/cards/mine").then((res) => setCard(res.data)).catch(() => setCard(null));
  useEffect(() => {
    loadCard();
  }, []);

  const changed = async () => {
    await Promise.all([loadCard(), refreshProfile?.()]);
  };

  if (!profile) return null;

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">{t("My MediCard")}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t("Show your card's QR code, or tap your card on your phone.")}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
        {[
          ["card", CreditCard, t("My card")],
          ["tap", Nfc, t("Tap card")],
        ].map(([key, Icon, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold ${
              tab === key
                ? "bg-white text-brand-700 shadow-sm dark:bg-slate-900 dark:text-brand-300"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {tab === "card" ? (
        <MyCardTab profile={profile} card={card} onChanged={changed} goTap={() => setTab("tap")} />
      ) : (
        <TapTab profile={profile} card={card} onChanged={changed} />
      )}
    </div>
  );
}

function MyCardTab({ profile, card, onChanged, goTap }) {
  const toast = useToast();
  const [side, setSide] = useState("back");
  const [busy, setBusy] = useState(false);
  const [confirmLost, setConfirmLost] = useState(false);
  const cardUid = card?.cardUid ?? profile.cardUid;
  const status = card?.status ?? (cardUid ? profile.cardStatus || "active" : "none");

  const report = async (what) => {
    setBusy(true);
    try {
      await api.post(`/cards/${what}`);
      toast.success(what === "lost" ? t("Your card is blocked. It can't open your records now.") : t("Your card works again."));
      setConfirmLost(false);
      await onChanged();
    } catch (err) {
      toast.error(err.response?.data?.error || t("Something went wrong. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    setBusy(true);
    try {
      await downloadCardPdf({ name: profile.name, cardUid });
    } catch {
      toast.error(t("Couldn't create the PDF."));
    } finally {
      setBusy(false);
    }
  };

  if (!cardUid) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300">
            <CreditCard size={26} />
          </span>
          <CardStatusBadge cardUid={null} />
          <p className="font-semibold text-slate-800 dark:text-slate-100">{t("No card linked yet")}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t("Got a new MediCard? Tap it on your phone to link it, or visit the registration desk.")}
          </p>
          <button onClick={goTap} className={btnPrimary}>
            <Nfc size={16} /> {t("Link a new card")}
          </button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {status === "lost" && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm dark:border-red-900 dark:bg-red-950/40">
          <p className="flex items-center gap-1.5 font-semibold text-red-700 dark:text-red-300">
            <TriangleAlert size={16} /> {t("Reported lost on {date}", { date: shortDate(card?.lostAt || profile.cardLostAt) })}
          </p>
          <p className="mt-1 text-red-700/80 dark:text-red-300/80">
            {t("This card can't open your records. Show the QR code on your phone instead, or link a new card.")}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={() => report("found")} disabled={busy} className={btnOutline}>
              <CheckCircle2 size={16} /> {t("I found it")}
            </button>
            <button onClick={goTap} className={btnPrimary}>
              <Nfc size={16} /> {t("Link a new card")}
            </button>
          </div>
        </div>
      )}

      <Card>
        <div className="flex flex-col items-center gap-4">
          <div className="flex w-full items-center justify-between">
            <CardStatusBadge cardUid={cardUid} status={status} />
            <button
              onClick={() => setSide(side === "back" ? "front" : "back")}
              className="flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
            >
              <RotateCw size={14} /> {side === "back" ? t("Show front") : t("Show back")}
            </button>
          </div>
          <div className="w-full max-w-[260px]">
            <MediCardVisual name={profile.name} cardUid={cardUid} side={side} />
          </div>
          <p className="text-center text-xs text-slate-500 dark:text-slate-400">
            {t("Staff can scan the QR code on the back if your card isn't with you.")}
          </p>
          <button onClick={download} disabled={busy} className={`${btnPrimary} w-full`}>
            <Download size={16} /> {t("Download card to print (PDF)")}
          </button>
        </div>
      </Card>

      {status === "active" &&
        (confirmLost ? (
          <Card>
            <p className="font-semibold text-slate-800 dark:text-slate-100">{t("Report this card lost?")}</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {t("It stops opening your records straight away. If you find it, you can turn it back on.")}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => setConfirmLost(false)} className={btnOutline}>{t("Cancel")}</button>
              <button
                onClick={() => report("lost")}
                disabled={busy}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                <TriangleAlert size={16} /> {t("Yes, block it")}
              </button>
            </div>
          </Card>
        ) : (
          <button
            onClick={() => setConfirmLost(true)}
            className="w-full rounded-lg py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            {t("I lost my card")}
          </button>
        ))}

      {card?.history?.length > 0 && (
        <Card>
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <History size={15} /> {t("Card history")}
          </p>
          <ul className="space-y-1.5 text-sm">
            <li className="flex justify-between gap-2">
              <span className="font-mono text-slate-700 dark:text-slate-200">··{cardUid.slice(-4)}</span>
              <span className="text-slate-500 dark:text-slate-400">{status === "lost" ? t("Lost") : t("In use")}</span>
            </li>
            {card.history.map((h) => (
              <li key={h.cardUid} className="flex justify-between gap-2">
                <span className="font-mono text-slate-400 line-through dark:text-slate-500">··{h.cardUid.slice(-4)}</span>
                <span className="text-slate-500 dark:text-slate-400">{t("Replaced {date}", { date: shortDate(h.retiredAt) })}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function TapTab({ profile, card, onChanged }) {
  const toast = useToast();
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null); // response of POST /cards/check
  const [link, setLink] = useState(null); // { emailHint, cardUid }
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [checkin, setCheckin] = useState(null); // ticket or { error }
  const [showEmergency, setShowEmergency] = useState(false);
  const abortRef = useRef(null);

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const reset = () => {
    setResult(null);
    setLink(null);
    setCode("");
    setCodeError(null);
    setCheckin(null);
    setError(null);
  };

  const startScan = async () => {
    reset();
    setScanning(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const uid = await scanOnce({ signal: controller.signal, prompt: t("Hold your MediCard against the back of your phone") });
      const { data } = await api.post("/cards/check", { cardUid: uid });
      setResult(data);
    } catch (err) {
      if (!controller.signal.aborted) setError(err.response?.data?.error || err.message || t("Couldn't read the card. Try again."));
    } finally {
      setScanning(false);
    }
  };

  const cancelScan = () => {
    abortRef.current?.abort();
    setScanning(false);
  };

  const sendCode = async () => {
    setBusy(true);
    setCodeError(null);
    try {
      const { data } = await api.post("/cards/link/start", { cardUid: result.cardUid });
      setLink(data);
      setResendIn(60);
    } catch (err) {
      const body = err.response?.data || {};
      if (body.code === "wait") setResendIn(body.retryAfter || 60);
      setCodeError(linkErrorText(body));
    } finally {
      setBusy(false);
    }
  };

  const confirmCode = async (e) => {
    e.preventDefault();
    setBusy(true);
    setCodeError(null);
    try {
      await api.post("/cards/link/confirm", { code });
      toast.success(t("Your new card is linked."));
      reset();
      await onChanged();
      setResult({ result: "mine", cardUid: link.cardUid, justLinked: true });
    } catch (err) {
      const body = err.response?.data || {};
      if (body.code === "expired" || body.code === "no-request" || body.code === "card-taken") setLink(null);
      setCodeError(linkErrorText(body));
    } finally {
      setBusy(false);
    }
  };

  const checkIn = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/queue/self", { cardUid: result.cardUid });
      setCheckin(data);
    } catch (err) {
      const body = err.response?.data || {};
      setCheckin({
        error: body.code === "no-appointment"
          ? t("You have no appointment today. Please go to the registration desk.")
          : body.error || t("Check-in failed. Please go to the registration desk."),
      });
    } finally {
      setBusy(false);
    }
  };

  if (!isNfcSupported()) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
            <Smartphone size={26} />
          </span>
          <p className="font-semibold text-slate-800 dark:text-slate-100">{t("Tapping needs an NFC phone")}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t("Open the MediCard app on an Android phone with NFC turned on. You can still show the QR code on the My card tab.")}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {!result && (
        <Card>
          <div className="flex flex-col items-center gap-4 py-3 text-center">
            <div className="relative flex h-24 w-24 items-center justify-center">
              {scanning && (
                <>
                  <span className="absolute inset-0 animate-ping rounded-full bg-brand-400/30" />
                  <span className="absolute inset-3 animate-ping rounded-full bg-brand-400/20 [animation-delay:200ms]" />
                </>
              )}
              <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-900 dark:text-brand-300">
                <Nfc size={36} strokeWidth={1.75} />
              </span>
            </div>
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-100">
                {scanning ? t("Waiting for your card...") : t("Tap your MediCard")}
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {t("Hold your MediCard against the back of your phone, near the top, until it buzzes. Make sure NFC is on.")}
              </p>
            </div>
            {scanning ? (
              <button onClick={cancelScan} className={`${btnOutline} w-full`}>{t("Cancel")}</button>
            ) : (
              <button onClick={startScan} className={`${btnPrimary} w-full`}>
                <Nfc size={16} /> {t("Start scanning")}
              </button>
            )}
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          </div>
        </Card>
      )}

      {result && (
        <Card>
          <ResultHeader result={result} />

          {result.result === "mine" && (
            <div className="mt-4 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button onClick={checkIn} disabled={busy} className={btnPrimary}>
                  <Ticket size={16} /> {t("Check in")}
                </button>
                <button
                  onClick={() => setShowEmergency(true)}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
                >
                  <Siren size={16} /> {t("Emergency info")}
                </button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t("Check in works on the day of your appointment.")}</p>
              {checkin && (
                checkin.error ? (
                  <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">{checkin.error}</p>
                ) : (
                  <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
                    <p className="font-semibold">
                      {checkin.alreadyCheckedIn ? t("You're already checked in") : t("Checked in")}
                    </p>
                    <p>{t("Queue number {number} · {room}", { number: checkin.number, room: checkin.room })}</p>
                    <p className="mt-1 text-xs opacity-80">{t("We'll notify you when it's your turn.")}</p>
                  </div>
                )
              )}
            </div>
          )}

          {result.result === "mine-lost" && (
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              {t("Found it? Turn it back on from the My card tab.")}
            </p>
          )}

          {result.result === "unlinked" && result.canLink && !link && (
            <div className="mt-4 space-y-2">
              <button onClick={sendCode} disabled={busy || resendIn > 0} className={`${btnPrimary} w-full`}>
                <Link2 size={16} /> {resendIn > 0 ? t("Send code again in {s}s", { s: resendIn }) : t("Link this card to my account")}
              </button>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {card?.status === "lost"
                  ? t("It replaces your lost card, which stays blocked. We'll email you a code to confirm it's you.")
                  : t("We'll email you a code to confirm it's you.")}
              </p>
              {codeError && <p className="text-sm text-red-600 dark:text-red-400">{codeError}</p>}
            </div>
          )}

          {link && (
            <form onSubmit={confirmCode} className="mt-4 space-y-3">
              <p className="flex items-start gap-2 rounded-lg bg-brand-50 p-3 text-sm text-brand-800 dark:bg-brand-900/40 dark:text-brand-200">
                <MailCheck size={18} className="mt-0.5 flex-shrink-0" />
                {t("We sent a code to {email}. It works for {n} minutes.", { email: link.emailHint, n: link.expiresInMinutes })}
              </p>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, "").slice(0, 10))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                className="w-full rounded-lg border border-slate-300 px-3 py-3 text-center font-mono text-2xl tracking-[0.4em] focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                autoFocus
              />
              {codeError && <p className="text-sm text-red-600 dark:text-red-400">{codeError}</p>}
              <button type="submit" disabled={busy || code.length < 6} className={`${btnPrimary} w-full`}>
                <Link2 size={16} /> {t("Link card")}
              </button>
              <button type="button" onClick={sendCode} disabled={busy || resendIn > 0} className={`${btnOutline} w-full`}>
                {resendIn > 0 ? t("Send code again in {s}s", { s: resendIn }) : t("Send a new code")}
              </button>
            </form>
          )}

          <button onClick={startScan} className={`${btnOutline} mt-4 w-full`}>
            <Nfc size={16} /> {t("Scan another card")}
          </button>
        </Card>
      )}

      {showEmergency && <EmergencyInfo profile={profile} onClose={() => setShowEmergency(false)} />}
    </div>
  );
}

function linkErrorText(body) {
  switch (body.code) {
    case "wrong-code":
      return t("That code is not right. {n} tries left.", { n: body.attemptsLeft });
    case "expired":
      return t("This code has expired. Tap your card again to get a new one.");
    case "no-request":
      return t("Tap your card again to get a new code.");
    case "card-taken":
      return t("This card can't be linked. Please visit the registration desk.");
    case "has-card":
      return t("You already have an active card. Report it lost first to replace it.");
    case "no-email":
      return t("Your account has no email. Please link your card at the registration desk.");
    case "wait":
      return t("Please wait a moment before asking for another code.");
    case "email-failed":
      return t("We couldn't send the email. Please try again later or visit the registration desk.");
    case "bad-code":
      return t("Enter the code from the email.");
    default:
      return body.error || t("Something went wrong. Please try again.");
  }
}

function ResultHeader({ result }) {
  const short = `··${String(result.cardUid || "").slice(-4)}`;
  const views = {
    mine: [CheckCircle2, "text-emerald-600 dark:text-emerald-400", result.justLinked ? t("Card linked!") : t("This is your MediCard"), t("Card {uid} · active", { uid: short })],
    "mine-lost": [TriangleAlert, "text-red-600 dark:text-red-400", t("This is your card, but it's reported lost"), t("It can't open your records while it's blocked.")],
    "mine-old": [XCircle, "text-slate-500 dark:text-slate-400", t("This is your old card"), t("It was replaced and no longer works.")],
    "not-yours": [XCircle, "text-red-600 dark:text-red-400", t("This card isn't linked to your account"), t("If you found it, please hand it to the hospital.")],
    unlinked: [Nfc, "text-brand-600 dark:text-brand-400", t("This is a new card"), result.canLink ? t("It isn't linked to anyone yet.") : t("You already have an active card. Report it lost first to replace it.")],
  };
  const [Icon, color, title, sub] = views[result.result] || views["not-yours"];
  return (
    <div className="flex items-start gap-3">
      <Icon size={30} className={`flex-shrink-0 ${color}`} />
      <div>
        <p className="font-semibold text-slate-800 dark:text-slate-100">{title}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{sub}</p>
      </div>
    </div>
  );
}

// Big, simple screen to show a paramedic or nurse.
function EmergencyInfo({ profile, onClose }) {
  const [meds, setMeds] = useState(null);
  useEffect(() => {
    api
      .get("/medications", { params: { patientId: profile.uid } })
      .then((res) => setMeds((res.data || []).filter((m) => !m.endDate || m.endDate >= new Date().toISOString().slice(0, 10))))
      .catch(() => setMeds([]));
  }, [profile.uid]);

  const row = (label, value, strong) => (
    <div className="border-b border-slate-100 py-2.5 last:border-0 dark:border-slate-800">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-0.5 ${strong ? "text-lg font-bold text-red-700 dark:text-red-300" : "text-slate-800 dark:text-slate-100"}`}>{value || "—"}</p>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 dark:bg-slate-900 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="flex items-center gap-2 text-lg font-bold text-red-600 dark:text-red-400">
            <Siren size={22} /> {t("Emergency info")}
          </p>
          <button onClick={onClose} aria-label={t("Close")} className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X size={20} />
          </button>
        </div>
        <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{profile.name}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {[profile.age != null ? `${profile.age} ${t("yrs")}` : null, profile.gender ? t(profile.gender) : null].filter(Boolean).join(" · ")}
        </p>
        <div className="mt-3">
          {row(<span className="inline-flex items-center gap-1"><Droplet size={12} /> {t("Blood type")}</span>, profile.bloodType, true)}
          {row(t("Allergies"), (profile.allergies || []).join(", "), (profile.allergies || []).length > 0)}
          {row(t("Chronic Condition"), (profile.chronicIllnesses || []).join(", "))}
          {row(
            <span className="inline-flex items-center gap-1"><Pill size={12} /> {t("Medications")}</span>,
            meds === null ? t("Loading...") : meds.map((m) => [m.name, m.dosage].filter(Boolean).join(" ")).join(", "),
          )}
          {row(
            <span className="inline-flex items-center gap-1"><Phone size={12} /> {t("Emergency contact")}</span>,
            profile.emergencyContactName || profile.emergencyContactPhone ? (
              <span>
                {profile.emergencyContactName}{" "}
                {profile.emergencyContactPhone && (
                  <a href={`tel:${profile.emergencyContactPhone}`} className="font-semibold text-brand-600 underline dark:text-brand-400">
                    {profile.emergencyContactPhone}
                  </a>
                )}
              </span>
            ) : null,
          )}
        </div>
      </div>
    </div>
  );
}
