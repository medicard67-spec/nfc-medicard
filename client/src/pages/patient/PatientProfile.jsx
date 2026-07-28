import { useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import api from "../../lib/api.js";
import Card from "../../components/Card.jsx";
import Avatar from "../../components/Avatar.jsx";
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
  const { profile, refreshProfile } = useAuth();
  const toast = useToast();
  const [exporting, setExporting] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef(null);

  if (!profile) return null;

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const form = new FormData();
      form.append("file", file);
      await api.post(`/patients/${profile.uid}/avatar`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await refreshProfile();
      toast.success("Profile picture updated.");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update profile picture.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const [history, labs, radiology] = await Promise.all([
        api.get("/medical-history", { params: { patientId: profile.uid } }).then((r) => r.data),
        api.get("/lab-results", { params: { patientId: profile.uid } }).then((r) => r.data),
        api.get("/radiology", { params: { patientId: profile.uid } }).then((r) => r.data),
      ]);
      await exportPatientRecordPdf({ patient: profile, history, labs, radiology });
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
          <div className="group relative">
            <Avatar name={profile.name} url={profile.avatarUrl} size="md" />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              aria-label="Change profile picture"
              className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-brand-600 text-xs text-white shadow-soft hover:bg-brand-700 disabled:opacity-60 dark:border-slate-900"
            >
              {uploadingAvatar ? "…" : "📷"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
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
