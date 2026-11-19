// Reading a Malaysian IC (MyKad) number: YYMMDD-PB-####
//   YYMMDD  date of birth
//   PB      place of birth (state code, or a country code for people born abroad)
//   ####    registration number; by JPN convention its last digit is odd for
//           males and even for females
// Everything here is a suggestion for the registration form: staff can still
// change any field it fills in.

// JPN place-of-birth codes for the states (both the original and the newer codes).
const STATES = [
  ["Johor", ["01", "21", "22", "23", "24"]],
  ["Kedah", ["02", "25", "26", "27"]],
  ["Kelantan", ["03", "28", "29"]],
  ["Melaka", ["04", "30"]],
  ["Negeri Sembilan", ["05", "31", "59"]],
  ["Pahang", ["06", "32", "33"]],
  ["Pulau Pinang", ["07", "34", "35"]],
  ["Perak", ["08", "36", "37", "38", "39"]],
  ["Perlis", ["09", "40"]],
  ["Selangor", ["10", "41", "42", "43", "44"]],
  ["Terengganu", ["11", "45", "46"]],
  ["Sabah", ["12", "47", "48", "49"]],
  ["Sarawak", ["13", "50", "51", "52", "53"]],
  ["W.P. Kuala Lumpur", ["14", "54", "55", "56", "57"]],
  ["W.P. Labuan", ["15", "58"]],
  ["W.P. Putrajaya", ["16"]],
];
const STATE_BY_CODE = new Map(STATES.flatMap(([name, codes]) => codes.map((c) => [c, name])));

// "030815141235" or "030815-14-1235" -> "030815-14-1235" (dashes added as you type).
export function formatIc(input) {
  const d = String(input).replace(/\D/g, "").slice(0, 12);
  if (d.length <= 6) return d;
  if (d.length <= 8) return `${d.slice(0, 6)}-${d.slice(6)}`;
  return `${d.slice(0, 6)}-${d.slice(6, 8)}-${d.slice(8)}`;
}

// Whole years between a "YYYY-MM-DD" birth date and today (or `today`).
export function ageFrom(dob, today = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob || "");
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < mo || (today.getMonth() + 1 === mo && today.getDate() < d)) age -= 1;
  return age >= 0 ? age : null;
}

// What an IC number tells us so far. Fields stay null until enough digits are typed.
export function parseIc(input, today = new Date()) {
  const d = String(input).replace(/\D/g, "");
  const out = { dob: null, age: null, gender: null, birthPlace: null, error: null };
  if (d.length < 6) return out;

  const yy = Number(d.slice(0, 2));
  const mm = Number(d.slice(2, 4));
  const dd = Number(d.slice(4, 6));
  // "03" is 2003 and "85" is 1985: a year later than this year's two digits must be the 1900s
  const year = yy > today.getFullYear() % 100 ? 1900 + yy : 2000 + yy;
  const date = new Date(year, mm - 1, dd);
  if (mm < 1 || mm > 12 || date.getMonth() !== mm - 1 || date.getDate() !== dd || date > today) {
    out.error = "invalid-date";
    return out;
  }
  out.dob = `${year}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  out.age = ageFrom(out.dob, today);

  if (d.length >= 8) {
    const code = d.slice(6, 8);
    const n = Number(code);
    if (STATE_BY_CODE.has(code)) out.birthPlace = STATE_BY_CODE.get(code);
    else if (code === "82") out.birthPlace = "unknown-state";
    else if (n >= 60) out.birthPlace = "abroad";
    else out.error = "invalid-state";
  }
  if (d.length === 12) out.gender = Number(d[11]) % 2 === 1 ? "Male" : "Female";
  return out;
}
