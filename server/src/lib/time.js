// Dates and times in Malaysia (UTC+8). The server runs on UTC, which is still
// "yesterday" until 8 am Malaysian time, so anything that depends on "today"
// or "now" goes through here.
const TZ = "Asia/Kuala_Lumpur";

// { date: "YYYY-MM-DD", time: "HH:MM" } for now (or a given Date) in Malaysia.
export function malaysiaNow(at = new Date()) {
  return {
    date: at.toLocaleDateString("en-CA", { timeZone: TZ }),
    time: at.toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
  };
}

// A real calendar date written "YYYY-MM-DD" (rejects "2026-02-30" and typos).
export function isDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

// Today's date in Malaysia, "YYYY-MM-DD".
export function malaysiaToday(at = new Date()) {
  return malaysiaNow(at).date;
}

// The moment today started in Malaysia (midnight UTC+8), as an ISO timestamp,
// for "created today" filters.
export function malaysiaDayStart(at = new Date()) {
  return new Date(`${malaysiaToday(at)}T00:00:00+08:00`).toISOString();
}

// "YYYY-MM-DD" plus n days.
export function addDays(date, n) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Age in whole years today (Malaysian date) from a "YYYY-MM-DD" date of birth,
// so a stored age never goes stale. null when there is no usable date.
export function ageFromDob(dob, at = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dob || "");
  if (!m) return null;
  const [ty, tm, td] = malaysiaNow(at).date.split("-").map(Number);
  let age = ty - Number(m[1]);
  if (tm < Number(m[2]) || (tm === Number(m[2]) && td < Number(m[3]))) age -= 1;
  return age >= 0 ? age : null;
}
