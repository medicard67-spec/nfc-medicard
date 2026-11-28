import { initializeApp, cert } from "firebase-admin/app";
import { getMessaging as firebaseMessaging } from "firebase-admin/messaging";
import { supabase } from "./supabase.js";

// Phone push notifications through Firebase Cloud Messaging, so the most
// important notifications reach a phone even when the app is closed.
// Needs FIREBASE_SERVICE_ACCOUNT (the service account key JSON, as one line)
// in the server's environment; without it, push is simply switched off and
// the in-app bell still works.

let messaging;
function getMessaging() {
  if (messaging !== undefined) return messaging;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return (messaging = null);
  try {
    const app = initializeApp({ credential: cert(JSON.parse(raw)) }, "medicard-push");
    messaging = firebaseMessaging(app);
    console.log("Push notifications on (Firebase project", JSON.parse(raw).project_id + ")");
  } catch (err) {
    console.error("Push notifications disabled:", err.message);
    messaging = null;
  }
  return messaging;
}

// Only these are pushed. Reminders are not: they are created when the app opens.
const TEXT = {
  "queue.called": {
    en: ["It's your turn!", "Please go to {room} now · Queue number {number}"],
    ms: ["Giliran anda!", "Sila ke {room} sekarang · Nombor giliran {number}"],
  },
  "queue.next": {
    en: ["You're next", "Queue number {number} · {room}. Please get ready."],
    ms: ["Anda seterusnya", "Nombor giliran {number} · {room}. Sila bersedia."],
  },
  "message.new": {
    en: ["New message from {from}", "Tap to read and reply."],
    ms: ["Mesej baharu daripada {from}", "Ketik untuk membaca dan membalas."],
  },
  "card.scanned": {
    en: ["Your MediCard was scanned", "{by}{at}"],
    ms: ["MediCard anda telah diimbas", "{by}{at}"],
  },
  "appointment.booked": {
    en: ["Appointment booked", "{doctor} · {date} {time}"],
    ms: ["Temujanji ditetapkan", "{doctor} · {date} {time}"],
  },
  "lab.new": {
    en: ["New lab result", "{test}"],
    ms: ["Keputusan makmal baharu", "{test}"],
  },
};
export const PUSHED_TYPES = new Set(Object.keys(TEXT));

function fill(s, data) {
  const vars = { ...data, at: data.hospital ? ` · ${data.hospital}` : "", time: data.time || "" };
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? "")).trim();
}

export function pushText(type, data, lang) {
  const set = TEXT[type];
  const [title, body] = set[lang] || set.en;
  return { title: fill(title, data), body: fill(body, data) };
}

// Send one notification to every phone these users are logged in on.
// Never throws: a failed push must not break the action that caused it.
export async function sendPush(userIds, type, data = {}, link = null) {
  try {
    if (!PUSHED_TYPES.has(type)) return;
    const fcm = getMessaging();
    if (!fcm) return;
    const { data: devices } = await supabase.from("device_tokens").select("token, lang").in("user_id", userIds);
    if (!devices?.length) return;

    const byLang = new Map();
    for (const d of devices) byLang.set(d.lang, [...(byLang.get(d.lang) || []), d.token]);
    const dead = [];
    for (const [lang, tokens] of byLang) {
      const { title, body } = pushText(type, data, lang);
      const res = await fcm.sendEachForMulticast({
        tokens,
        notification: { title, body },
        data: { type, link: link || "" },
        android: {
          priority: "high",
          // "your turn" uses its own loud channel (created by the app)
          notification: { channelId: type === "queue.called" ? "turn" : "general", sound: "default" },
        },
      });
      res.responses.forEach((r, i) => {
        const code = r.error?.code || "";
        if (code.includes("registration-token-not-registered") || code.includes("invalid-registration-token")) dead.push(tokens[i]);
      });
    }
    // phones that uninstalled the app: stop sending to them
    if (dead.length) await supabase.from("device_tokens").delete().in("token", dead);
  } catch (err) {
    console.error("Failed to send push:", err.message);
  }
}
