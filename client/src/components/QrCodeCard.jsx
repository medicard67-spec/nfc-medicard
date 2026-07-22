import { useEffect, useState } from "react";
import QRCode from "qrcode";

export default function QrCodeCard({ value, label }) {
  const [dataUrl, setDataUrl] = useState(null);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, { width: 220, margin: 1 }).then((url) => {
      if (active) setDataUrl(url);
    });
    return () => {
      active = false;
    };
  }, [value]);

  if (!dataUrl) return null;

  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
      <img src={dataUrl} alt={`QR code for ${value}`} className="h-40 w-40 rounded-lg bg-white p-2" />
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <a
        href={dataUrl}
        download={`nfc-card-${value}.png`}
        className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
      >
        Download to print on the physical card
      </a>
    </div>
  );
}
