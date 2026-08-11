import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar } from "lucide-react";
import api from "../../lib/api.js";
import Card from "../../components/Card.jsx";
import MonthCalendar from "../../components/MonthCalendar.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { SkeletonList } from "../../components/Skeleton.jsx";

export default function DoctorAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .get("/appointments/mine")
      .then((res) => setAppointments(res.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Appointments</h1>

      {loading && <SkeletonList rows={2} />}

      {!loading && appointments.length === 0 && (
        <EmptyState icon={Calendar} title="No appointments scheduled" subtitle="Appointments you schedule from a patient's record will appear here." />
      )}

      {!loading && appointments.length > 0 && (
        <Card>
          <MonthCalendar
            events={appointments}
            emptyLabel="No appointments on this day."
            renderEvent={(a) => (
              <button
                onClick={() => navigate(`/doctor/patient/${a.patientId}`)}
                className="w-full rounded-lg border border-slate-200 p-3 text-left hover:border-brand-300 hover:bg-brand-50 dark:border-slate-800 dark:hover:bg-brand-900"
              >
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{a.patientName}</p>
                {a.notes && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{a.notes}</p>}
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500 capitalize">{a.status}</p>
              </button>
            )}
          />
        </Card>
      )}
    </div>
  );
}
