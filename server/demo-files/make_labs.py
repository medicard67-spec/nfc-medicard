"""Realistic sample lab reports + a 12-lead ECG for the demo patient Ahmad Faiz Bin Rahman.

Values use standard adult-male reference ranges and are internally consistent
(indices computed from Hb/RBC/HCT, LDL by Friedewald, eGFR by CKD-EPI 2021,
QTc by Bazett). Output: PDFs in the folder given as argv[1].
"""
import math
import sys
from pathlib import Path

import numpy as np
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, Table, TableStyle

OUT = Path(sys.argv[1])
OUT.mkdir(parents=True, exist_ok=True)

pdfmetrics.registerFont(TTFont("Arial", r"C:\Windows\Fonts\arial.ttf"))
pdfmetrics.registerFont(TTFont("Arial-Bold", r"C:\Windows\Fonts\arialbd.ttf"))
pdfmetrics.registerFontFamily("Arial", normal="Arial", bold="Arial-Bold")

TEAL = colors.HexColor("#0F766E")
INK = colors.HexColor("#0F172A")
MUTED = colors.HexColor("#64748B")
RED = colors.HexColor("#B91C1C")
LINE = colors.HexColor("#CBD5E1")

PATIENT = {
    "name": "AHMAD FAIZ BIN RAHMAN",
    "ic": "010203-14-1234",
    "dob": "03/02/2001",
    "age_sex": "25 Y / Male",
    "doctor": "Dr. Sarah Jenkins (Cardiology)",
}

cell = ParagraphStyle("cell", fontName="Arial", fontSize=9, leading=11, textColor=INK)
cell_b = ParagraphStyle("cellb", parent=cell, fontName="Arial-Bold")
cell_flag = ParagraphStyle("cellf", parent=cell, fontName="Arial-Bold", textColor=RED)
head = ParagraphStyle("head", parent=cell, fontName="Arial-Bold", fontSize=8, textColor=MUTED)
note = ParagraphStyle("note", parent=cell, fontSize=9, leading=12.5)


def header(c, w, h, title, lab_no, specimen, collected, reported):
    c.setFillColor(TEAL)
    c.rect(0, h - 26 * mm, w, 26 * mm, stroke=0, fill=1)
    c.setFillColor(colors.white)
    c.setFont("Arial-Bold", 15)
    c.drawString(15 * mm, h - 12 * mm, "NFC MediCard Demo Laboratory")
    c.setFont("Arial", 8.5)
    c.drawString(15 * mm, h - 17.5 * mm, "Department of Pathology  ·  Sample report for demonstration")
    c.setFont("Arial-Bold", 9)
    c.drawRightString(w - 15 * mm, h - 12 * mm, "SAMPLE REPORT")
    c.setFont("Arial", 8)
    c.drawRightString(w - 15 * mm, h - 17.5 * mm, f"Lab No. {lab_no}")

    y = h - 34 * mm
    c.setFillColor(INK)
    c.setFont("Arial-Bold", 13)
    c.drawString(15 * mm, y, title)

    rows = [
        ("Patient", PATIENT["name"], "Lab No.", lab_no),
        ("IC No.", PATIENT["ic"], "Specimen", specimen),
        ("DOB", PATIENT["dob"], "Collected", collected),
        ("Age / Sex", PATIENT["age_sex"], "Reported", reported),
        ("Requested by", PATIENT["doctor"], "Status", "Final, verified"),
    ]
    y -= 8 * mm
    for label1, val1, label2, val2 in rows:
        c.setFont("Arial", 8)
        c.setFillColor(MUTED)
        c.drawString(15 * mm, y, label1)
        c.drawString(115 * mm, y, label2)
        c.setFont("Arial-Bold", 9)
        c.setFillColor(INK)
        c.drawString(40 * mm, y, val1)
        c.drawString(137 * mm, y, val2)
        y -= 5.2 * mm
    c.setStrokeColor(LINE)
    c.line(15 * mm, y + 1.5 * mm, w - 15 * mm, y + 1.5 * mm)
    return y - 4 * mm


def footer(c, w):
    c.setFont("Arial", 7.5)
    c.setFillColor(MUTED)
    c.drawString(15 * mm, 12 * mm, "Sample report generated for the NFC MediCard demo. Values are clinically realistic but do not belong to a real person.")
    c.drawRightString(w - 15 * mm, 16 * mm, "Verified electronically · Page 1 of 1")
    c.drawString(15 * mm, 16 * mm, "H = above reference range   L = below reference range   A = abnormal   * = outside treatment target")


def results_table(rows):
    """rows: ("section", name) or (test, result, flag, unit, range)."""
    data = [[Paragraph(x, head) for x in ("TEST", "RESULT", "FLAG", "UNITS", "REFERENCE RANGE")]]
    styles = [
        ("LINEBELOW", (0, 0), (-1, 0), 0.8, INK),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 2.6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.6),
    ]
    for r in rows:
        if r[0] == "section":
            data.append([Paragraph(r[1].upper(), ParagraphStyle("sec", parent=cell_b, textColor=TEAL, fontSize=8.5)), "", "", "", ""])
            i = len(data) - 1
            styles += [("SPAN", (0, i), (-1, i)), ("TOPPADDING", (0, i), (-1, i), 7)]
            continue
        test, result, flag, unit, ref = r
        st = cell_flag if flag else cell_b
        data.append([Paragraph(test, cell), Paragraph(result, st), Paragraph(flag, cell_flag), Paragraph(unit, cell), Paragraph(ref, cell)])
        styles.append(("LINEBELOW", (0, len(data) - 1), (-1, len(data) - 1), 0.25, LINE))
    t = Table(data, colWidths=[62 * mm, 26 * mm, 13 * mm, 27 * mm, 52 * mm])
    t.setStyle(TableStyle(styles))
    return t


def lab_report(filename, title, lab_no, specimen, collected, reported, rows, comment):
    from reportlab.pdfgen import canvas

    w, h = A4
    c = canvas.Canvas(str(OUT / filename), pagesize=A4)
    c.setTitle(f"{title} - {PATIENT['name']}")
    c.setAuthor("NFC MediCard Demo Laboratory")
    y = header(c, w, h, title, lab_no, specimen, collected, reported)
    t = results_table(rows)
    tw, th = t.wrap(w - 30 * mm, y)
    t.drawOn(c, 15 * mm, y - th)
    y = y - th - 9 * mm
    c.setFont("Arial-Bold", 9.5)
    c.setFillColor(INK)
    c.drawString(15 * mm, y, "Comment")
    p = Paragraph(comment, note)
    pw, ph = p.wrap(w - 30 * mm, y)
    p.drawOn(c, 15 * mm, y - 2 * mm - ph)
    footer(c, w)
    c.showPage()
    c.save()


SUP9 = "x10<super>9</super>/L"
SUP12 = "x10<super>12</super>/L"


def fbc_rows(hb, rbc, hct, rdw, wbc, neut, lym, mono, eos, baso, plt):
    mcv, mch, mchc = hct / rbc * 10, hb / rbc * 10, hb / hct * 100

    def f(v, lo, hi):
        return "H" if v > hi else "L" if v < lo else ""

    return [
        ("section", "Haematology: Full Blood Count"),
        ("Haemoglobin", f"{hb:.1f}", f(hb, 13, 17), "g/dL", "13.0 – 17.0"),
        ("Red blood cells", f"{rbc:.2f}", f(rbc, 4.5, 5.5), SUP12, "4.50 – 5.50"),
        ("Haematocrit (PCV)", f"{hct:.1f}", f(hct, 40, 50), "%", "40.0 – 50.0"),
        ("MCV", f"{mcv:.1f}", f(mcv, 83, 101), "fL", "83.0 – 101.0"),
        ("MCH", f"{mch:.1f}", f(mch, 27, 32), "pg", "27.0 – 32.0"),
        ("MCHC", f"{mchc:.1f}", f(mchc, 31.5, 34.5), "g/dL", "31.5 – 34.5"),
        ("RDW-CV", f"{rdw:.1f}", f(rdw, 11.6, 14.0), "%", "11.6 – 14.0"),
        ("White blood cells", f"{wbc:.1f}", f(wbc, 4, 10), SUP9, "4.0 – 10.0"),
        ("&nbsp;&nbsp;Neutrophils", f"{neut:.2f}", f(neut, 2, 7), SUP9, "2.00 – 7.00"),
        ("&nbsp;&nbsp;Lymphocytes", f"{lym:.2f}", f(lym, 1, 3), SUP9, "1.00 – 3.00"),
        ("&nbsp;&nbsp;Monocytes", f"{mono:.2f}", f(mono, 0.2, 1), SUP9, "0.20 – 1.00"),
        ("&nbsp;&nbsp;Eosinophils", f"{eos:.2f}", f(eos, 0.02, 0.5), SUP9, "0.02 – 0.50"),
        ("&nbsp;&nbsp;Basophils", f"{baso:.2f}", f(baso, 0.02, 0.1), SUP9, "0.02 – 0.10"),
        ("Platelets", f"{plt:.0f}", f(plt, 150, 410), SUP9, "150 – 410"),
    ]


# 1. Dengue admission, 21 Sep 2026
lab_report(
    "ahmad-faiz-2026-09-21-fbc-dengue.pdf",
    "Full Blood Count & Dengue Serology",
    "LAB-260921-0418",
    "EDTA whole blood, clotted blood",
    "21/09/2026 08:42",
    "21/09/2026 10:15",
    fbc_rows(hb=16.4, rbc=5.62, hct=51.2, rdw=12.8, wbc=2.6, neut=1.20, lym=1.01, mono=0.32, eos=0.05, baso=0.02, plt=98)
    + [
        ("section", "Serology: Dengue"),
        ("Dengue NS1 antigen", "REACTIVE", "A", "", "Non-reactive"),
        ("Dengue IgM antibody", "Non-reactive", "", "", "Non-reactive"),
        ("Dengue IgG antibody", "Non-reactive", "", "", "Non-reactive"),
        ("section", "Chemistry: Liver enzymes"),
        ("AST", "88", "H", "U/L", "&lt; 40"),
        ("ALT", "64", "H", "U/L", "&lt; 45"),
        ("Albumin", "41", "", "g/L", "35 – 50"),
    ],
    "Leucopenia and thrombocytopenia with a raised haematocrit (haemoconcentration). Dengue NS1 antigen reactive "
    "with IgM and IgG non-reactive: consistent with acute primary dengue infection in the early febrile phase. "
    "Mildly raised transaminases, common in dengue. Suggest serial FBC / haematocrit every 12–24 hours.",
)

# 2. Repeat FBC before discharge, 24 Sep 2026
lab_report(
    "ahmad-faiz-2026-09-24-fbc-repeat.pdf",
    "Full Blood Count (Repeat, Pre-discharge)",
    "LAB-260924-0207",
    "EDTA whole blood",
    "24/09/2026 07:55",
    "24/09/2026 09:02",
    fbc_rows(hb=14.8, rbc=5.08, hct=45.0, rdw=12.9, wbc=4.9, neut=2.60, lym=1.80, mono=0.40, eos=0.08, baso=0.02, plt=142),
    "Platelet count recovering (98 → 76 → 142 x10<super>9</super>/L over the admission) and white cell count back "
    "within range. Haematocrit has normalised. Findings in keeping with the recovery phase of dengue.",
)

# 4. Diabetes panel, 28 Oct 2026
hba1c = 7.6
lab_report(
    "ahmad-faiz-2026-10-28-hba1c-fpg.pdf",
    "Diabetes Panel: HbA1c & Fasting Plasma Glucose",
    "LAB-261028-0533",
    "EDTA blood, fluoride plasma",
    "28/10/2026 08:10",
    "28/10/2026 11:40",
    [
        ("section", "Glycaemic control"),
        ("HbA1c (NGSP / DCCT)", f"{hba1c:.1f}", "H*", "%", "4.0 – 5.6 (non-diabetic)<br/>Target ≤ 7.0 (diabetes)"),
        ("HbA1c (IFCC)", f"{(hba1c - 2.15) * 10.929:.0f}", "H*", "mmol/mol", "20 – 38 (non-diabetic)<br/>Target ≤ 53 (diabetes)"),
        ("Estimated average glucose", f"{(28.7 * hba1c - 46.7) / 18:.1f}", "", "mmol/L", "calculated from HbA1c"),
        ("Fasting plasma glucose", "8.4", "H", "mmol/L", "3.9 – 6.0"),
    ],
    "HbA1c 7.6% is above the individualised target of ≤ 7.0% recommended for most adults with type 2 diabetes "
    "(Malaysian CPG Management of Type 2 Diabetes Mellitus). Fasting glucose also raised. Glycaemic control is "
    "suboptimal on metformin 500 mg twice daily; review adherence, diet and dose.",
)

# 5. Lipid profile, 28 Oct 2026
tc, tg, hdl = 5.6, 2.1, 0.98
ldl = tc - hdl - tg / 2.2
lab_report(
    "ahmad-faiz-2026-10-28-lipid-profile.pdf",
    "Fasting Lipid Profile",
    "LAB-261028-0534",
    "Serum (fasting 10 h)",
    "28/10/2026 08:10",
    "28/10/2026 11:52",
    [
        ("section", "Lipids"),
        ("Total cholesterol", f"{tc:.1f}", "H", "mmol/L", "&lt; 5.2"),
        ("Triglycerides", f"{tg:.1f}", "H", "mmol/L", "&lt; 1.7"),
        ("HDL cholesterol", f"{hdl:.2f}", "L", "mmol/L", "&gt; 1.0"),
        ("LDL cholesterol (calculated)", f"{ldl:.2f}", "H*", "mmol/L", "&lt; 3.4 (general)<br/>Target &lt; 2.6 (diabetes)"),
        ("Non-HDL cholesterol", f"{tc - hdl:.2f}", "H*", "mmol/L", "Target &lt; 3.4 (diabetes)"),
        ("Total cholesterol / HDL ratio", f"{tc / hdl:.1f}", "H", "", "&lt; 4.5"),
    ],
    "LDL calculated by the Friedewald equation (valid, triglycerides &lt; 4.5 mmol/L). Atherogenic profile: raised "
    "LDL and triglycerides with low HDL. LDL is above the target of &lt; 2.6 mmol/L for a patient with diabetes "
    "(Malaysian CPG Management of Dyslipidaemia). Consider lifestyle measures and statin therapy.",
)

# 6. Renal profile + urine ACR, 28 Oct 2026
creat_mgdl = 84 / 88.4
k, a = 0.9, -0.302
egfr = 142 * min(creat_mgdl / k, 1) ** a * max(creat_mgdl / k, 1) ** -1.2 * 0.9938 ** 25
lab_report(
    "ahmad-faiz-2026-10-28-renal-uacr.pdf",
    "Renal Profile & Urine Albumin-Creatinine Ratio",
    "LAB-261028-0535",
    "Serum, random urine",
    "28/10/2026 08:10",
    "28/10/2026 12:05",
    [
        ("section", "Renal profile"),
        ("Urea", "4.6", "", "mmol/L", "2.8 – 7.2"),
        ("Creatinine", "84", "", "µmol/L", "64 – 104"),
        ("eGFR (CKD-EPI 2021)", f"{egfr:.0f}", "", "mL/min/1.73m<super>2</super>", "&gt; 90"),
        ("Sodium", "139", "", "mmol/L", "136 – 145"),
        ("Potassium", "4.3", "", "mmol/L", "3.5 – 5.1"),
        ("Chloride", "103", "", "mmol/L", "98 – 107"),
        ("Uric acid", "0.41", "", "mmol/L", "0.20 – 0.43"),
        ("section", "Urine"),
        ("Urine albumin", "14", "", "mg/L", ""),
        ("Urine creatinine", "7.8", "", "mmol/L", ""),
        ("Albumin-creatinine ratio", f"{14 / 7.8:.1f}", "", "mg/mmol", "&lt; 2.5 (male)"),
    ],
    "Normal renal function (eGFR &gt; 90, CKD stage G1 range) and no microalbuminuria (A1). Suitable to continue "
    "metformin at the current dose. Annual repeat recommended for diabetic kidney disease screening.",
)


# ---------------------------------------------------------------- 3. ECG
def ecg_lead_templates():
    """Per-beat Gaussian wave amplitudes (mV) for leads I, II and V1–V6.
    Limb leads III, aVR, aVL, aVF are derived from I and II (Einthoven / Goldberger)."""
    return {
        "I": dict(P=0.08, Q=-0.04, R=0.72, S=-0.12, T=0.22),
        "II": dict(P=0.13, Q=-0.05, R=1.12, S=-0.16, T=0.32),
        "V1": dict(P=0.06, Q=0.0, R=0.24, S=-0.95, T=-0.06),
        "V2": dict(P=0.07, Q=0.0, R=0.48, S=-1.30, T=0.42),
        "V3": dict(P=0.07, Q=0.0, R=0.92, S=-0.82, T=0.46),
        "V4": dict(P=0.07, Q=-0.05, R=1.55, S=-0.45, T=0.40),
        "V5": dict(P=0.07, Q=-0.08, R=1.40, S=-0.20, T=0.32),
        "V6": dict(P=0.06, Q=-0.08, R=1.12, S=-0.10, T=0.26),
    }


def beat(t, amp):
    """One PQRST complex centred on the R peak at t=0 (seconds). PR 156 ms, QRS ~92 ms, QT ~380 ms."""
    g = lambda mu, s: np.exp(-0.5 * ((t - mu) / s) ** 2)
    # T wave: slower upstroke than downstroke
    t_wave = np.where(t < 0.255, np.exp(-0.5 * ((t - 0.255) / 0.062) ** 2), np.exp(-0.5 * ((t - 0.255) / 0.038) ** 2))
    return (
        amp["P"] * g(-0.165, 0.024)
        + amp["Q"] * g(-0.030, 0.009)
        + amp["R"] * g(0.0, 0.0105)
        + amp["S"] * g(0.030, 0.011)
        + amp["T"] * t_wave
    )


def make_ecg(seconds=10.0, fs=500, rate=76, seed=7):
    rng = np.random.default_rng(seed)
    t = np.arange(0, seconds, 1 / fs)
    rr_mean = 60 / rate
    peaks, x = [], 0.45
    while x < seconds + 1:
        peaks.append(x)
        # mild respiratory sinus arrhythmia
        x += rr_mean + 0.03 * math.sin(2 * math.pi * x / 4.2) + rng.normal(0, 0.008)
    tmpl = ecg_lead_templates()
    sig = {}
    for lead, amp in tmpl.items():
        y = np.zeros_like(t)
        for p in peaks:
            y += beat(t - p, amp)
        sig[lead] = y
    sig["III"] = sig["II"] - sig["I"]
    sig["aVR"] = -(sig["I"] + sig["II"]) / 2
    sig["aVL"] = sig["I"] - sig["II"] / 2
    sig["aVF"] = sig["II"] - sig["I"] / 2
    for lead in sig:
        sig[lead] = sig[lead] + 0.025 * np.sin(2 * np.pi * 0.28 * t + rng.uniform(0, 6)) + rng.normal(0, 0.006, t.size)
    return t, sig, np.diff(peaks).mean()


def ecg_pdf(filename):
    from reportlab.pdfgen import canvas

    w, h = landscape(A4)
    c = canvas.Canvas(str(OUT / filename), pagesize=(w, h))
    c.setTitle(f"12-Lead Resting ECG - {PATIENT['name']}")
    c.setAuthor("NFC MediCard Demo Laboratory")
    t, sig, rr = make_ecg()
    rate = 60 / rr
    qt = 0.380
    qtc = qt / math.sqrt(rr)

    # header
    c.setFillColor(TEAL)
    c.rect(0, h - 15 * mm, w, 15 * mm, stroke=0, fill=1)
    c.setFillColor(colors.white)
    c.setFont("Arial-Bold", 12)
    c.drawString(12 * mm, h - 9.5 * mm, "NFC MediCard Demo  ·  12-Lead Resting ECG")
    c.setFont("Arial-Bold", 9)
    c.drawRightString(w - 12 * mm, h - 9.5 * mm, "SAMPLE ECG")

    c.setFillColor(INK)
    y0 = h - 22 * mm
    info = [
        (PATIENT["name"], f"IC {PATIENT['ic']}", f"{PATIENT['age_sex']}  ·  172 cm  ·  68 kg", "Recorded 05/10/2026 09:24", f"Requested by {PATIENT['doctor']}"),
    ]
    c.setFont("Arial-Bold", 10)
    c.drawString(12 * mm, y0, info[0][0])
    c.setFont("Arial", 8.5)
    for i, s in enumerate(info[0][1:]):
        c.drawString(12 * mm, y0 - (i + 1) * 4.2 * mm, s)

    meas = [
        ("Vent. rate", f"{rate:.0f} bpm"),
        ("PR interval", "156 ms"),
        ("QRS duration", "92 ms"),
        ("QT / QTc (Bazett)", f"{qt * 1000:.0f} / {qtc * 1000:.0f} ms"),
        ("P-R-T axes", "54   49   42"),
    ]
    mx = 92 * mm
    for i, (k_, v) in enumerate(meas):
        c.setFont("Arial", 8.5)
        c.setFillColor(MUTED)
        c.drawString(mx, y0 - i * 4.2 * mm, k_)
        c.setFont("Arial-Bold", 8.5)
        c.setFillColor(INK)
        c.drawString(mx + 30 * mm, y0 - i * 4.2 * mm, v)

    c.setFont("Arial-Bold", 9.5)
    c.drawString(170 * mm, y0, "Interpretation")
    c.setFont("Arial", 8.5)
    for i, s in enumerate([
        "Sinus rhythm, normal axis.",
        "Normal intervals. No LVH by voltage criteria.",
        "No acute ST-segment or T-wave changes.",
        "Normal ECG.",
        "Indication: hypertension review, type 2 diabetes.",
    ]):
        c.drawString(170 * mm, y0 - (i + 1) * 4.2 * mm, s)

    # ECG paper: 25 mm/s, 10 mm/mV
    gx0, gx1 = 12 * mm, w - 12 * mm
    gy0, gy1 = 14 * mm, h - 48 * mm
    c.setFillColor(colors.HexColor("#FFF5F5"))
    c.rect(gx0, gy0, gx1 - gx0, gy1 - gy0, stroke=0, fill=1)
    minor, major = colors.HexColor("#F7C6C6"), colors.HexColor("#EE8E8E")
    n_x = int((gx1 - gx0) / mm)
    n_y = int((gy1 - gy0) / mm)
    for i in range(n_x + 1):
        c.setStrokeColor(major if i % 5 == 0 else minor)
        c.setLineWidth(0.6 if i % 5 == 0 else 0.25)
        c.line(gx0 + i * mm, gy0, gx0 + i * mm, gy0 + n_y * mm)
    for j in range(n_y + 1):
        c.setStrokeColor(major if j % 5 == 0 else minor)
        c.setLineWidth(0.6 if j % 5 == 0 else 0.25)
        c.line(gx0, gy0 + j * mm, gx0 + n_x * mm, gy0 + j * mm)

    paper_h = n_y * mm
    row_h = paper_h / 4
    cal_w = 8 * mm  # calibration pulse area
    x_start = gx0 + cal_w
    sec = 25 * mm
    mv = 10 * mm
    layout = [["I", "aVR", "V1", "V4"], ["II", "aVL", "V2", "V5"], ["III", "aVF", "V3", "V6"]]

    def trace(x0, base, seg_t, seg_y):
        p = c.beginPath()
        p.moveTo(x0 + (seg_t[0] - seg_t[0]) * sec, base + seg_y[0] * mv)
        for tt, yy in zip(seg_t[1:], seg_y[1:]):
            p.lineTo(x0 + (tt - seg_t[0]) * sec, base + yy * mv)
        c.drawPath(p, stroke=1, fill=0)

    def cal_pulse(base):
        c.setLineWidth(0.9)
        x = gx0 + 1.5 * mm
        p = c.beginPath()
        p.moveTo(x, base)
        p.lineTo(x + 1 * mm, base)
        p.lineTo(x + 1 * mm, base + mv)
        p.lineTo(x + 6 * mm, base + mv)
        p.lineTo(x + 6 * mm, base)
        p.lineTo(x + 7 * mm, base)
        c.drawPath(p, stroke=1, fill=0)

    c.setStrokeColor(colors.black)
    for r, leads in enumerate(layout + [["II"]]):
        base = gy0 + paper_h - (r + 0.58) * row_h
        cal_pulse(base)
        c.setLineWidth(0.75)
        if r < 3:
            for col, lead in enumerate(leads):
                a, b = col * 2.5, (col + 1) * 2.5
                m = (t >= a) & (t < b)
                trace(x_start + col * 2.5 * sec, base, t[m], sig[lead][m])
                if col > 0:
                    xs = x_start + col * 2.5 * sec
                    c.line(xs, base - 2.5 * mm, xs, base + 2.5 * mm)
                c.setFont("Arial-Bold", 9)
                c.setFillColor(colors.black)
                c.drawString(x_start + col * 2.5 * sec + 2.5 * mm, base + 12 * mm, lead)
        else:
            m = t < (gx1 - x_start) / sec
            trace(x_start, base, t[m], sig["II"][m])
            c.setFont("Arial-Bold", 9)
            c.drawString(x_start + 2.5 * mm, base + 12 * mm, "II (rhythm)")

    c.setFont("Arial", 7.5)
    c.setFillColor(MUTED)
    c.drawString(12 * mm, 9 * mm, "25 mm/s   10 mm/mV   Filter 0.05–150 Hz   50 Hz notch")
    c.drawRightString(w - 12 * mm, 9 * mm, "Sample ECG generated for the NFC MediCard demo. Not a real person's recording.")
    c.showPage()
    c.save()
    return rate, qtc


rate, qtc = ecg_pdf("ahmad-faiz-2026-10-05-ecg-12-lead.pdf")
print(f"ECG rate {rate:.1f} bpm, QTc {qtc * 1000:.0f} ms, eGFR {egfr:.0f}, LDL {ldl:.2f}")
for f in sorted(OUT.glob("*.pdf")):
    print(f.name, f.stat().st_size)
