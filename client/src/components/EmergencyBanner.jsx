export default function EmergencyBanner({ patient }) {
  if (!patient) return null;
  const allergies = patient.allergies?.length ? patient.allergies.join(", ") : "None recorded";
  const chronic = patient.chronicIllnesses?.length
    ? patient.chronicIllnesses.join(", ")
    : "None recorded";

  return (
    <div className="relative overflow-hidden rounded-xl border-2 border-red-200 bg-gradient-to-br from-red-50 to-rose-50 p-4 shadow-soft dark:border-red-900/60 dark:from-red-950/40 dark:to-rose-950/40">
      <div className="mb-2 flex items-center gap-1.5">
        <span className="text-sm">🚨</span>
        <p className="text-xs font-bold uppercase tracking-wide text-red-600 dark:text-red-400">
          Emergency Profile
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <p className="text-xs text-red-500 dark:text-red-400/80">Blood Type</p>
          <p className="text-xl font-bold text-red-700 dark:text-red-300">
            {patient.bloodType || "Unknown"}
          </p>
        </div>
        <div>
          <p className="text-xs text-red-500 dark:text-red-400/80">Severe Allergies</p>
          <p className="text-sm font-semibold text-red-700 dark:text-red-300">{allergies}</p>
        </div>
        <div>
          <p className="text-xs text-red-500 dark:text-red-400/80">Chronic Illnesses</p>
          <p className="text-sm font-semibold text-red-700 dark:text-red-300">{chronic}</p>
        </div>
      </div>
    </div>
  );
}
