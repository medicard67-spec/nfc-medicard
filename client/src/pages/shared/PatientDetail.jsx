import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  FileText, ClipboardList, FlaskConical, ScanLine, Bandage, TriangleAlert, Phone, Pill, X, Pencil, Check,
  Users, Share2, BedDouble, ChevronDown, ChevronRight, LogOut, RefreshCw,
} from "lucide-react";
import api from "../../lib/api.js";
import Card from "../../components/Card.jsx";
import Avatar from "../../components/Avatar.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { SkeletonList } from "../../components/Skeleton.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { exportPatientRecordPdf } from "../../lib/exportPdf.js";
import { HOSPITAL_DEPARTMENTS } from "../../lib/hospitalDepartments.js";
import { RENEWAL_FREQUENCIES, RENEWAL_FREQUENCY_LABELS } from "../../lib/medicationRenewal.js";

const TABS = ["Emergency", "History", "Medications", "Lab Results", "Imaging", "Update Record", "Message"];

export default function PatientDetail() {
  const { id } = useParams();
  const [patient, setPatient] = useState(null);
  const [history, setHistory] = useState([]);
  const [medications, setMedications] = useState([]);
  const [labs, setLabs] = useState([]);
  const [radiology, setRadiology] = useState([]);
  const [admissions, setAdmissions] = useState([]);
  const [tab, setTab] = useState("Emergency");
  const [loading, setLoading] = useState(true);

  const load = () => {
    api.get(`/patients/${id}`).then((res) => setPatient(res.data));
    api.get("/medical-history", { params: { patientId: id } }).then((res) => setHistory(res.data));
    api.get("/medications", { params: { patientId: id } }).then((res) => setMedications(res.data));
    api.get("/lab-results", { params: { patientId: id } }).then((res) => setLabs(res.data));
    api.get("/admissions", { params: { patientId: id } }).then((res) => setAdmissions(res.data));
    api
      .get("/radiology", { params: { patientId: id } })
      .then((res) => setRadiology(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);
  useEffect(() => setTab("Emergency"), [id]);

  const medicationsNeedRenewal = medications.some((m) => {
    if (!m.endDate || m.renewalFrequency === "none") return false;
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    return m.endDate <= todayKey;
  });

  if (loading || !patient) {
    return (
      <div className="space-y-4">
        <SkeletonList rows={2} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={patient.name} url={patient.avatarUrl} size="sm" />
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">{patient.name}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              IC: {patient.ic} &middot; {patient.gender}, {patient.age} yrs
            </p>
          </div>
        </div>
        <button
          onClick={() => void exportPatientRecordPdf({ patient, history, medications, labs, radiology })}
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-soft hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <FileText size={15} />
          Export PDF
        </button>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800">
        {TABS.map((t) => {
          const medicationsAlert = t === "Medications" && medicationsNeedRenewal;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 rounded-t-lg px-4 py-2 text-sm font-medium ${
                medicationsAlert
                  ? tab === t
                    ? "border-b-2 border-red-600 text-red-700 dark:border-red-400 dark:text-red-300"
                    : "text-red-600 hover:text-red-700 dark:text-red-400"
                  : tab === t
                  ? "border-b-2 border-brand-600 dark:border-brand-400 text-brand-700 dark:text-brand-300"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
              }`}
            >
              {t === "Emergency" && <TriangleAlert size={14} className={tab === t ? "text-red-600 dark:text-red-400" : ""} />}
              {t === "Medications" && <Pill size={14} />}
              {t}
              {medicationsAlert && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
            </button>
          );
        })}
      </div>

      {tab === "Emergency" && <EmergencyTab patient={patient} />}
      {tab === "History" && <HistoryTab history={history} admissions={admissions} onSaved={load} />}
      {tab === "Medications" && <MedicationsTab medications={medications} patientId={id} onSaved={load} />}
      {tab === "Lab Results" && <LabsTab labs={labs} patientId={id} onUploaded={load} />}
      {tab === "Imaging" && <RadiologyTab images={radiology} patientId={id} onUploaded={load} />}
      {tab === "Update Record" && (
        <UpdateRecordTab patientId={id} admissions={admissions} onSaved={load} />
      )}
      {tab === "Message" && <MessageTab patientId={id} />}
    </div>
  );
}

function EmergencyTab({ patient }) {
  const allergies = patient.allergies?.length ? patient.allergies.join(", ") : "None recorded";
  const chronic = patient.chronicIllnesses?.length ? patient.chronicIllnesses.join(", ") : "None recorded";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
        <TriangleAlert size={16} />
        <p className="text-xs font-bold uppercase tracking-wide">Emergency Access · Read-Only</p>
      </div>

      <Card className="border-2 border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/40">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs text-red-500 dark:text-red-400/80">Blood Type</p>
            <p className="text-2xl font-bold text-red-700 dark:text-red-300">{patient.bloodType || "Unknown"}</p>
          </div>
          <div>
            <p className="text-xs text-red-500 dark:text-red-400/80">Severe Allergies</p>
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">{allergies}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs text-red-500 dark:text-red-400/80">Chronic Illnesses</p>
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">{chronic}</p>
          </div>
        </div>

        {(patient.emergencyContactName || patient.emergencyContactPhone) && (
          <div className="mt-4 flex items-center justify-between rounded-lg border border-red-200 bg-white/60 px-3 py-2 dark:border-red-900/60 dark:bg-red-950/20">
            <div>
              <p className="text-xs text-red-500 dark:text-red-400/80">Emergency Contact</p>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {patient.emergencyContactName || "Not provided"}
              </p>
            </div>
            {patient.emergencyContactPhone && (
              <a
                href={`tel:${patient.emergencyContactPhone}`}
                className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                <Phone size={14} />
                {patient.emergencyContactPhone}
              </a>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

function SearchBar({ value, onChange, placeholder }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="mb-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:max-w-xs"
    />
  );
}

function HistoryTab({ history, admissions, onSaved }) {
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const filtered = useMemo(
    () =>
      history.filter(
        (r) =>
          r.diagnosis?.toLowerCase().includes(search.toLowerCase()) ||
          r.physician?.toLowerCase().includes(search.toLowerCase())
      ),
    [history, search]
  );

  // Every doctor who has either written a record or been referred to, for a
  // quick "who's involved in this patient's care" overview.
  const doctorsInvolved = useMemo(() => {
    const map = new Map();
    // history is sorted newest-first, so the first time we see a doctor's
    // name is their most recent record -- keep that one rather than letting
    // an older (possibly stale, e.g. pre-migration default) department
    // overwrite it.
    history.forEach((r) => {
      if (r.physician && !map.has(r.physician)) map.set(r.physician, r.physicianDepartment || "General");
      if (r.referredToDoctorName && !map.has(r.referredToDoctorName)) {
        map.set(r.referredToDoctorName, r.referredToDoctorDepartment || "General");
      }
    });
    return Array.from(map, ([name, department]) => ({ name, department }));
  }, [history]);

  // Records written during an open/closed admission (a hospital stay) are
  // collected into one group in the timeline instead of showing every
  // update made during that stay individually.
  const timeline = useMemo(() => {
    const byAdmission = new Map();
    const standalone = [];
    filtered.forEach((r) => {
      if (r.admissionId) {
        if (!byAdmission.has(r.admissionId)) byAdmission.set(r.admissionId, []);
        byAdmission.get(r.admissionId).push(r);
      } else {
        standalone.push(r);
      }
    });
    const admissionItems = Array.from(byAdmission, ([admissionId, records]) => ({
      type: "admission",
      key: admissionId,
      admission: admissions.find((a) => a.id === admissionId),
      records,
      sortAt: records[0].createdAt,
    }));
    const standaloneItems = standalone.map((r) => ({ type: "record", key: r.id, record: r, sortAt: r.createdAt }));
    return [...admissionItems, ...standaloneItems].sort((a, b) => new Date(b.sortAt) - new Date(a.sortAt));
  }, [filtered, admissions]);

  if (history.length === 0) {
    return <EmptyState icon={ClipboardList} title="No history records" subtitle="Records added via Update Record will appear here." />;
  }

  return (
    <div className="space-y-4">
      {doctorsInvolved.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/50">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            <Users size={13} /> Doctors Involved
          </p>
          <div className="flex flex-wrap gap-2">
            {doctorsInvolved.map((d) => (
              <span
                key={d.name}
                className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-soft dark:bg-slate-800 dark:text-slate-200"
              >
                {d.name} <span className="text-slate-400 dark:text-slate-500">&middot; {d.department}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <SearchBar value={search} onChange={setSearch} placeholder="Search diagnosis or physician..." />
      <div className="space-y-3">
        {timeline.map((item) =>
          item.type === "admission" ? (
            <AdmissionGroup
              key={item.key}
              admission={item.admission}
              records={item.records}
              editingId={editingId}
              setEditingId={setEditingId}
              onSaved={onSaved}
            />
          ) : (
            <HistoryRecordCard
              key={item.key}
              record={item.record}
              isEditing={editingId === item.record.id}
              onEdit={() => setEditingId(item.record.id)}
              onCancel={() => setEditingId(null)}
              onSaved={() => {
                setEditingId(null);
                onSaved();
              }}
            />
          )
        )}
        {filtered.length === 0 && (
          <p className="text-sm text-slate-400 dark:text-slate-500">No records match "{search}".</p>
        )}
      </div>
    </div>
  );
}

function formatDateTime(iso) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function AdmissionGroup({ admission, records, editingId, setEditingId, onSaved }) {
  const [expanded, setExpanded] = useState(false);
  const ongoing = admission && !admission.dischargedAt;

  return (
    <Card className={`p-0 ${ongoing ? "border-2 border-brand-300 dark:border-brand-700" : ""}`}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 dark:bg-brand-900 dark:text-brand-200">
            <BedDouble size={16} />
          </span>
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              Admission{admission?.ward && ` · ${admission.ward}`}
              {ongoing && (
                <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-700 dark:bg-brand-900 dark:text-brand-200">
                  Ongoing
                </span>
              )}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {admission ? formatDateTime(admission.admittedAt) : "—"}
              {" – "}
              {admission?.dischargedAt ? formatDateTime(admission.dischargedAt) : "present"}
              {" · "}
              {records.length} record{records.length > 1 ? "s" : ""}
              {admission?.admittedBy && <> &middot; Admitted by {admission.admittedBy}</>}
            </p>
          </div>
        </div>
        {expanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
      </button>
      {expanded && (
        <div className="space-y-3 border-t border-slate-200 p-4 dark:border-slate-800">
          {admission?.reason && (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              <span className="font-medium text-slate-700 dark:text-slate-200">Reason for admission:</span> {admission.reason}
            </p>
          )}
          {records.map((r) => (
            <HistoryRecordCard
              key={r.id}
              record={r}
              isEditing={editingId === r.id}
              onEdit={() => setEditingId(r.id)}
              onCancel={() => setEditingId(null)}
              onSaved={() => {
                setEditingId(null);
                onSaved();
              }}
              nested
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function HistoryRecordCard({ record: r, isEditing, onEdit, onCancel, onSaved, nested }) {
  if (isEditing) {
    return <HistoryRecordEditForm record={r} onCancel={onCancel} onSaved={onSaved} />;
  }

  return (
    <Card className={nested ? "border border-slate-200 dark:border-slate-800" : ""}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-slate-800 dark:text-slate-100">{r.diagnosis}</p>
        <button
          onClick={onEdit}
          className="flex flex-shrink-0 items-center gap-1 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
        >
          <Pencil size={12} /> Edit
        </button>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {r.date} &middot; {r.physician}
        {r.physicianDepartment && <> &middot; {r.physicianDepartment}</>}
      </p>
      {(r.referredToDoctorName || r.referredToDepartment) && (
        <p className="mt-1 flex items-center gap-1 text-xs font-medium text-brand-600 dark:text-brand-400">
          <Share2 size={12} />
          Referred to{" "}
          {[
            r.referredToDoctorName &&
              (r.referredToDoctorDepartment
                ? `${r.referredToDoctorName} (${r.referredToDoctorDepartment})`
                : r.referredToDoctorName),
            r.referredToDepartment && `${r.referredToDepartment} department`,
          ]
            .filter(Boolean)
            .join(" & ")}
        </p>
      )}
      {r.remarks && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{r.remarks}</p>}
      {r.imageUrls?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {r.imageUrls.map((url) => (
            <a key={url} href={url} target="_blank" rel="noreferrer">
              <img src={url} alt="Attached" className="h-20 w-20 rounded-lg object-cover" />
            </a>
          ))}
        </div>
      )}
    </Card>
  );
}

function HistoryRecordEditForm({ record, onCancel, onSaved }) {
  const toast = useToast();
  const [diagnosis, setDiagnosis] = useState(record.diagnosis);
  const [date, setDate] = useState(record.date);
  const [remarks, setRemarks] = useState(record.remarks || "");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/medical-history/${record.id}`, { diagnosis, date, remarks });
      toast.success("Record updated.");
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update record.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Diagnosis</label>
          <input
            required
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Date</label>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Clinical Remarks</label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={4}
            className="w-full whitespace-pre-wrap rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            <Check size={14} /> {saving ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <X size={14} /> Cancel
          </button>
        </div>
      </form>
    </Card>
  );
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(dateStr) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function medicationDateLine(m) {
  if (m.renewalFrequency && m.renewalFrequency !== "none") {
    const label = RENEWAL_FREQUENCY_LABELS[m.renewalFrequency] || m.renewalFrequency;
    return `${formatDate(m.startDate)} – ${formatDate(m.endDate)} · renews ${label.toLowerCase()}`;
  }
  return `Since ${formatDate(m.startDate)}`;
}

function MedicationsTab({ medications, patientId, onSaved }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState("");
  const [startDate, setStartDate] = useState("");
  const [renewalFrequency, setRenewalFrequency] = useState("none");
  const [saving, setSaving] = useState(false);
  const [renewingId, setRenewingId] = useState(null);

  const today = todayKey();
  const needsRenewal = medications.filter((m) => m.renewalFrequency !== "none" && m.endDate && m.endDate <= today);
  const current = medications.filter((m) => !m.endDate || m.endDate > today);
  const past = medications.filter((m) => m.endDate && m.endDate <= today && m.renewalFrequency === "none");

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/medications", {
        patientId, name, dosage, frequency, renewalFrequency, startDate: startDate || undefined,
      });
      setName("");
      setDosage("");
      setFrequency("");
      setStartDate("");
      setRenewalFrequency("none");
      onSaved();
      toast.success("Medication added.");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to add medication.");
    } finally {
      setSaving(false);
    }
  };

  const renew = async (id) => {
    setRenewingId(id);
    try {
      await api.patch(`/medications/${id}/renew`);
      onSaved();
      toast.success("Medication renewed.");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to renew medication.");
    } finally {
      setRenewingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card title="Add Medication">
        <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Medicine Name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Amoxicillin"
              className="rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Dosage</label>
            <input
              required
              value={dosage}
              onChange={(e) => setDosage(e.target.value)}
              placeholder="e.g. 500 mg"
              className="w-28 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Frequency (optional)</label>
            <input
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              placeholder="e.g. Twice daily"
              className="rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Renews</label>
            <select
              value={renewalFrequency}
              onChange={(e) => setRenewalFrequency(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-3 py-2 text-sm"
            >
              {RENEWAL_FREQUENCIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <button
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            <Pill size={15} /> {saving ? "Adding..." : "Add"}
          </button>
        </form>
      </Card>

      {medications.length === 0 ? (
        <EmptyState icon={Pill} title="No medications recorded" subtitle="Medicines added here will show as current until they're due for renewal." />
      ) : (
        <>
          {needsRenewal.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">
                <TriangleAlert size={13} /> Needs Renewal ({needsRenewal.length})
              </p>
              <div className="space-y-2">
                {needsRenewal.map((m) => (
                  <Card key={m.id} className="border-2 border-red-400 bg-red-50 dark:border-red-700 dark:bg-red-950/30">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-red-800 dark:text-red-200">
                          {m.name} <span className="font-normal text-red-600 dark:text-red-400">&middot; {m.dosage}</span>
                        </p>
                        <p className="text-xs text-red-600 dark:text-red-400">
                          {m.frequency && <>{m.frequency} &middot; </>}
                          {medicationDateLine(m)} &middot; expired &middot; {m.prescribedBy}
                        </p>
                      </div>
                      <button
                        onClick={() => renew(m.id)}
                        disabled={renewingId === m.id}
                        className="flex flex-shrink-0 items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                      >
                        <RefreshCw size={12} /> {renewingId === m.id ? "Renewing..." : "Renew"}
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Current ({current.length})
            </p>
            {current.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500">No medications currently being taken.</p>
            ) : (
              <div className="space-y-2">
                {current.map((m) => (
                  <Card key={m.id} className="border-l-4 border-l-brand-500">
                    <p className="font-semibold text-slate-800 dark:text-slate-100">
                      {m.name} <span className="font-normal text-slate-500 dark:text-slate-400">&middot; {m.dosage}</span>
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {m.frequency && <>{m.frequency} &middot; </>}
                      {medicationDateLine(m)} &middot; {m.prescribedBy}
                    </p>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {past.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Past ({past.length})
              </p>
              <div className="space-y-2">
                {past.map((m) => (
                  <Card key={m.id} className="opacity-70">
                    <p className="font-semibold text-slate-700 dark:text-slate-200">
                      {m.name} <span className="font-normal text-slate-500 dark:text-slate-400">&middot; {m.dosage}</span>
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {m.frequency && <>{m.frequency} &middot; </>}
                      {formatDate(m.startDate)} &ndash; {formatDate(m.endDate)} &middot; {m.prescribedBy}
                    </p>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function LabsTab({ labs, patientId, onUploaded }) {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [testName, setTestName] = useState("");
  const [file, setFile] = useState(null);
  const [flagged, setFlagged] = useState(false);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(
    () => labs.filter((r) => r.testName?.toLowerCase().includes(search.toLowerCase())),
    [labs, search]
  );

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const form = new FormData();
      form.append("patientId", patientId);
      form.append("testName", testName);
      form.append("flagged", flagged);
      if (file) form.append("file", file);
      await api.post("/lab-results", form, { headers: { "Content-Type": "multipart/form-data" } });
      setTestName("");
      setFile(null);
      setFlagged(false);
      onUploaded();
      toast.success("Lab result added.");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to add lab result.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card title="Add Lab Result">
        <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Test Name</label>
            <input
              required
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">File (optional)</label>
            <input type="file" onChange={(e) => setFile(e.target.files[0])} className="text-sm" />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={flagged} onChange={(e) => setFlagged(e.target.checked)} />
            Abnormal result
          </label>
          <button
            disabled={saving}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Add Result"}
          </button>
        </form>
      </Card>

      {labs.length === 0 ? (
        <EmptyState icon={FlaskConical} title="No lab results yet" subtitle="Uploaded results will appear here." />
      ) : (
        <div>
          <SearchBar value={search} onChange={setSearch} placeholder="Search test name..." />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {filtered.map((r) => (
              <Card key={r.id}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{r.testName}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{r.date}</p>
                  </div>
                  {r.flagged && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600 dark:bg-red-950 dark:text-red-300">
                      Abnormal
                    </span>
                  )}
                </div>
                {r.fileUrl && (
                  <a href={r.fileUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-brand-600 dark:text-brand-400 hover:underline">
                    View File
                  </a>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RadiologyTab({ images, patientId, onUploaded }) {
  const toast = useToast();
  const [type, setType] = useState("X-ray");
  const [anatomy, setAnatomy] = useState("");
  const [classification, setClassification] = useState("");
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!file) return;
    setSaving(true);
    try {
      const form = new FormData();
      form.append("patientId", patientId);
      form.append("type", type);
      form.append("anatomy", anatomy);
      form.append("classification", classification);
      form.append("file", file);
      await api.post("/radiology", form, { headers: { "Content-Type": "multipart/form-data" } });
      setAnatomy("");
      setClassification("");
      setFile(null);
      onUploaded();
      toast.success("Imaging record uploaded.");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to upload imaging record.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card title="Upload Imaging Record">
        <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-3 py-2 text-sm">
              <option>X-ray</option>
              <option>MRI</option>
              <option>CT Scan</option>
              <option>Wound Care</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Anatomy</label>
            <input
              value={anatomy}
              onChange={(e) => setAnatomy(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-3 py-2 text-sm"
              placeholder="e.g. Left forearm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Classification</label>
            <input
              value={classification}
              onChange={(e) => setClassification(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-3 py-2 text-sm"
              placeholder={type === "Wound Care" ? "e.g. Laceration, healing well" : "e.g. Bone fracture"}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Image File</label>
            <input required type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0])} className="text-sm" />
          </div>
          <button disabled={saving} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
            {saving ? "Uploading..." : "Upload"}
          </button>
        </form>
      </Card>

      {images.length === 0 ? (
        <EmptyState icon={ScanLine} title="No imaging records yet" subtitle="Uploaded X-rays, MRIs, CT scans, and wound care photos will appear here." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((img) => (
            <Card key={img.id} className="p-3">
              <a href={img.fileUrl} target="_blank" rel="noreferrer">
                <img src={img.fileUrl} alt={img.type} className="mb-2 h-28 w-full rounded-lg object-cover" />
              </a>
              <p className="flex items-center gap-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                {img.type === "Wound Care" && <Bandage size={13} />} {img.type}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{img.anatomy}</p>
              {img.classification && (
                <p className="text-xs text-slate-500 dark:text-slate-400">{img.classification}</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function UpdateRecordTab({ patientId, admissions, onSaved }) {
  const toast = useToast();
  const [diagnosis, setDiagnosis] = useState("");
  const [remarks, setRemarks] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [images, setImages] = useState([]);
  const [saving, setSaving] = useState(false);

  const [doctors, setDoctors] = useState([]);
  const [referDoctorName, setReferDoctorName] = useState("");
  const [referDepartment, setReferDepartment] = useState("");

  useEffect(() => {
    api.get("/users/doctors").then((res) => setDoctors(res.data));
  }, []);

  const activeAdmission = admissions.find((a) => !a.dischargedAt);

  const departments = useMemo(
    () =>
      Array.from(new Set([...HOSPITAL_DEPARTMENTS, ...doctors.map((d) => d.department).filter(Boolean)])).sort(),
    [doctors]
  );

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const form = new FormData();
      form.append("patientId", patientId);
      form.append("diagnosis", diagnosis);
      form.append("remarks", remarks);
      images.forEach((file) => form.append("images", file));
      if (referDoctorName.trim()) form.append("referredToDoctorName", referDoctorName.trim());
      if (referDepartment.trim()) form.append("referredToDepartment", referDepartment.trim());
      await api.post("/medical-history", form, { headers: { "Content-Type": "multipart/form-data" } });
      if (appointmentDate) {
        await api.post("/appointments", { patientId, date: appointmentDate, notes: remarks });
      }
      setDiagnosis("");
      setRemarks("");
      setAppointmentDate("");
      setImages([]);
      setReferDoctorName("");
      setReferDepartment("");
      onSaved();
      toast.success("Patient record updated.");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update record.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <AdmissionPanel patientId={patientId} activeAdmission={activeAdmission} onChanged={onSaved} />

      <Card title="Update Patient Record">
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Diagnosis / Treatment Result</label>
          <input
            required
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Clinical Remarks</label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Schedule Next Appointment (optional)</label>
          <input
            type="date"
            value={appointmentDate}
            onChange={(e) => setAppointmentDate(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
            Attach Photos (optional, e.g. injuries, wounds, rashes)
          </label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setImages(Array.from(e.target.files))}
            className="text-sm"
          />
          {images.length > 0 && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {images.length} photo{images.length > 1 ? "s" : ""} selected
            </p>
          )}
        </div>
        <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <label className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
            <Share2 size={13} /> Send to Another Doctor (optional)
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Doctor</label>
              <input
                list="refer-doctor-options"
                value={referDoctorName}
                onChange={(e) => setReferDoctorName(e.target.value)}
                placeholder="Type or pick a name..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <datalist id="refer-doctor-options">
                {doctors.map((d) => (
                  <option key={d.uid} value={d.name}>
                    {d.department}
                  </option>
                ))}
              </datalist>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Department</label>
              <input
                list="refer-department-options"
                value={referDepartment}
                onChange={(e) => setReferDepartment(e.target.value)}
                placeholder="Type or pick a department..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <datalist id="refer-department-options">
                {departments.map((dep) => (
                  <option key={dep} value={dep} />
                ))}
              </datalist>
            </div>
          </div>
        </div>
        <button
          disabled={saving}
          className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {saving ? "Submitting..." : "Submit Update"}
        </button>
      </form>
      </Card>
    </div>
  );
}

function AdmissionPanel({ patientId, activeAdmission, onChanged }) {
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [ward, setWard] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const admit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/admissions", { patientId, ward, reason });
      setShowForm(false);
      setWard("");
      setReason("");
      onChanged();
      toast.success("Patient admitted.");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to admit patient.");
    } finally {
      setSaving(false);
    }
  };

  const discharge = async () => {
    setSaving(true);
    try {
      await api.patch(`/admissions/${activeAdmission.id}/discharge`);
      onChanged();
      toast.success("Patient discharged.");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to discharge patient.");
    } finally {
      setSaving(false);
    }
  };

  if (activeAdmission) {
    return (
      <Card className="border-2 border-brand-300 bg-brand-50 dark:border-brand-700 dark:bg-brand-900/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white text-brand-700 dark:bg-slate-800 dark:text-brand-300">
              <BedDouble size={16} />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Admitted{activeAdmission.ward && ` · ${activeAdmission.ward}`}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Since {formatDateTime(activeAdmission.admittedAt)} by {activeAdmission.admittedBy}
                {activeAdmission.reason && <> &middot; {activeAdmission.reason}</>}
              </p>
            </div>
          </div>
          <button
            onClick={discharge}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <LogOut size={14} /> {saving ? "Discharging..." : "Discharge Patient"}
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      {!showForm ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <BedDouble size={16} />
            </span>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Not currently admitted</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <BedDouble size={14} /> Admit Patient
          </button>
        </div>
      ) : (
        <form onSubmit={admit} className="space-y-3">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Admit Patient</p>
          <div className="flex flex-wrap gap-3">
            <div>
              <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Ward / Room</label>
              <input
                value={ward}
                onChange={(e) => setWard(e.target.value)}
                placeholder="e.g. Ward 3A"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Reason (optional)</label>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Observation post-surgery"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              <Check size={14} /> {saving ? "Admitting..." : "Confirm Admission"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <X size={14} /> Cancel
            </button>
          </div>
        </form>
      )}
    </Card>
  );
}

function MessageTab({ patientId }) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api.post("/messages/mark-read", { patientId });
  }, [patientId]);

  const submit = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      await api.post("/messages", { patientId, text });
      setText("");
      toast.success("Message sent to patient.");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card title="Message Patient">
      <form onSubmit={submit} className="space-y-3">
        <textarea
          required
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="e.g. Your latest results are ready. Please schedule a follow-up."
          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-3 py-2 text-sm"
        />
        <button
          disabled={sending}
          className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {sending ? "Sending..." : "Send Message"}
        </button>
      </form>
    </Card>
  );
}
