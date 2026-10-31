import { dateLocale } from "../i18n/index.js";

// "14:30" -> "2:30 pm" in the chosen language. Appointments made before times
// were added have none, so this returns "" for them.
export function formatAppointmentTime(time) {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  return new Date(2026, 0, 1, h, m).toLocaleTimeString(dateLocale(), { hour: "numeric", minute: "2-digit" });
}

// The time now as "HH:MM", for comparing with an appointment's time.
export function nowTimeKey() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Still to come: a later day, or today at or after the current time (or today with no time).
export function isUpcoming(appointment, today) {
  if (appointment.date !== today) return appointment.date > today;
  return !appointment.time || appointment.time >= nowTimeKey();
}
