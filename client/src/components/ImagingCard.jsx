import { Bandage } from "lucide-react";
import Card from "./Card.jsx";
import { t, dateLocale } from "../i18n/index.js";

// "12 Oct 2026, 3:42 pm" in Malaysian format; used on the image (in the chosen language) and in
// the PDF export (always English, since the PDF font has no Chinese or Tamil glyphs).
export function formatImagingDate(iso, locale = dateLocale()) {
  if (!iso) return "";
  return new Date(iso).toLocaleString(locale, {
    day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
  });
}

// One imaging record (X-ray / MRI / CT / wound photo) with its date and time stamped on the image,
// like the label on a printed film, so it stays visible when the card is screenshotted or shared.
export default function ImagingCard({ img, classificationClassName = "text-slate-500 dark:text-slate-400" }) {
  const when = formatImagingDate(img.uploadedAt);
  return (
    <Card className="p-3">
      <a href={img.fileUrl} target="_blank" rel="noreferrer" className="relative mb-2 block">
        <img src={img.fileUrl} alt={`${img.type}${when ? `, ${when}` : ""}`} className="h-28 w-full rounded-lg object-cover" />
        {when && (
          <span className="absolute bottom-1.5 left-1.5 right-1.5 truncate rounded-md bg-black/70 px-1.5 py-0.5 font-mono text-[10px] leading-4 text-white">
            {when}
          </span>
        )}
      </a>
      <p className="flex items-center gap-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
        {img.type === "Wound Care" && <Bandage size={13} />} {img.type}
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{img.anatomy}</p>
      {img.classification && <p className={`text-xs ${classificationClassName}`}>{img.classification}</p>}
      {img.uploadedBy && <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{t("Uploaded by")} {img.uploadedBy}</p>}
    </Card>
  );
}
