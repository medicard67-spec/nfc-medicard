import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import api from "../../lib/api.js";
import Card from "../../components/Card.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { SkeletonList } from "../../components/Skeleton.jsx";

export default function PatientHistory() {
  const { profile } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!profile?.uid) return;
    api
      .get("/medical-history", { params: { patientId: profile.uid } })
      .then((res) => setRecords(res.data))
      .finally(() => setLoading(false));
  }, [profile?.uid]);

  const filtered = useMemo(
    () =>
      records.filter(
        (r) =>
          r.diagnosis?.toLowerCase().includes(search.toLowerCase()) ||
          r.physician?.toLowerCase().includes(search.toLowerCase())
      ),
    [records, search]
  );

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Medical History Timeline</h1>

      {loading && <SkeletonList rows={3} />}

      {!loading && records.length === 0 && (
        <EmptyState icon="📋" title="No medical history yet" subtitle="Records added by your doctor will show up here." />
      )}

      {!loading && records.length > 0 && (
        <div className="space-y-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search diagnosis or physician..."
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:max-w-xs"
          />
          {filtered.map((r) => (
            <Card key={r.id}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-100">{r.diagnosis}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {r.date} &middot; {r.physician}
                  </p>
                </div>
              </div>
              {r.remarks && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{r.remarks}</p>}
              {r.imageUrls?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {r.imageUrls.map((url) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer">
                      <img src={url} alt="Attached" className="h-20 w-20 rounded-lg object-cover" />
                    </a>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
