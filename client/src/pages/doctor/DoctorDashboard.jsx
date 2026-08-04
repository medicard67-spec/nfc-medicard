import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useAuth } from "../../context/AuthContext.jsx";
import api from "../../lib/api.js";
import Card from "../../components/Card.jsx";
import Avatar from "../../components/Avatar.jsx";
import { SkeletonList } from "../../components/Skeleton.jsx";
import { useTheme } from "../../context/ThemeContext.jsx";

export default function DoctorDashboard() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const lineColor = theme === "dark" ? "#c4b5fd" : "#7c3aed";
  const [patientCount, setPatientCount] = useState(0);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get("/patients").then((res) => setPatientCount(res.data.length));
    api.get("/doctor/stats").then((res) => setStats(res.data));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Avatar name={profile?.name} url={profile?.avatarUrl} size="md" />
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Welcome, {profile?.name}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{profile?.department} Department</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <p className="text-xs text-slate-500 dark:text-slate-400">Total Registered Patients</p>
          <p className="mt-1 text-2xl font-bold text-brand-700 dark:text-brand-300">{patientCount}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500 dark:text-slate-400">Patients You've Treated</p>
          <p className="mt-1 text-2xl font-bold text-brand-700 dark:text-brand-300">{stats?.myPatientCount ?? "—"}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500 dark:text-slate-400">Records Logged (You)</p>
          <p className="mt-1 text-2xl font-bold text-brand-700 dark:text-brand-300">{stats?.totalRecordsLogged ?? "—"}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500 dark:text-slate-400">Upcoming Appointments</p>
          <p className="mt-1 text-2xl font-bold text-brand-700 dark:text-brand-300">{stats?.upcomingAppointments ?? "—"}</p>
        </Card>
      </div>

      <Card title="Your Weekly Activity (records logged)">
        {!stats ? (
          <SkeletonList rows={1} />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={stats.weeklyActivity}>
              <CartesianGrid strokeDasharray="3 3" className="dark:opacity-20" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="records" stroke={lineColor} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card>
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <span className="text-4xl">📶</span>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Scan NFC Card</h2>
          <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
            Tap a patient's physical NFC card to instantly retrieve their medical history, lab
            results, and imaging records.
          </p>
          <Link
            to="/doctor/scan"
            className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Scan NFC Card
          </Link>
        </div>
      </Card>
    </div>
  );
}
