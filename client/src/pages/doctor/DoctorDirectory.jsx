import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../lib/api.js";
import Card from "../../components/Card.jsx";

export default function DoctorDirectory() {
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    const timeout = setTimeout(() => {
      api
        .get("/patients", { params: { search } })
        .then((res) => setPatients(res.data))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timeout);
  }, [search]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Patient Directory</h1>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or IC number..."
        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:max-w-sm"
      />

      <Card className="p-0">
        {loading && <p className="p-4 text-sm text-slate-400 dark:text-slate-500">Loading...</p>}
        {!loading && patients.length === 0 && (
          <p className="p-4 text-sm text-slate-400 dark:text-slate-500">No matching patients.</p>
        )}
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {patients.map((p) => (
            <li
              key={p.uid}
              onClick={() => navigate(`/doctor/patient/${p.uid}`)}
              className="flex cursor-pointer items-center justify-between px-4 py-3 hover:bg-slate-50"
            >
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{p.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {p.gender}, {p.age} yrs &middot; IC: {p.ic}
                </p>
              </div>
              <span className="text-sm text-brand-600 dark:text-brand-400">View →</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
