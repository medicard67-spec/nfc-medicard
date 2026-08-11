import { useEffect, useState } from "react";
import {
  UserPlus, Pencil, ImageIcon, Nfc, CreditCard, ClipboardList,
  FlaskConical, ScanLine, QrCode, Keyboard, Shield, Circle,
} from "lucide-react";
import api from "../../lib/api.js";
import Card from "../../components/Card.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { SkeletonList } from "../../components/Skeleton.jsx";

const ACTION_LABELS = {
  "patient.register": "Registered patient",
  "patient.update": "Updated patient profile",
  "patient.avatar_update": "Updated profile picture",
  "nfc.scan": "Scanned NFC card",
  "nfc.register": "Registered NFC card",
  "medical_history.create": "Added medical history record",
  "lab_result.create": "Added lab result",
  "radiology.create": "Uploaded imaging record",
};

const ACTION_ICONS = {
  "patient.register": UserPlus,
  "patient.update": Pencil,
  "patient.avatar_update": ImageIcon,
  "nfc.scan": Nfc,
  "nfc.register": CreditCard,
  "medical_history.create": ClipboardList,
  "lab_result.create": FlaskConical,
  "radiology.create": ScanLine,
};

const METHOD_ICONS = { nfc: Nfc, qr: QrCode, manual: Keyboard };
const METHOD_LABELS = { nfc: "NFC tap", qr: "QR scan", manual: "Manual entry" };

export default function AdminAuditLog() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    api
      .get("/audit")
      .then((res) => setEntries(res.data))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === "all" ? entries : entries.filter((e) => e.actorRole === filter);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Audit Log</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          A record of key actions taken across the system, for accountability and security review.
        </p>
      </div>

      <div className="flex gap-2">
        {["all", "admin", "doctor", "patient"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
              filter === f
                ? "bg-brand-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading && <SkeletonList rows={4} />}

      {!loading && filtered.length === 0 && (
        <EmptyState icon={Shield} title="No audit entries yet" subtitle="Actions like registrations, scans, and record updates will appear here." />
      )}

      {!loading && filtered.length > 0 && (
        <Card className="p-0">
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map((e) => {
              const ActionIcon = ACTION_ICONS[e.action] || Circle;
              const MethodIcon = e.details?.method ? METHOD_ICONS[e.details.method] : null;
              return (
                <li key={e.id} className="flex items-start gap-3 px-4 py-3">
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 dark:bg-brand-900 dark:text-brand-200">
                    <ActionIcon size={15} strokeWidth={2} />
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                      {ACTION_LABELS[e.action] || e.action}
                    </p>
                    <p className="flex flex-wrap items-center gap-x-1 text-xs text-slate-500 dark:text-slate-400">
                      <span>{e.actorName} ({e.actorRole})</span>
                      {e.details?.name && <span>&middot; {e.details.name}</span>}
                      {e.details?.diagnosis && <span>&middot; {e.details.diagnosis}</span>}
                      {e.details?.testName && <span>&middot; {e.details.testName}</span>}
                      {e.details?.cardUid && <span>&middot; card {e.details.cardUid}</span>}
                      {e.details?.method && (
                        <span className="inline-flex items-center gap-1">
                          &middot; {MethodIcon && <MethodIcon size={12} />}
                          {METHOD_LABELS[e.details.method] || e.details.method}
                        </span>
                      )}
                    </p>
                  </div>
                  <p className="whitespace-nowrap text-xs text-slate-400 dark:text-slate-500">
                    {new Date(e.createdAt).toLocaleString()}
                  </p>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
