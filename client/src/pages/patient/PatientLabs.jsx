import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import api from "../../lib/api.js";
import Card from "../../components/Card.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { SkeletonList } from "../../components/Skeleton.jsx";

export default function PatientLabs() {
  const { profile } = useAuth();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!profile?.uid) return;
    api
      .get("/lab-results", { params: { patientId: profile.uid } })
      .then((res) => setResults(res.data))
      .finally(() => setLoading(false));
  }, [profile?.uid]);

  const filtered = useMemo(
    () => results.filter((r) => r.testName?.toLowerCase().includes(search.toLowerCase())),
    [results, search]
  );

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Diagnostic &amp; Laboratory Vault</h1>

      {loading && <SkeletonList rows={2} />}

      {!loading && results.length === 0 && (
        <EmptyState icon="🧪" title="No lab results yet" subtitle="Results uploaded by your doctor will appear here." />
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search test name..."
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:max-w-xs"
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {filtered.map((r) => (
              <Card key={r.id}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{r.testName}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {r.date} &middot; {r.physician}
                    </p>
                  </div>
                  {r.flagged && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600 dark:bg-red-950 dark:text-red-300">
                      Abnormal
                    </span>
                  )}
                </div>
                {r.fileUrl && (
                  <a
                    href={r.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline"
                  >
                    View / Download File
                  </a>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
