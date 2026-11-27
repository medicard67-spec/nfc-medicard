import { useEffect, useRef, useState } from "react";
import {
  CreditCard, Nfc, Download, CheckCircle2, TriangleAlert, Plus, X, History, MailCheck, Smartphone, Trash2, Settings,
  Wallet as WalletIcon,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import api from "../../lib/api.js";
import { isNfcSupported, scanOnce } from "../../lib/nfc.js";
import { PhoneCard, phoneCardStatus, hasPhoneCardPlugin } from "../../lib/phoneCard.js";
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

// "My MediCard", wallet style: the patient's card on screen (tap to flip to
// the QR side). Like a bank card in a phone wallet, it can be added to the
// phone: tap the physical card on the phone, confirm with the emailed code,
// and from then on the phone itself is tapped on the hospital's reader.
export default function PatientMyCard() {
  const { profile, refreshProfile } = useAuth();
  const toast = useToast();
  const [card, setCard] = useState(null);
  const [phone, setPhone] = useState(null); // native status, null outside the Android app
  const [wallet, setWallet] = useState(null); // { available, name } of the phone maker's wallet
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmLost, setConfirmLost] = useState(false);

  const load = async () => {
    const [mine, status] = await Promise.all([
      api.get("/cards/mine").then((res) => res.data).catch(() => null),
      phoneCardStatus(),
    ]);
    // the card was removed from this phone elsewhere: forget the token here too
    if (mine && status?.hasCard && !mine.phones?.some((p) => p.id === status.cardId)) {
      await PhoneCard.clearCard().catch(() => {});
      status.hasCard = false;
      status.cardId = null;
    }
    setCard(mine);
    setPhone(status);
  };

  // while this screen is open, the phone answers readers as this app's card first
  useEffect(() => {
    if (!hasPhoneCardPlugin()) return;
    PhoneCard.setActive({ active: true }).catch(() => {});
    return () => PhoneCard.setActive({ active: false }).catch(() => {});
  }, []);

  useEffect(() => {
    if (hasPhoneCardPlugin()) PhoneCard.walletInfo().then(setWallet).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    // NFC may be switched on in Settings while we're away
    const onFocus = () => phoneCardStatus().then((s) => s && setPhone((p) => ({ ...p, ...s })));
    document.addEventListener("visibilitychange", onFocus);
    return () => document.removeEventListener("visibilitychange", onFocus);
  }, []);

  const changed = async () => {
    await Promise.all([load(), refreshProfile?.()]);
  };

  if (!profile) return null;

  const cardUid = card?.cardUid ?? profile.cardUid;
  const status = card?.status ?? (cardUid ? profile.cardStatus || "active" : "none");
  const thisPhone = phone?.hasCard ? card?.phones?.find((p) => p.id === phone.cardId) : null;
  const onThisPhone = Boolean(thisPhone?.works);
  const canAddToPhone = Boolean(phone?.hce);
  const canScan = isNfcSupported();

  const report = async (what) => {
    setBusy(true);
    try {
      await api.post(`/cards/${what}`);
      toast.success(what === "lost" ? t("Your card is blocked. It can't open your records now.") : t("Your card works again."));
      setConfirmLost(false);
      await changed();
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

  const removePhone = async (id, here) => {
    setBusy(true);
    try {
      await api.delete(`/cards/online/${id}`);
      if (here) await PhoneCard.clearCard();
      toast.success(here ? t("Your MediCard was removed from this phone.") : t("Removed. That phone can't be used as your card anymore."));
      await changed();
    } catch (err) {
      toast.error(err.response?.data?.error || t("Something went wrong. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  if (adding) {
    return (
      <div className="mx-auto max-w-md">
        <AddCardFlow
          profile={profile}
          card={card}
          phone={phone}
          onClose={() => setAdding(false)}
          onDone={async () => {
            await changed();
          }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">{t("My MediCard")}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t("Your card, always on your phone.")}</p>
      </div>

      {!cardUid ? (
        <Card>
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300">
              <CreditCard size={26} />
            </span>
            <CardStatusBadge cardUid={null} />
            <p className="font-semibold text-slate-800 dark:text-slate-100">{t("No card linked yet")}</p>
            {canScan ? (
              <>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {t("Got your MediCard? Add it here by tapping it on the back of your phone.")}
                </p>
                <button onClick={() => setAdding(true)} className={btnPrimary}>
                  <Plus size={16} /> {t("Add my MediCard")}
                </button>
              </>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t("Open the MediCard app on an Android phone with NFC to add your card, or visit the registration desk.")}
              </p>
            )}
          </div>
        </Card>
      ) : (
        <>
          {status === "lost" && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm dark:border-red-900 dark:bg-red-950/40">
              <p className="flex items-center gap-1.5 font-semibold text-red-700 dark:text-red-300">
                <TriangleAlert size={16} /> {t("Reported lost on {date}", { date: shortDate(card?.lostAt || profile.cardLostAt) })}
              </p>
              <p className="mt-1 text-red-700/80 dark:text-red-300/80">
                {t("Your card and the phones it was added to can't open your records now. Found it? Turn it back on. Got a new card? Add it.")}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button onClick={() => report("found")} disabled={busy} className={btnOutline}>
                  <CheckCircle2 size={16} /> {t("I found it")}
                </button>
                {canScan && (
                  <button onClick={() => setAdding(true)} className={btnPrimary}>
                    <Plus size={16} /> {t("Add new card")}
                  </button>
                )}
              </div>
            </div>
          )}

          <WalletCard name={profile.name} cardUid={cardUid} dimmed={status === "lost"} />

          <div className="flex justify-center">
            <CardStatusBadge cardUid={cardUid} status={status} />
          </div>

          {status === "active" && (
            onThisPhone ? (
              <ReadyToTap nfcOn={phone?.nfcOn} />
            ) : canAddToPhone ? (
              <Card>
                <div className="flex items-start gap-3">
                  <Smartphone size={22} className="mt-0.5 flex-shrink-0 text-brand-600 dark:text-brand-400" />
                  <div className="flex-1">
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{t("Use your phone as your MediCard")}</p>
                    <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                      {t("Add your card to this phone, then tap the phone on the hospital's reader, just like paying with your phone.")}
                    </p>
                  </div>
                </div>
                <button onClick={() => setAdding(true)} className={`${btnPrimary} mt-3 w-full`}>
                  <Plus size={16} /> {t("Add to this phone")}
                </button>
              </Card>
            ) : null
          )}

          {status === "active" && wallet && <WalletCopy wallet={wallet} />}

          <Card>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              <ActionRow icon={Download} label={t("Download card to print (PDF)")} onClick={download} disabled={busy} />
              {thisPhone && (
                <ActionRow icon={Trash2} label={t("Remove from this phone")} onClick={() => removePhone(thisPhone.id, true)} disabled={busy} />
              )}
              {status === "active" && !confirmLost && (
                <ActionRow icon={TriangleAlert} label={t("I lost my card")} onClick={() => setConfirmLost(true)} danger />
              )}
            </div>
            {confirmLost && (
              <div className="mt-3 rounded-lg bg-red-50 p-3 dark:bg-red-950/40">
                <p className="font-semibold text-slate-800 dark:text-slate-100">{t("Report this card lost?")}</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {t("The card and the phones it was added to stop opening your records straight away. If you find it, you can turn it back on.")}
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
              </div>
            )}
          </Card>

          {card?.phones?.length > 0 && (
            <Card>
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <Smartphone size={15} /> {t("Phones with your MediCard")}
              </p>
              <ul className="space-y-2 text-sm">
                {card.phones.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-700 dark:text-slate-200">
                        {p.deviceName || t("Phone")} {p.id === thisPhone?.id && <span className="text-xs font-normal text-brand-600 dark:text-brand-400">({t("this phone")})</span>}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {p.works ? t("Added {date}", { date: shortDate(p.addedAt) }) : t("Old card, no longer works")}
                      </p>
                    </div>
                    <button
                      onClick={() => removePhone(p.id, p.id === thisPhone?.id)}
                      disabled={busy}
                      aria-label={t("Remove")}
                      className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}

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
        </>
      )}
    </div>
  );
}

// The card itself, big like in a phone wallet. Tap it to flip to the QR side.
function WalletCard({ name, cardUid, dimmed }) {
  const [side, setSide] = useState("front");
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={() => setSide(side === "front" ? "back" : "front")}
        aria-label={side === "front" ? t("Show back") : t("Show front")}
        className={`w-[min(78vw,300px)] overflow-hidden rounded-2xl shadow-xl ring-1 ring-slate-200 transition-transform active:scale-[0.98] dark:ring-slate-700 ${dimmed ? "opacity-50 grayscale" : ""}`}
      >
        <div key={side} className="animate-[cardflip_0.35s_ease-out]">
          <MediCardVisual name={name} cardUid={cardUid} side={side} />
        </div>
      </button>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {side === "front" ? t("Tap the card to see the QR code") : t("Staff can scan this QR code. Tap to flip back.")}
      </p>
      <style>{"@keyframes cardflip{from{transform:perspective(800px) rotateY(80deg);opacity:.4}to{transform:none;opacity:1}}"}</style>
    </div>
  );
}

function ReadyToTap({ nfcOn }) {
  if (nfcOn === false) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/40">
        <p className="flex items-center gap-1.5 font-semibold text-amber-800 dark:text-amber-200">
          <TriangleAlert size={16} /> {t("NFC is off")}
        </p>
        <p className="mt-1 text-amber-800/80 dark:text-amber-200/80">{t("Turn on NFC so your phone can be tapped as your MediCard.")}</p>
        <button onClick={() => PhoneCard.openNfcSettings().catch(() => {})} className={`${btnOutline} mt-3 w-full bg-white dark:bg-slate-900`}>
          <Settings size={16} /> {t("Turn on NFC")}
        </button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
      <div className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/30" />
        <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white">
          <Nfc size={24} />
        </span>
      </div>
      <div className="text-sm">
        <p className="font-semibold text-emerald-800 dark:text-emerald-200">{t("Ready to tap")}</p>
        <p className="text-emerald-800/80 dark:text-emerald-200/80">
          {t("Keep this screen open and hold the back of your phone against the staff's phone or reader.")}
        </p>
      </div>
    </div>
  );
}

// The USB desk scanner only reads a card's fixed ID, which only the phone
// maker's wallet can copy (like FinEasy/OPPO Wallet). We send the patient there.
function WalletCopy({ wallet }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);

  const openWallet = async () => {
    try {
      await PhoneCard.openWallet();
    } catch {
      toast.error(t("Couldn't open the wallet app."));
    }
  };

  return (
    <Card>
      <div className="flex items-start gap-3">
        <WalletIcon size={22} className="mt-0.5 flex-shrink-0 text-brand-600 dark:text-brand-400" />
        <div className="flex-1">
          <p className="font-semibold text-slate-800 dark:text-slate-100">{t("Use your phone on the desk scanner")}</p>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {wallet.available
              ? t("Copy your MediCard into {wallet}. Your phone then works on every MediCard scanner, just like the card.", { wallet: wallet.name })
              : t("Your phone's wallet can't copy cards, so the desk scanner can't read your phone. Use your card, or ask staff to scan your phone with their phone.")}
          </p>
        </div>
      </div>
      {wallet.available && (
        <>
          <button onClick={openWallet} className={`${btnPrimary} mt-3 w-full`}>
            <WalletIcon size={16} /> {t("Add to {wallet}", { wallet: wallet.name })}
          </button>
          <button
            onClick={() => setOpen(!open)}
            className="mt-2 w-full text-center text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            {open ? t("Hide steps") : t("How to copy your card")}
          </button>
          {open && (
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-slate-600 dark:text-slate-300">
              <li>{t("Tap \"Add to {wallet}\" above.", { wallet: wallet.name })}</li>
              <li>{t("Go to Access cards (sometimes called Door keys or Cards) and tap Add.")}</li>
              <li>{t("Choose \"Copy physical card\" (or \"Simulate card\").")}</li>
              <li>{t("Hold your MediCard on the back of your phone until it's copied.")}</li>
              <li>{t("Name it MediCard. Now tap your unlocked phone on the hospital's scanner.")}</li>
              <li className="text-slate-500 dark:text-slate-400">
                {t("If you report your card lost, the copy on your phone is blocked too.")}
              </li>
            </ol>
          )}
        </>
      )}
    </Card>
  );
}

function ActionRow({ icon: Icon, label, onClick, disabled, danger }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-3 py-3 text-left text-sm font-medium disabled:opacity-60 ${
        danger ? "text-red-600 dark:text-red-400" : "text-slate-700 dark:text-slate-200"
      }`}
    >
      <Icon size={18} /> {label}
    </button>
  );
}

// FinEasy-style "add card": 1) tap the physical card on the back of the
// phone, 2) type the code we email you, 3) done -- the card is on this phone.
function AddCardFlow({ card, phone, onClose, onDone }) {
  const [step, setStep] = useState("tap"); // tap | code | done
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const [link, setLink] = useState(null); // { emailHint, expiresInMinutes, cardUid, mode }
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [result, setResult] = useState(null); // { linked, onPhone }
  const abortRef = useRef(null);
  const addToPhone = Boolean(phone?.hce);

  useEffect(() => {
    startScan();
    return () => abortRef.current?.abort();
  }, []);
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const requestCode = async (cardUid) => {
    const { data } = await api.post("/cards/link/start", { cardUid });
    setLink(data);
    setCode("");
    setResendIn(60);
    setStep("code");
  };

  const startScan = async () => {
    setError(null);
    setScanning(true);
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    try {
      const uid = await scanOnce({ signal: controller.signal, prompt: t("Hold your MediCard against the back of your phone") });
      await requestCode(uid);
    } catch (err) {
      if (!controller.signal.aborted) {
        const body = err.response?.data;
        if (body?.code === "wait") setResendIn(body.retryAfter || 60);
        setError(body ? linkErrorText(body) : err.message || t("Couldn't read the card. Try again."));
      }
    } finally {
      if (!controller.signal.aborted) setScanning(false);
    }
  };

  const resend = async () => {
    setBusy(true);
    setError(null);
    try {
      await requestCode(link.cardUid);
    } catch (err) {
      const body = err.response?.data || {};
      if (body.code === "wait") setResendIn(body.retryAfter || 60);
      setError(linkErrorText(body));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.post("/cards/link/confirm", {
        code,
        phone: addToPhone,
        deviceName: phone?.deviceName,
        replaceId: phone?.cardId || undefined,
      });
      if (data.onlineCard) await PhoneCard.setCard({ token: data.onlineCard.token, id: data.onlineCard.id });
      setResult({ linked: link.mode === "link", onPhone: Boolean(data.onlineCard) });
      setStep("done");
      await onDone();
    } catch (err) {
      const body = err.response?.data || {};
      if (["expired", "no-request", "card-taken", "card-lost"].includes(body.code)) {
        setStep("tap");
        setLink(null);
      }
      setError(linkErrorText(body));
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    abortRef.current?.abort();
    onClose();
  };

  const steps = [t("Tap card"), t("Confirm"), t("Done")];
  const stepIndex = { tap: 0, code: 1, done: 2 }[step];

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-lg font-bold text-slate-800 dark:text-slate-100">
          {card?.cardUid && card.status === "active" ? t("Add card to this phone") : t("Add my MediCard")}
        </p>
        <button onClick={close} aria-label={t("Close")} className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
          <X size={20} />
        </button>
      </div>

      <ol className="mb-5 flex items-center gap-2 text-xs font-medium">
        {steps.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-1.5">
            <span
              className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${
                i <= stepIndex ? "bg-brand-600 text-white" : "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300"
              }`}
            >
              {i < stepIndex ? <CheckCircle2 size={14} /> : i + 1}
            </span>
            <span className={i <= stepIndex ? "text-slate-800 dark:text-slate-100" : "text-slate-400"}>{label}</span>
          </li>
        ))}
      </ol>

      {step === "tap" && (
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <div className="relative flex h-28 w-28 items-center justify-center">
            {scanning && (
              <>
                <span className="absolute inset-0 animate-ping rounded-full bg-brand-400/30" />
                <span className="absolute inset-3 animate-ping rounded-full bg-brand-400/20 [animation-delay:200ms]" />
              </>
            )}
            <span className="relative flex h-24 w-24 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-900 dark:text-brand-300">
              <Nfc size={42} strokeWidth={1.75} />
            </span>
          </div>
          <div>
            <p className="font-semibold text-slate-800 dark:text-slate-100">
              {scanning ? t("Hold your MediCard on the back of your phone") : t("Tap your MediCard")}
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {t("Keep it still near the top of the phone until it buzzes. Make sure NFC is on.")}
            </p>
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {!scanning && (
            <button onClick={startScan} disabled={resendIn > 0 && Boolean(error)} className={`${btnPrimary} w-full`}>
              <Nfc size={16} /> {t("Try again")}
            </button>
          )}
        </div>
      )}

      {step === "code" && link && (
        <form onSubmit={confirm} className="space-y-3">
          <p className="flex items-start gap-2 rounded-lg bg-brand-50 p-3 text-sm text-brand-800 dark:bg-brand-900/40 dark:text-brand-200">
            <MailCheck size={18} className="mt-0.5 flex-shrink-0" />
            {t("We sent a code to {email}. It works for {n} minutes.", { email: link.emailHint, n: link.expiresInMinutes })}
          </p>
          {link.mode === "link" && card?.status === "lost" && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t("It replaces your lost card, which stays blocked.")}
            </p>
          )}
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, "").slice(0, 10))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            className="w-full rounded-lg border border-slate-300 px-3 py-3 text-center font-mono text-2xl tracking-[0.4em] focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            autoFocus
          />
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button type="submit" disabled={busy || code.length < 6} className={`${btnPrimary} w-full`}>
            <CheckCircle2 size={16} /> {t("Confirm")}
          </button>
          <button type="button" onClick={resend} disabled={busy || resendIn > 0} className={`${btnOutline} w-full`}>
            {resendIn > 0 ? t("Send code again in {s}s", { s: resendIn }) : t("Send a new code")}
          </button>
        </form>
      )}

      {step === "done" && (
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <CheckCircle2 size={48} className="text-emerald-600 dark:text-emerald-400" />
          <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {result?.onPhone ? t("Your MediCard is on this phone") : t("Card linked!")}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {result?.onPhone
              ? t("Unlock your phone and hold its back near the hospital's MediCard reader.")
              : t("Your card now opens your records when staff tap it.")}
          </p>
          <button onClick={onClose} className={`${btnPrimary} w-full`}>{t("Done")}</button>
        </div>
      )}
    </Card>
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
      return t("This card can't be added to your account. If it's yours, please visit the registration desk.");
    case "card-lost":
      return t("This card is reported lost. Tap \"I found it\" first, or add a new card.");
    case "has-card":
      return t("That's not your current card. To replace your card, report it lost first.");
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
