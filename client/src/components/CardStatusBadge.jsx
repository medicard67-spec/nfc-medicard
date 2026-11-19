import { CreditCard } from "lucide-react";
import { t } from "../i18n/index.js";

// Shows whether a patient has an NFC card linked: green with the card's last
// 4 characters, or amber "No card" so staff know to issue one.
export default function CardStatusBadge({ cardUid, className = "" }) {
  const base = "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold";
  if (cardUid) {
    return (
      <span
        title={cardUid}
        className={`${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 ${className}`}
      >
        <CreditCard size={12} />
        {t("Card linked")} <span className="font-mono">··{String(cardUid).slice(-4)}</span>
      </span>
    );
  }
  return (
    <span className={`${base} bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 ${className}`}>
      <CreditCard size={12} />
      {t("No card")}
    </span>
  );
}
