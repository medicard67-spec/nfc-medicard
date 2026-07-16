import { useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import api from "../../lib/api.js";
import Card from "../../components/Card.jsx";
import { exportPatientRecordPdf } from "../../lib/exportPdf.js";
import { useToast } from "../../context/ToastContext.jsx";

function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs text-slate-400 dark:text-slate-500">{label}</p>
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{value || "—"}</p>
    </div>
  );
}

export default function PatientProfile() {
  const { profile } = useAuth();
  const toast = useToast();
  const [exporting, setExporting] = useState(false);

  if (!profile) return null;

  const handleExport = async () => {
    setExporting(true);
    try {
      const [history, labs, radiology] = await Promise.all([
        api.get("/medical-history", { params: { patientId: profile.uid } }).then((r) => r.data),
        api.get("/lab-results", { params: { patientId: profile.uid } }).then((r) => r.data),
        api.get("/radiology", { params: { patientId: profile.uid } }).then((r) => r.data),
      ]);
      exportPatientRecordPdf({ patient: profile, history, labs, radiology });
      toast.success("PDF downloaded.");
    } catch (err) {
      toast.error("Failed to generate PDF.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Profile Summary</h1>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-soft hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          {exporting ? "Preparing..." : "📄 Export as PDF"}
        </button>
      </div>

      <Card>
        <div className="mb-4 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-700 text-2xl font-bold text-brand-700 dark:text-brand-100">
            {profile.name?.charAt(0)}
          </div>
          <div>
            <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{profile.name}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">IC: {profile.ic}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Blood Type: {profile.bloodType}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="Date of Birth" value={profile.dob} />
          <Field label="Age" value={profile.age} />
          <Field label="Gender" value={profile.gender} />
          <Field label="Height (cm)" value={profile.height} />
          <Field label="Weight (kg)" value={profile.weight} />
          <Field label="Card UID" value={profile.cardUid} />
        </div>
      </Card>

      <Card title="Contact">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="Phone" value={profile.phone} />
          <Field label="Emergency Contact" value={profile.emergencyContactName} />
          <Field label="Emergency Phone" value={profile.emergencyContactPhone} />
        </div>
      </Card>
    </div>
  );
}
