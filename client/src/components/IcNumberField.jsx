import { CircleCheck, TriangleAlert } from "lucide-react";
import { formatIc, parseIc } from "../lib/mykad.js";
import { t, dateLocale } from "../i18n/index.js";

const PLACE = { abroad: "outside Malaysia", "unknown-state": "an unknown state" };

// IC number box for the registration forms. Adds the dashes as staff type
// and, once the IC is readable, passes what it found (date of birth, age,
// gender) to onChange so the form can fill those fields in.
export default function IcNumberField({ value, onChange }) {
  const info = parseIc(value);

  const handle = (e) => {
    const ic = formatIc(e.target.value);
    onChange(ic, parseIc(ic));
  };

  const born = info.dob
    ? new Date(info.dob + "T00:00:00").toLocaleDateString(dateLocale(), { day: "numeric", month: "long", year: "numeric" })
    : null;
  const place = info.birthPlace ? t(PLACE[info.birthPlace] || info.birthPlace) : null;

  return (
    <div>
      <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">{t("IC Number")}</label>
      <input
        value={value}
        onChange={handle}
        inputMode="numeric"
        placeholder="030815-14-1235"
        maxLength={14}
        className={`w-full rounded-lg border px-3 py-2 text-sm tracking-wide dark:bg-slate-800 dark:text-slate-100 ${
          info.error ? "border-red-400 dark:border-red-500" : "border-slate-300 dark:border-slate-700"
        }`}
      />
      {info.error && (
        <p className="mt-1 flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
          <TriangleAlert size={12} />
          {info.error === "invalid-date" ? t("This IC number has an invalid birth date.") : t("This IC number has an unknown place-of-birth code.")}
        </p>
      )}
      {!info.error && born && (
        <p className="mt-1 flex items-start gap-1 text-xs text-brand-700 dark:text-brand-300">
          <CircleCheck size={12} className="mt-0.5 flex-shrink-0" />
          <span>
            {place ? t("Born {date} in {place}", { date: born, place }) : t("Born {date}", { date: born })}
            {" · "}
            {info.gender ? t("date of birth, age and gender filled in") : t("date of birth and age filled in")}
          </span>
        </p>
      )}
    </div>
  );
}
