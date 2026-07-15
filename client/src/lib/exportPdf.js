import { jsPDF } from "jspdf";

export function exportPatientRecordPdf({ patient, history = [], labs = [], radiology = [] }) {
  const doc = new jsPDF();
  const marginX = 14;
  let y = 18;

  const brand = [41, 82, 219];
  const muted = [100, 116, 139];
  const dark = [15, 23, 42];

  const heading = (text, size = 13) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    doc.setTextColor(...dark);
    doc.text(text, marginX, y);
    y += size * 0.6 + 2;
  };

  const line = (label, value, opts = {}) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...muted);
    doc.text(label, marginX, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...dark);
    doc.text(String(value ?? "—"), marginX + (opts.labelWidth || 42), y);
    y += 6;
  };

  const ensureSpace = (needed = 20) => {
    if (y + needed > 280) {
      doc.addPage();
      y = 18;
    }
  };

  // Header
  doc.setFillColor(...brand);
  doc.rect(0, 0, 210, 12, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("NFC MediCard — Patient Record Export", marginX, 8.5);
  y = 22;

  heading(patient.name || "Unknown Patient", 16);
  doc.setDrawColor(226, 232, 240);
  doc.line(marginX, y, 196, y);
  y += 8;

  line("IC Number:", patient.ic);
  line("Date of Birth:", patient.dob);
  line("Age / Gender:", `${patient.age ?? "—"} / ${patient.gender || "—"}`);
  line("Blood Type:", patient.bloodType);
  line("Allergies:", (patient.allergies || []).join(", ") || "None recorded");
  line("Chronic Illnesses:", (patient.chronicIllnesses || []).join(", ") || "None recorded");
  line("Height / Weight:", `${patient.height ?? "—"} cm / ${patient.weight ?? "—"} kg`);
  line("Phone:", patient.phone);
  line("Emergency Contact:", `${patient.emergencyContactName || "—"} (${patient.emergencyContactPhone || "—"})`);
  y += 4;

  ensureSpace(30);
  heading("Medical History");
  if (history.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...muted);
    doc.text("No records.", marginX, y);
    y += 8;
  } else {
    history.forEach((h) => {
      ensureSpace(18);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...dark);
      doc.text(`${h.date}  —  ${h.diagnosis}`, marginX, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...muted);
      doc.text(`Physician: ${h.physician}`, marginX, y);
      y += 5;
      if (h.remarks) {
        const wrapped = doc.splitTextToSize(h.remarks, 175);
        doc.text(wrapped, marginX, y);
        y += wrapped.length * 4.5;
      }
      y += 3;
    });
  }

  ensureSpace(30);
  heading("Lab Results");
  if (labs.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...muted);
    doc.text("No records.", marginX, y);
    y += 8;
  } else {
    labs.forEach((l) => {
      ensureSpace(10);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...dark);
      doc.text(`${l.date}  —  ${l.testName}${l.flagged ? "  [ABNORMAL]" : ""}`, marginX, y);
      y += 6;
    });
  }

  ensureSpace(30);
  heading("Radiology / Imaging");
  if (radiology.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...muted);
    doc.text("No records.", marginX, y);
    y += 8;
  } else {
    radiology.forEach((r) => {
      ensureSpace(10);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...dark);
      doc.text(`${r.type} — ${r.anatomy || "—"} ${r.classification ? `(${r.classification})` : ""}`, marginX, y);
      y += 6;
    });
  }

  doc.setFontSize(7);
  doc.setTextColor(...muted);
  doc.text(`Generated ${new Date().toLocaleString()} by NFC MediCard`, marginX, 292);

  doc.save(`${(patient.name || "patient").replace(/\s+/g, "_")}_record.pdf`);
}
