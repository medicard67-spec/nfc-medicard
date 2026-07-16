import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import api from "../../lib/api.js";
import Card from "../../components/Card.jsx";
import { useTheme } from "../../context/ThemeContext.jsx";

const GENDER_COLORS_LIGHT = ["#7c3aed", "#f97316", "#94a3b8"];
const GENDER_COLORS_DARK = ["#a78bfa", "#fb923c", "#cbd5e1"];

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const { theme } = useTheme();
  const lineColor = theme === "dark" ? "#c4b5fd" : "#7c3aed";
  const genderColors = theme === "dark" ? GENDER_COLORS_DARK : GENDER_COLORS_LIGHT;

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
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={genderData} dataKey="value" nameKey="name" outerRadius={80} label>
                {genderData.map((_, i) => (
                  <Cell key={i} fill={genderColors[i % genderColors.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Hospital Analytics (Records logged / month)">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={stats.hospitalAnalytics}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="visits" stroke={lineColor} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <Card>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-brand-700 dark:text-brand-300">{value}</p>
    </Card>
  );
}
