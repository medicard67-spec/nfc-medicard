// Interface language: English (source text), Bahasa Melayu, Chinese (Simplified, as used in
// Malaysia) and Tamil. t() takes the English text and returns it in the chosen language, falling
// back to English when a phrase has no translation yet. Patient data is never translated.
import ms from "./ms.js";
import zh from "./zh.js";
import ta from "./ta.js";

export const LANGUAGES = [
  { code: "en", label: "English", english: "English", short: "EN", locale: "en-MY" },
  { code: "ms", label: "Bahasa Melayu", english: "Malay", short: "BM", locale: "ms-MY" },
  { code: "zh", label: "中文", english: "Chinese", short: "中文", locale: "zh-Hans-MY" },
  { code: "ta", label: "தமிழ்", english: "Tamil", short: "தமிழ்", locale: "ta-MY" },
];

const DICTS = { ms, zh, ta };
const STORAGE_KEY = "medicard-lang";

function initialLanguage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (LANGUAGES.some((l) => l.code === stored)) return stored;
  } catch {
    // storage unavailable: fall through to English
  }
  return "en";
}

let current = initialLanguage();
document.documentElement.lang = current;

export function getLanguage() {
  return current;
}

export function setLanguageValue(code) {
  if (!LANGUAGES.some((l) => l.code === code)) return;
  current = code;
  document.documentElement.lang = code;
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // not persisted; still applies for this session
  }
}

// t("Saved {name}", { name }) — placeholders in braces are filled from vars.
export function t(text, vars) {
  if (typeof text !== "string") return text;
  let out = (current !== "en" && DICTS[current]?.[text]) || text;
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  return out;
}

// Locale for dates and numbers in the chosen language (Malaysian variants).
export function dateLocale() {
  return LANGUAGES.find((l) => l.code === current)?.locale ?? "en-MY";
}

// Chart labels arrive from the server in English: "Sep 10" (month + day) or "Sep 26" (month + 2-digit
// year, when yearly). Re-format them in the chosen language; anything unrecognised is returned as-is.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function localiseChartLabel(label, kind = "day") {
  const m = /^([A-Z][a-z]{2}) (\d{1,2})$/.exec(String(label));
  const month = m ? MONTHS.indexOf(m[1]) : -1;
  if (month < 0 || current === "en") return label;
  const n = Number(m[2]);
  const d = kind === "month" ? new Date(2000 + n, month, 1) : new Date(2026, month, n);
  const opts = kind === "month" ? { month: "short", year: "2-digit" } : { month: "short", day: "numeric" };
  return d.toLocaleDateString(dateLocale(), opts);
}
