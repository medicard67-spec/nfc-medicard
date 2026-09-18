import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, Plus, Search, X } from "lucide-react";
import api from "../../lib/api.js";
import Card from "../../components/Card.jsx";
import MonthCalendar from "../../components/MonthCalendar.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { SkeletonList } from "../../components/Skeleton.jsx";
import { useToast } from "../../context/ToastContext.jsx";

export default function DoctorAppointments() {
  const toast = useToast();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const load = () => {
    api
      .get("/appointments/mine")
      .then((res) => setAppointments(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const runSearch = async (e) => {
    e.preventDefault();
    if (!search.trim()) return;
    setSearching(true);
    try {
      const { data } = await api.get("/patients", { params: { search: search.trim() } });
      setSearchResults(data);
    } catch {
      setError("Search failed.");
    } finally {
      setSearching(false);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setSearch("");
    setSearchResults([]);
    setSelectedPatient(null);
    setDate("");
    setNotes("");
    setError(null);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!selectedPatient || !date) return;
    setSaving(true);
    setError(null);
    try {
      await api.post("/appointments", { patientId: selectedPatient.uid, date, notes });
      toast.success(`Appointment set with ${selectedPatient.name}.`);
      resetForm();
      setLoading(true);
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to set appointment.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Appointments</h1>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Plus size={15} /> New Appointment
          </button>
        )}
      </div>

      {showForm && (
        <Card title="Set an Appointment">
          {!selectedPatient ? (
            <>
              <form onSubmit={runSearch} className="mb-4 flex gap-2">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search patient by name or IC..."
                  autoFocus
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                <button
                  disabled={searching}
                  className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  <Search size={15} /> {searching ? "Searching..." : "Search"}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  aria-label="Cancel"
                >
                  <X size={15} />
                </button>
              </form>
              {searchResults.length === 0 && !searching && (
                <p className="text-sm text-slate-400">Search for a patient to schedule with.</p>
              )}
              <div className="space-y-2">
                {searchResults.map((p) => (
                  <button
                    key={p.uid}
                    type="button"
                    onClick={() => setSelectedPatient(p)}
                    className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:border-brand-300 hover:bg-brand-50 dark:border-slate-700 dark:hover:bg-brand-900/40"
                  >
                    <span className="font-medium text-slate-800 dark:text-slate-100">{p.name}</span>
                    <span className="ml-2 text-xs text-slate-400">{p.ic || p.email}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <div className="flex items-center justify-between rounded-lg bg-brand-50 px-3 py-2 dark:bg-brand-900/40">
                <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{selectedPatient.name}</span>
                <button
                  type="button"
                  onClick={() => setSelectedPatient(null)}
                  className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300"
                >
                  Change
                </button>
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  disabled={saving}
                  className="flex-1 rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Set Appointment"}
                </button>
              </div>
            </form>
          )}
        </Card>
      )}

      {loading && <SkeletonList rows={2} />}

      {!loading && appointments.length === 0 && (
        <EmptyState icon={Calendar} title="No appointments scheduled" subtitle="Set one with the button above, or from a patient's record." />
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
