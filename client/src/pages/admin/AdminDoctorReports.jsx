import { useEffect, useState } from "react";
import api from "../../lib/api.js";
import Card from "../../components/Card.jsx";

export default function AdminDoctorReports() {
  const [doctors, setDoctors] = useState([]);
  const [reports, setReports] = useState([]);
  const [activeDoctor, setActiveDoctor] = useState(null);

  useEffect(() => {
    api.get("/admin/reports").then((res) => {
      setDoctors(res.data.doctors);
      setReports(res.data.reports);
    });
  }, []);

  const filtered = activeDoctor
    ? reports.filter((r) => r.physicianId === activeDoctor)
    : reports;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Doctor's Report</h1>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <Card title="Active Doctors" className="lg:col-span-1">
          <ul className="space-y-1">
            <li>
              <button
                onClick={() => setActiveDoctor(null)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                  !activeDoctor ? "bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300" : "hover:bg-slate-50"
                }`}
              >
                All Doctors
              </button>
            </li>
            {doctors.map((d) => (
              <li key={d.uid}>
                <button
                  onClick={() => setActiveDoctor(d.uid)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                    activeDoctor === d.uid ? "bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300" : "hover:bg-slate-50"
                  }`}
                >
                  <p className="font-medium">{d.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{d.department}</p>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Patient Reports" className="lg:col-span-3">
          {filtered.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">No reports submitted yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{r.patientName}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{r.diagnosis}</p>
                  </div>
                  <div className="text-right text-xs text-slate-400 dark:text-slate-500">
                    <p>{r.physician}</p>
                    <p>{r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : ""}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
