import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useAuth } from "../../context/AuthContext.jsx";
import api from "../../lib/api.js";
import EmergencyBanner from "../../components/EmergencyBanner.jsx";
import Card from "../../components/Card.jsx";

const quickLinks = [
  { to: "/patient/history", label: "Medical History", icon: "📋" },
  { to: "/patient/labs", label: "Lab Results", icon: "🧪" },
  { to: "/patient/radiology", label: "Imaging", icon: "🩻" },
  { to: "/patient/messages", label: "Messages", icon: "💬" },
];

export default function PatientHome() {
  const { profile } = useAuth();
  const [vitals, setVitals] = useState([]);

  useEffect(() => {
    if (!profile?.uid) return;
    api.get(`/patients/${profile.uid}/vitals`).then((res) => setVitals(res.data.reverse()));
  }, [profile?.uid]);

  const avgHeartRate = vitals.length
    ? Math.round(vitals.reduce((sum, v) => sum + v.heartRate, 0) / vitals.length)
    : "--";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Welcome, {profile?.name}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Here's your health overview.</p>
      </div>

      <EmergencyBanner patient={profile} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Average Heart Rate" className="lg:col-span-1">
          <p className="text-3xl font-bold text-brand-700 dark:text-brand-300">{avgHeartRate} <span className="text-base font-normal text-slate-400 dark:text-slate-500">bpm</span></p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Based on ward vitals during your stay</p>
        </Card>
        <Card title="Daily Vitals" className="lg:col-span-2">
          {vitals.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">No vitals recorded yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={vitals}>
                <XAxis dataKey="id" hide />
                <YAxis width={30} />
                <Tooltip />
                <Line type="monotone" dataKey="heartRate" stroke="#1c70f0" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card title="Quick Access">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {quickLinks.map((q) => (
            <Link
              key={q.to}
              to={q.to}
              className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 p-4 text-center text-sm font-medium text-slate-700 dark:text-slate-200 transition hover:border-brand-300 hover:bg-brand-50 dark:bg-brand-950"
            >
              <span className="text-2xl">{q.icon}</span>
              {q.label}
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
