import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import api from "../../lib/api.js";
import Card from "../../components/Card.jsx";
import Avatar from "../../components/Avatar.jsx";
import { useToast } from "../../context/ToastContext.jsx";

function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs text-slate-400 dark:text-slate-500">{label}</p>
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{value || "—"}</p>
    </div>
  );
}

export default function DoctorProfile() {
  const { profile, refreshProfile } = useAuth();
  const toast = useToast();
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
      await api.post("/doctor/avatar", form, { headers: { "Content-Type": "multipart/form-data" } });
      await refreshProfile();
      toast.success("Profile picture updated.");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update profile picture.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Profile</h1>

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
              {uploadingAvatar ? "…" : <Camera size={12} />}
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
            <p className="text-sm text-slate-500 dark:text-slate-400">{profile.department} Department</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="Email" value={profile.email} />
          <Field label="Department" value={profile.department} />
          <Field label="Hospital" value={profile.hospital} />
          <Field label="Role" value="Doctor" />
        </div>
      </Card>
    </div>
  );
}
