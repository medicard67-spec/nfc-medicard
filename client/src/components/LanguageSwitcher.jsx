import { Languages } from "lucide-react";
import { LANGUAGES, t } from "../i18n/index.js";
import { useLanguage } from "../i18n/LanguageContext.jsx";

// Compact language picker. `compact` shows only the short code (for the icon rail and mobile bar).
export default function LanguageSwitcher({ compact = false, className = "" }) {
  const { lang, changeLanguage } = useLanguage();
  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];

  return (
    <label
      title={t("Language")}
      className={`relative inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 ${className}`}
    >
      <Languages size={14} className="flex-shrink-0" />
      <span>{compact ? current.short : current.label}</span>
      <select
        aria-label={t("Language")}
        value={lang}
        onChange={(e) => changeLanguage(e.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}
