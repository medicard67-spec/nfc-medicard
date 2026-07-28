import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../../lib/api.js";
import EmergencyBanner from "../../components/EmergencyBanner.jsx";
import Card from "../../components/Card.jsx";
import Avatar from "../../components/Avatar.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { SkeletonList } from "../../components/Skeleton.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { exportPatientRecordPdf } from "../../lib/exportPdf.js";

const TABS = ["History", "Lab Results", "Imaging", "Update Record", "Message"];

export default function DoctorPatientDetail() {
  const { id } = useParams();
  const [patient, setPatient] = useState(null);
  const [history, setHistory] = useState([]);
  const [labs, setLabs] = useState([]);
  const [radiology, setRadiology] = useState([]);
  const [tab, setTab] = useState("History");
  const [loading, setLoading] = useState(true);

  const load = () => {
    api.get(`/patients/${id}`).then((res) => setPatient(res.data));
    api.get("/medical-history", { params: { patientId: id } }).then((res) => setHistory(res.data));
    api.get("/lab-results", { params: { patientId: id } }).then((res) => setLabs(res.data));
    api
      .get("/radiology", { params: { patientId: id } })
      .then((res) => setRadiology(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

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
          onClick={() => void exportPatientRecordPdf({ patient, history, labs, radiology })}
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-soft hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          📄 Export PDF
        </button>
      </div>

      <EmergencyBanner patient={patient} />

      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium ${
              tab === t
                ? "border-b-2 border-brand-600 dark:border-brand-400 text-brand-700 dark:text-brand-300"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "History" && <HistoryTab history={history} />}
      {tab === "Lab Results" && <LabsTab labs={labs} patientId={id} onUploaded={load} />}
      {tab === "Imaging" && <RadiologyTab images={radiology} patientId={id} onUploaded={load} />}
      {tab === "Update Record" && <UpdateRecordTab patientId={id} onSaved={load} />}
      {tab === "Message" && <MessageTab patientId={id} />}
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

function HistoryTab({ history }) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(
    () =>
      history.filter(
        (r) =>
          r.diagnosis?.toLowerCase().includes(search.toLowerCase()) ||
          r.physician?.toLowerCase().includes(search.toLowerCase())
      ),
    [history, search]
  );

  if (history.length === 0) {
    return <EmptyState icon="📋" title="No history records" subtitle="Records added via Update Record will appear here." />;
  }

  return (
    <div>
      <SearchBar value={search} onChange={setSearch} placeholder="Search diagnosis or physician..." />
      <div className="space-y-3">
        {filtered.map((r) => (
          <Card key={r.id}>
            <p className="font-semibold text-slate-800 dark:text-slate-100">{r.diagnosis}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {r.date} &middot; {r.physician}
            </p>
            {r.remarks && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{r.remarks}</p>}
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
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-slate-400 dark:text-slate-500">No records match "{search}".</p>
        )}
      </div>
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
        <EmptyState icon="🧪" title="No lab results yet" subtitle="Uploaded results will appear here." />
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
        <EmptyState icon="🩻" title="No imaging records yet" subtitle="Uploaded X-rays, MRIs, CT scans, and wound care photos will appear here." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((img) => (
            <Card key={img.id} className="p-3">
              <a href={img.fileUrl} target="_blank" rel="noreferrer">
                <img src={img.fileUrl} alt={img.type} className="mb-2 h-28 w-full rounded-lg object-cover" />
              </a>
              <p className="flex items-center gap-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                {img.type === "Wound Care" && "🩹"} {img.type}
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

function UpdateRecordTab({ patientId, onSaved }) {
  const toast = useToast();
  const [diagnosis, setDiagnosis] = useState("");
  const [remarks, setRemarks] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [images, setImages] = useState([]);
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const form = new FormData();
      form.append("patientId", patientId);
      form.append("diagnosis", diagnosis);
      form.append("remarks", remarks);
      images.forEach((file) => form.append("images", file));
      await api.post("/medical-history", form, { headers: { "Content-Type": "multipart/form-data" } });
      if (appointmentDate) {
        await api.post("/appointments", { patientId, date: appointmentDate, notes: remarks });
      }
      setDiagnosis("");
      setRemarks("");
      setAppointmentDate("");
      setImages([]);
      onSaved();
      toast.success("Patient record updated.");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update record.");
    } finally {
      setSaving(false);
    }
  };

  return (
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
        <button
          disabled={saving}
          className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {saving ? "Submitting..." : "Submit Update"}
        </button>
      </form>
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
