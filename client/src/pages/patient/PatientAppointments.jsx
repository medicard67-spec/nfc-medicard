import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import api from "../../lib/api.js";
import Card from "../../components/Card.jsx";
import MonthCalendar from "../../components/MonthCalendar.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { SkeletonList } from "../../components/Skeleton.jsx";

export default function PatientAppointments() {
  const { profile } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.uid) return;
    api
      .get("/appointments", { params: { patientId: profile.uid } })
      .then((res) => setAppointments(res.data))
      .finally(() => setLoading(false));
  }, [profile?.uid]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Appointments</h1>

      {loading && <SkeletonList rows={2} />}

      {!loading && appointments.length === 0 && (
        <EmptyState icon="📅" title="No appointments scheduled" subtitle="Appointments your doctor schedules will appear here." />
      )}

      {!loading && appointments.length > 0 && (
        <Card>
          <MonthCalendar
            events={appointments}
            emptyLabel="No appointments on this day."
            renderEvent={(a) => (
              <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {a.doctorName || "Unassigned"}
                </p>
                {a.notes && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{a.notes}</p>}
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500 capitalize">{a.status}</p>
              </div>
            )}
          />
        </Card>
      )}
    </div>
  );
}
