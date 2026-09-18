import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, ChevronRight, TriangleAlert, Users } from "lucide-react";
import api from "../../lib/api.js";
import Card from "../../components/Card.jsx";
import Avatar from "../../components/Avatar.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { SkeletonList } from "../../components/Skeleton.jsx";

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
      <div>
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Patient Directory</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Browse your hospital's patients and open a full record.
        </p>
      </div>

      <div className="relative sm:max-w-sm">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or IC number..."
          className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-9 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            aria-label="Clear search"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {loading && <SkeletonList rows={4} />}

      {!loading && patients.length === 0 && (
        <EmptyState icon={Users} title="No matching patients" subtitle="Try a different name or IC number." />
      )}

      {!loading && patients.length > 0 && (
        <>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {patients.length} {patients.length === 1 ? "patient" : "patients"}
          </p>

          <Card className="p-0">
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {patients.map((p) => (
                <li
                  key={p.uid}
                  onClick={() => navigate(`/doctor/patient/${p.uid}`)}
                  className="flex cursor-pointer items-center gap-3 px-4 py-3 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
                >
                  <Avatar name={p.name} url={p.avatarUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{p.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {p.gender}, {p.age} yrs &middot; IC: {p.ic}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    {p.bloodType && (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700 dark:bg-red-950/50 dark:text-red-300">
                        {p.bloodType}
                      </span>
                    )}
                    {p.allergies?.length > 0 && (
                      <TriangleAlert
                        size={15}
                        className="text-amber-500"
                        aria-label="Has recorded allergies"
                      >
                        <title>Allergies: {p.allergies.join(", ")}</title>
                      </TriangleAlert>
                    )}
                    <ChevronRight size={16} className="text-slate-300 dark:text-slate-600" />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
