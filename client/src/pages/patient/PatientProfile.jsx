import { useRef, useState } from "react";
import { FileText, Camera, Pencil, Check, X, Copy, Droplet, TriangleAlert, HeartPulse } from "lucide-react";
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
  const [editingContact, setEditingContact] = useState(false);
  const [contactForm, setContactForm] = useState(null);
  const [savingContact, setSavingContact] = useState(false);
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

  const startEditContact = () => {
    setContactForm({
      phone: profile.phone || "",
      emergencyContactName: profile.emergencyContactName || "",
      emergencyContactPhone: profile.emergencyContactPhone || "",
    });
    setEditingContact(true);
  };

  const saveContact = async (e) => {
    e.preventDefault();
    setSavingContact(true);
    try {
      await api.patch(`/patients/${profile.uid}`, contactForm);
      await refreshProfile();
      setEditingContact(false);
      toast.success("Contact details updated.");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update contact details.");
    } finally {
      setSavingContact(false);
    }
  };

  const copyCardUid = async () => {
    if (!profile.cardUid) return;
    try {
      await navigator.clipboard.writeText(profile.cardUid);
      toast.success("Card UID copied.");
    } catch {
      toast.error("Couldn't copy to clipboard.");
    }
  };

  const allergies = profile.allergies?.length ? profile.allergies.join(", ") : "None recorded";
  const chronic = profile.chronicIllnesses?.length ? profile.chronicIllnesses.join(", ") : "None recorded";
  const memberSince = profile.createdAt
    ? new Date(profile.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long" })
    : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Profile Summary</h1>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-soft hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <FileText size={15} />
          {exporting ? "Preparing..." : "Export as PDF"}
        </button>
      </div>

      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="group relative">
              <Avatar name={profile.name} url={profile.avatarUrl} size="lg" />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                aria-label="Change profile picture"
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-brand-600 text-xs text-white shadow-soft hover:bg-brand-700 disabled:opacity-60 dark:border-slate-900"
              >
                {uploadingAvatar ? "…" : <Camera size={13} />}
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
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {profile.gender}
                {profile.age ? `, ${profile.age} yrs` : ""}
              </p>
              {memberSince && (
                <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">Patient since {memberSince}</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
            <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1.5 text-sm font-bold text-red-700 dark:bg-red-950/50 dark:text-red-300">
              <Droplet size={14} />
              {profile.bloodType || "Unknown"}
            </span>
            {profile.cardUid && (
              <button
                onClick={copyCardUid}
                className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-mono text-slate-500 hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:text-slate-400 dark:hover:text-brand-300"
                title="Copy card UID"
              >
                {profile.cardUid}
                <Copy size={12} />
              </button>
            )}
          </div>
        </div>
      </Card>

      <Card title="Medical Information">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <p className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
              <TriangleAlert size={12} /> Severe Allergies
            </p>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{allergies}</p>
          </div>
          <div>
            <p className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
              <HeartPulse size={12} /> Chronic Illnesses
            </p>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{chronic}</p>
          </div>
          <Field label="Height / Weight" value={profile.height || profile.weight ? `${profile.height || "—"} cm · ${profile.weight || "—"} kg` : null} />
        </div>
        <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
          Medical details are kept accurate by your doctor or hospital admin and can't be edited here.
        </p>
      </Card>

      <Card title="Personal Information">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="IC Number" value={profile.ic} />
          <Field label="Date of Birth" value={profile.dob} />
          <Field label="Gender" value={profile.gender} />
          <Field label="Email" value={profile.email} />
        </div>
      </Card>

      <Card
        title="Contact"
        action={
          !editingContact && (
            <button
              onClick={startEditContact}
              className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
            >
              <Pencil size={12} /> Edit
            </button>
          )
        }
      >
        {editingContact ? (
          <form onSubmit={saveContact} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Phone</label>
                <input
                  value={contactForm.phone}
                  onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Emergency Contact</label>
                <input
                  value={contactForm.emergencyContactName}
                  onChange={(e) => setContactForm({ ...contactForm, emergencyContactName: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Emergency Phone</label>
                <input
                  value={contactForm.emergencyContactPhone}
                  onChange={(e) => setContactForm({ ...contactForm, emergencyContactPhone: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={savingContact}
                className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                <Check size={14} /> {savingContact ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setEditingContact(false)}
                disabled={savingContact}
                className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <X size={14} /> Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="Phone" value={profile.phone} />
            <Field label="Emergency Contact" value={profile.emergencyContactName} />
            <Field label="Emergency Phone" value={profile.emergencyContactPhone} />
          </div>
        )}
      </Card>
    </div>
  );
}
