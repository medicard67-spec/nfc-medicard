import { useEffect, useState } from "react";
import { BarChart, Bar, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, LabelList, ResponsiveContainer } from "recharts";
import api from "../../lib/api.js";
import Card from "../../components/Card.jsx";
import { useTheme } from "../../context/ThemeContext.jsx";

// Length/position, not area — a horizontal bar makes the three counts directly
// comparable at a glance, unlike a pie chart's wedge areas (NN/g: people judge
// length and 2D position far more accurately than area).
const GENDER_COLORS_LIGHT = ["#0d9488", "#f97316", "#94a3b8"];
const GENDER_COLORS_DARK = ["#5eead4", "#fb923c", "#cbd5e1"];

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const { theme } = useTheme();
  const dark = theme === "dark";
  const lineColor = dark ? "#5eead4" : "#0d9488";
  const gridColor = dark ? "#1e293b" : "#e2e8f0";
  const tickColor = dark ? "#94a3b8" : "#64748b";
  const genderColors = dark ? GENDER_COLORS_DARK : GENDER_COLORS_LIGHT;

  useEffect(() => {
    api.get("/admin/stats").then((res) => setStats(res.data));
  }, []);

  if (!stats) return <p className="text-sm text-slate-400 dark:text-slate-500">Loading dashboard...</p>;

  const genderData = Object.entries(stats.genderDistribution).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Admin Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Patients" value={stats.totalPatients} />
        <StatCard label="Active Treatment Cases" value={stats.activeTreatmentCases} />
        <StatCard label="New Registrations (Month)" value={stats.newRegistrationsThisMonth} />
        <StatCard label="NFC Cards Issued" value={stats.totalCardsIssued} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Patient Gender Distribution">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={genderData} layout="vertical" margin={{ left: 8, right: 24 }}>
              <XAxis type="number" hide allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={64} tick={{ fill: tickColor, fontSize: 13 }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: dark ? "#1e293b" : "#f1f5f9" }} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={28}>
                {genderData.map((_, i) => (
                  <Cell key={i} fill={genderColors[i % genderColors.length]} />
                ))}
                <LabelList dataKey="value" position="right" fill={tickColor} fontSize={13} fontWeight={600} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Hospital Analytics (Records logged / month)">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={stats.hospitalAnalytics}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="month" tick={{ fill: tickColor, fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: tickColor, fontSize: 12 }} axisLine={false} tickLine={false} width={28} />
              <Tooltip />
              <Line type="monotone" dataKey="visits" stroke={lineColor} strokeWidth={2} dot={{ r: 3, fill: lineColor }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

// Deliberately lighter than the standard Card — a stat tile is one of four
// sitting in a row, not a standalone panel, so it skips the border/shadow
// Card carries by default and uses a quiet tint instead. Keeps the Emergency
// Profile banner as the one thing on the app that still visually outranks
// everything around it.
function StatCard({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 p-5 dark:bg-slate-900/60">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-brand-700 dark:text-brand-300">{value}</p>
    </div>
  );
}
