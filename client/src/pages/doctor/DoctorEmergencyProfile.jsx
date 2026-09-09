import { useLocation, useNavigate } from "react-router-dom";
import { TriangleAlert, Phone, FileText, ScanLine } from "lucide-react";
import Card from "../../components/Card.jsx";
import Avatar from "../../components/Avatar.jsx";

// Shown the instant a card is scanned — a fast, read-only vital summary for
// emergency use, before anyone opens the patient's full chart. Reflects
// exactly what the scan endpoint returns (see server/src/routes/nfc.js).
export default function DoctorEmergencyProfile() {
  const { state } = useLocation();
  const navigate = useNavigate();

  if (!state) {
    return (
      <div className="mx-auto max-w-md space-y-4 text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No card has been scanned yet.
        </p>
        <button
          onClick={() => navigate("/doctor/scan")}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Scan a Card
        </button>
      </div>
    );
  }

  const allergies = state.allergies?.length ? state.allergies.join(", ") : "None recorded";
  const chronic = state.chronicIllnesses?.length ? state.chronicIllnesses.join(", ") : "None recorded";

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
        <TriangleAlert size={16} />
        <p className="text-xs font-bold uppercase tracking-wide">Emergency Access · Read-Only</p>
      </div>

      <Card className="border-2 border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/40">
        <div className="flex items-center gap-3">
          <Avatar name={state.name} url={state.avatarUrl} size="lg" />
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">{state.name}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {state.gender}, {state.age ?? "?"} yrs
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs text-red-500 dark:text-red-400/80">Blood Type</p>
            <p className="text-2xl font-bold text-red-700 dark:text-red-300">{state.bloodType || "Unknown"}</p>
          </div>
          <div>
            <p className="text-xs text-red-500 dark:text-red-400/80">Severe Allergies</p>
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">{allergies}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs text-red-500 dark:text-red-400/80">Chronic Illnesses</p>
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">{chronic}</p>
          </div>
        </div>

        {(state.emergencyContactName || state.emergencyContactPhone) && (
          <div className="mt-4 flex items-center justify-between rounded-lg border border-red-200 bg-white/60 px-3 py-2 dark:border-red-900/60 dark:bg-red-950/20">
            <div>
              <p className="text-xs text-red-500 dark:text-red-400/80">Emergency Contact</p>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {state.emergencyContactName || "Not provided"}
              </p>
            </div>
            {state.emergencyContactPhone && (
              <a
                href={`tel:${state.emergencyContactPhone}`}
                className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                <Phone size={14} />
                {state.emergencyContactPhone}
              </a>
            )}
          </div>
        )}
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          onClick={() => navigate(`/doctor/patient/${state.uid}`)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <FileText size={15} />
          Open Full Patient Record
        </button>
        <button
          onClick={() => navigate("/doctor/scan")}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <ScanLine size={15} />
          Scan Another Card
        </button>
      </div>
    </div>
  );
}
