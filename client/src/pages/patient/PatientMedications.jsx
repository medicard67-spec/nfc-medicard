import { useEffect, useState } from "react";
import { Pill, TriangleAlert } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import api from "../../lib/api.js";
import Card from "../../components/Card.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { SkeletonList } from "../../components/Skeleton.jsx";
import { RENEWAL_FREQUENCY_LABELS } from "../../lib/medicationRenewal.js";

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(dateStr) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function medicationDateLine(m) {
  if (m.renewalFrequency && m.renewalFrequency !== "none") {
    const label = RENEWAL_FREQUENCY_LABELS[m.renewalFrequency] || m.renewalFrequency;
    return `${formatDate(m.startDate)} – ${formatDate(m.endDate)} · renews ${label.toLowerCase()}`;
  }
  return `Since ${formatDate(m.startDate)}`;
}

export default function PatientMedications() {
  const { profile } = useAuth();
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.uid) return;
    api
      .get("/medications", { params: { patientId: profile.uid } })
      .then((res) => setMedications(res.data))
      .finally(() => setLoading(false));
  }, [profile?.uid]);

  const today = todayKey();
  const needsRenewal = medications.filter((m) => m.renewalFrequency !== "none" && m.endDate && m.endDate <= today);
  const current = medications.filter((m) => !m.endDate || m.endDate > today);
  const past = medications.filter((m) => m.endDate && m.endDate <= today && m.renewalFrequency === "none");

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Medications</h1>

      {loading && <SkeletonList rows={3} />}

      {!loading && medications.length === 0 && (
        <EmptyState icon={Pill} title="No medications recorded" subtitle="Medicines your doctor prescribes will appear here." />
      )}

      {!loading && medications.length > 0 && (
        <div className="space-y-6">
          {needsRenewal.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">
                <TriangleAlert size={13} /> Needs Renewal ({needsRenewal.length})
              </p>
              <div className="space-y-2">
                {needsRenewal.map((m) => (
                  <Card key={m.id} className="border-2 border-red-400 bg-red-50 dark:border-red-700 dark:bg-red-950/30">
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200">
                        <TriangleAlert size={16} />
                      </span>
                      <div>
                        <p className="font-semibold text-red-800 dark:text-red-200">
                          {m.name} <span className="font-normal text-red-600 dark:text-red-400">&middot; {m.dosage}</span>
                        </p>
                        <p className="text-xs text-red-600 dark:text-red-400">
                          {m.frequency && <>{m.frequency} &middot; </>}
                          {medicationDateLine(m)} &middot; expired &middot; ask your doctor to renew
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Current ({current.length})
            </p>
            {current.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500">You're not currently taking any recorded medication.</p>
            ) : (
              <div className="space-y-2">
                {current.map((m) => (
                  <Card key={m.id} className="border-l-4 border-l-brand-500">
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 dark:bg-brand-900 dark:text-brand-200">
                        <Pill size={16} />
                      </span>
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-100">
                          {m.name} <span className="font-normal text-slate-500 dark:text-slate-400">&middot; {m.dosage}</span>
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {m.frequency && <>{m.frequency} &middot; </>}
                          {medicationDateLine(m)} &middot; Prescribed by {m.prescribedBy}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {past.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Past ({past.length})
              </p>
              <div className="space-y-2">
                {past.map((m) => (
                  <Card key={m.id} className="opacity-70">
                    <p className="font-semibold text-slate-700 dark:text-slate-200">
                      {m.name} <span className="font-normal text-slate-500 dark:text-slate-400">&middot; {m.dosage}</span>
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {m.frequency && <>{m.frequency} &middot; </>}
                      {formatDate(m.startDate)} &ndash; {formatDate(m.endDate)} &middot; Prescribed by {m.prescribedBy}
                    </p>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
