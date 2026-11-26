import QRCode from "qrcode";
import logoUrl from "../assets/logo.png";

// The physical MediCard, following the team's base design: portrait
// 54 x 85 mm. Front: the logo and "MEDICARD" in the middle. Back: a small
// logo top right and, at the bottom left, the QR code, Name and UID.
// Everything is in millimetres so the screen preview (SVG) and the
// printable PDF share one layout.
export const CARD_W = 54;
export const CARD_H = 85;
const LOGO_RATIO = 1024 / 1600; // logo.png height / width

export const LAYOUT = {
  front: { logo: { x: 13.5, y: 26, w: 27 }, title: { y: 48.5, size: 4.4 } },
  back: {
    logo: { x: 44.6, y: 2.2, w: 7.8 },
    left: 3.7,
    qr: 11.5,
    label: 2.4, // text height of "Name:" / "UID:"
    text: 2.25,
    line: 2.9,
    uidY: 81, // baseline of the UID line
  },
};

export function logoHeight(w) {
  return w * LOGO_RATIO;
}

// Splits a long name over up to 3 lines of about `max` characters.
export function wrapName(name, max = 30) {
  const lines = [];
  for (const word of String(name || "").trim().split(/\s+/).filter(Boolean)) {
    const last = lines[lines.length - 1];
    if (last && `${last} ${word}`.length <= max) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines.slice(0, 3);
}

// Where the back's bottom-left block sits for a name of n lines: it grows
// upwards from the UID line, the way the base card stacks them.
export function backBlock(nameLines) {
  const b = LAYOUT.back;
  const uidY = b.uidY;
  const nameY = uidY - 3.8 - (nameLines - 1) * b.line; // first name line
  const qrY = nameY - 3.4 - b.qr;
  return { uidY, nameY, qrY };
}

export function cardQrDataUrl(cardUid, width = 600) {
  return QRCode.toDataURL(cardUid, { width, margin: 0, errorCorrectionLevel: "M" });
}

// The logo file is 1600 px wide; 800 px is still sharp at the card's 27 mm
// (about 750 dpi) and keeps the PDF small.
async function loadLogo() {
  const img = new Image();
  img.src = logoUrl;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = Math.round(800 * LOGO_RATIO);
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

// A 2-page PDF (front, back) at the card's real size, ready to print.
export async function downloadCardPdf({ name, cardUid }) {
  const [{ jsPDF }, logo, qr] = await Promise.all([import("jspdf"), loadLogo(), cardQrDataUrl(cardUid)]);
  const doc = new jsPDF({ unit: "mm", format: [CARD_W, CARD_H], orientation: "portrait", compress: true });
  const ptFor = (mm) => mm / 0.3528; // text height in mm -> font size in points
  const f = LAYOUT.front;
  const b = LAYOUT.back;

  // front
  doc.addImage(logo, "PNG", f.logo.x, f.logo.y, f.logo.w, logoHeight(f.logo.w), "logo", "FAST");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(ptFor(f.title.size));
  doc.setTextColor(17, 17, 17);
  doc.text("MEDICARD", CARD_W / 2, f.title.y, { align: "center", charSpace: 0.3 });

  // back
  doc.addPage([CARD_W, CARD_H], "portrait");
  doc.addImage(logo, "PNG", b.logo.x, b.logo.y, b.logo.w, logoHeight(b.logo.w), "logo", "FAST");
  const lines = wrapName(name);
  const { uidY, nameY, qrY } = backBlock(lines.length);
  doc.addImage(qr, "PNG", b.left, qrY, b.qr, b.qr);

  doc.setTextColor(17, 17, 17);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(ptFor(b.label));
  doc.text("Name:", b.left, nameY);
  const nameX = b.left + doc.getTextWidth("Name: ");
  doc.setFontSize(ptFor(b.text));
  lines.forEach((line, i) => doc.text(line, nameX, nameY + i * b.line));

  doc.setFontSize(ptFor(b.label));
  doc.text("UID:", b.left, uidY);
  const uidX = b.left + doc.getTextWidth("UID: ") + 0.6;
  doc.setFontSize(ptFor(b.text));
  doc.text(cardUid, uidX, uidY, { charSpace: 0.15 });

  doc.save(`MediCard-${String(name || "card").replace(/[^\w]+/g, "-")}-${cardUid}.pdf`);
}
