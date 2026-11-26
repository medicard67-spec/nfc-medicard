import {
  MessageCircle, CalendarCheck, AlarmClock, FlaskConical, ScanLine, Pill, ShieldAlert, BedDouble, LogOut,
  Ticket, Share2, CalendarDays, TriangleAlert, UserPlus, CreditCard, Bell, DoorOpen, Hourglass,
} from "lucide-react";
import { t, dateLocale } from "../i18n/index.js";
import { formatAppointmentTime } from "./appointmentTime.js";

function day(date) {
  return date ? new Date(date + "T00:00:00").toLocaleDateString(dateLocale(), { weekday: "short", day: "numeric", month: "short" }) : "";
}
function when(d) {
  return [day(d.date), formatAppointmentTime(d.time)].filter(Boolean).join(", ");
}

const METHODS = { nfc: "card tap", qr: "QR code", manual: "typed card number" };

// A notification's type + data, as an icon and text in the chosen language.
// tone: "alert" (red), "warn" (amber) or "info" (brand colour).
export function describeNotification(n) {
  const d = n.data || {};
  switch (n.type) {
    case "message.new":
      return { icon: MessageCircle, tone: "info", title: t("New message from {name}", { name: d.from }), body: t("Tap to read and reply.") };
    case "appointment.booked":
      return { icon: CalendarCheck, tone: "info", title: t("Appointment booked"), body: `${d.doctor} · ${when(d)}` };
    case "appointment.reminder":
      return {
        icon: AlarmClock, tone: "warn",
        title: d.when === "soon" ? t("Your appointment is within the hour") : t("Appointment tomorrow"),
        body: `${d.doctor} · ${when(d)}`,
      };
    case "lab.new":
      return {
        icon: FlaskConical, tone: d.flagged ? "alert" : "info",
        title: d.flagged ? t("New lab result: abnormal") : t("New lab result"), body: d.test,
      };
    case "lab.abnormal":
      return { icon: TriangleAlert, tone: "alert", title: t("Abnormal result for {name}", { name: d.patient }), body: `${d.test} · ${t("added by {name}", { name: d.by })}` };
    case "imaging.new":
      return { icon: ScanLine, tone: "info", title: t("New imaging added"), body: [t(d.type), d.anatomy].filter(Boolean).join(" · ") };
    case "medication.due":
      return {
        icon: Pill, tone: d.when === "now" ? "alert" : "warn",
        title: d.when === "now" ? t("Medication due for renewal") : t("Medication runs out soon"),
        body: `${d.name} · ${day(d.endDate)}`,
      };
    case "card.scanned":
      return {
        icon: ShieldAlert, tone: "warn", title: t("Your MediCard was scanned"),
        body: [d.by, d.hospital, t(METHODS[d.method] || "card tap")].filter(Boolean).join(" · "),
      };
    case "card.unknown":
      return { icon: CreditCard, tone: "alert", title: t("Unregistered card scanned"), body: `${d.cardUid} · ${t("by {name}", { name: d.by })}` };
    case "card.linked":
      return {
        icon: CreditCard, tone: "info",
        title: t("{name} linked a new card", { name: d.patient }),
        body: d.replaced ? t("Card ··{uid} · replaces a lost card", { uid: String(d.cardUid).slice(-4) }) : t("Card ··{uid}", { uid: String(d.cardUid).slice(-4) }),
      };
    case "card.lost":
      return {
        icon: TriangleAlert, tone: "warn",
        title: t("Card reported lost: {name}", { name: d.patient }),
        body: t("Card ··{uid} is blocked · by {name}", { uid: String(d.cardUid).slice(-4), name: d.by }),
      };
    case "card.lost_scanned":
      return {
        icon: ShieldAlert, tone: "alert",
        title: d.patient ? t("Lost card scanned: {name}", { name: d.patient }) : t("Someone scanned your lost card"),
        body: t("Card ··{uid} · by {name}. No records were shown.", { uid: String(d.cardUid).slice(-4), name: d.by }),
      };
    case "admission.admitted":
      return { icon: BedDouble, tone: "info", title: t("You have been admitted"), body: [d.ward, d.by].filter(Boolean).join(" · ") };
    case "admission.discharged":
      return { icon: LogOut, tone: "info", title: t("You have been discharged"), body: d.ward || t("Get well soon.") };
    case "queue.called":
      return { icon: DoorOpen, tone: "alert", title: t("It's your turn!"), body: t("Please go to {room} now · Queue number {number}", { room: d.room, number: d.number }) };
    case "queue.next":
      return { icon: Hourglass, tone: "warn", title: t("You're next"), body: t("Queue number {number} · {room}. Please get ready.", { number: d.number, room: d.room }) };
    case "queue.checkin":
      return { icon: Ticket, tone: "info", title: t("Checked in"), body: t("Queue number {number} · {room}", { number: d.number, room: d.room }) };
    case "referral.received":
      return { icon: Share2, tone: "info", title: t("New referral: {name}", { name: d.patient }), body: `${t("from {name}", { name: d.by })} · ${d.diagnosis}` };
    case "appointments.today":
      return {
        icon: CalendarDays, tone: "info", title: t("Today's appointments"),
        body: d.count === 1 ? t("You have 1 appointment today.") : t("You have {count} appointments today.", { count: d.count }),
      };
    case "patient.registered":
      return { icon: UserPlus, tone: "info", title: t("New patient registered: {name}", { name: d.patient }), body: t("By {name}. They may need a card.", { name: d.by }) };
    default:
      return { icon: Bell, tone: "info", title: n.type, body: "" };
  }
}

// "just now", "5 min ago", "3 h ago", or a date.
export function timeAgo(iso) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return t("just now");
  if (mins < 60) return t("{n} min ago", { n: mins });
  if (mins < 24 * 60) return t("{n} h ago", { n: Math.round(mins / 60) });
  return new Date(iso).toLocaleDateString(dateLocale(), { day: "numeric", month: "short" });
}
