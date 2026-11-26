import { useEffect, useState } from "react";
import logoUrl from "../assets/logo.png";
import { CARD_W, CARD_H, LAYOUT, logoHeight, wrapName, backBlock, cardQrDataUrl } from "../lib/medicardPrint.js";
import { t } from "../i18n/index.js";

// On-screen picture of the physical card (front or back), drawn in
// millimetres from the same layout as the printable PDF.
export default function MediCardVisual({ name, cardUid, side = "back", className = "" }) {
  const [qr, setQr] = useState(null);

  useEffect(() => {
    if (side !== "back" || !cardUid) return;
    let active = true;
    cardQrDataUrl(cardUid).then((url) => active && setQr(url));
    return () => {
      active = false;
    };
  }, [cardUid, side]);

  const f = LAYOUT.front;
  const b = LAYOUT.back;
  const lines = wrapName(name);
  const { uidY, nameY, qrY } = backBlock(lines.length);

  return (
    <svg
      viewBox={`0 0 ${CARD_W} ${CARD_H}`}
      role="img"
      aria-label={side === "front" ? t("Front of your MediCard") : t("Back of your MediCard")}
      className={`aspect-[54/85] w-full rounded-[3mm] bg-white shadow-lg ring-1 ring-slate-200 dark:ring-slate-700 ${className}`}
      style={{ fontFamily: "Helvetica, Arial, sans-serif" }}
    >
      <rect width={CARD_W} height={CARD_H} rx="3" fill="#fff" />
      {side === "front" ? (
        <>
          <image href={logoUrl} x={f.logo.x} y={f.logo.y} width={f.logo.w} height={logoHeight(f.logo.w)} />
          <text x={CARD_W / 2} y={f.title.y} textAnchor="middle" fontSize={f.title.size} fontWeight="700" letterSpacing="0.3" fill="#111">
            MEDICARD
          </text>
        </>
      ) : (
        <>
          <image href={logoUrl} x={b.logo.x} y={b.logo.y} width={b.logo.w} height={logoHeight(b.logo.w)} />
          {qr && <image href={qr} x={b.left} y={qrY} width={b.qr} height={b.qr} />}
          <text y={nameY} fill="#111">
            <tspan x={b.left} fontSize={b.label}>Name:</tspan>
            {lines.map((line, i) => (
              <tspan key={i} x={b.left + 7.7} y={nameY + i * b.line} fontSize={b.text}>
                {line}
              </tspan>
            ))}
          </text>
          <text y={uidY} fill="#111">
            <tspan x={b.left} fontSize={b.label}>UID:</tspan>
            <tspan x={b.left + 6.1} fontSize={b.text} letterSpacing="0.15">{cardUid}</tspan>
          </text>
        </>
      )}
    </svg>
  );
}
