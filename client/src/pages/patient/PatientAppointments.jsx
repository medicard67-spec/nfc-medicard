import { useEffect, useMemo, useState } from "react";
import { Calendar, Stethoscope } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import api from "../../lib/api.js";
import Card from "../../components/Card.jsx";
import MonthCalendar from "../../components/MonthCalendar.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import { SkeletonList } from "../../components/Skeleton.jsx";

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(dateStr) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function PatientAppointments() {
  const { profile } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [focusDate, setFocusDate] = useState(null);

  useEffect(() => {
    if (!profile?.uid) return;
    api
      .get("/appointments", { params: { patientId: profile.uid } })
      .then((res) => setAppointments(res.data))
      .finally(() => setLoading(false));
  }, [profile?.uid]);

  const upcoming = useMemo(() => {
    const today = todayKey();
    return appointments.filter((a) => a.date >= today).slice(0, 4);
  }, [appointments]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Appointments</h1>

      {loading && <SkeletonList rows={2} />}

      {!loading && appointments.length === 0 && (
        <EmptyState icon={Calendar} title="No appointments scheduled" subtitle="Appointments your doctor schedules will appear here." />
      )}

      {!loading && appointments.length > 0 && (
        <>
          <Card title="Upcoming">
            {upcoming.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500">No upcoming appointments.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {upcoming.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setFocusDate(a.date)}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-brand-300 hover:bg-brand-50 dark:border-slate-800 dark:hover:bg-brand-900/40"
                  >
                    <div className="flex h-11 w-11 flex-shrink-0 flex-col items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900 dark:text-brand-200">
                      <Stethoscope size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {a.doctorName || "Unassigned"}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{formatDate(a.date)}</p>
                    </div>
                    <StatusBadge status={a.status} />
                  </button>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <MonthCalendar
              events={appointments}
              emptyLabel="No appointments on this day."
              focusDate={focusDate}
              renderEvent={(a) => (
                <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {a.doctorName || "Unassigned"}
                    </p>
                    <StatusBadge status={a.status} />
                  </div>
                  {a.notes && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{a.notes}</p>}
                </div>
              )}
            />
          </Card>
        </>
      )}
    </div>
  );
}
