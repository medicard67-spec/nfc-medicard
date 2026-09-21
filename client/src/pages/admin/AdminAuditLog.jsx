import { useEffect, useMemo, useState } from "react";
import {
  UserPlus, Pencil, ImageIcon, Nfc, CreditCard, ClipboardList,
  FlaskConical, ScanLine, QrCode, Keyboard, Shield, Circle, Hospital,
  Search, X, ChevronLeft, ChevronRight, DoorOpen, Pill,
} from "lucide-react";
import api from "../../lib/api.js";
import Card from "../../components/Card.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { SkeletonList } from "../../components/Skeleton.jsx";

const PAGE_SIZE = 10;

const ACTION_LABELS = {
  "patient.register": "Registered patient",
  "patient.update": "Updated patient profile",
  "patient.avatar_update": "Updated profile picture",
  "nfc.scan": "Scanned NFC card",
  "nfc.register": "Registered NFC card",
  "medical_history.create": "Added medical history record",
  "medical_history.update": "Edited medical history record",
  "lab_result.create": "Added lab result",
  "radiology.create": "Uploaded imaging record",
  "queue.checkin": "Checked in at registration desk",
  "medication.add": "Added medication",
  "medication.discontinue": "Marked medication as stopped",
};

const ACTION_ICONS = {
  "patient.register": UserPlus,
  "patient.update": Pencil,
  "patient.avatar_update": ImageIcon,
  "nfc.scan": Nfc,
  "nfc.register": CreditCard,
  "medical_history.create": ClipboardList,
  "medical_history.update": Pencil,
  "lab_result.create": FlaskConical,
  "radiology.create": ScanLine,
  "queue.checkin": DoorOpen,
  "medication.add": Pill,
  "medication.discontinue": Pill,
};

const METHOD_ICONS = { nfc: Nfc, qr: QrCode, manual: Keyboard };
const METHOD_LABELS = { nfc: "NFC tap", qr: "QR scan", manual: "Manual entry" };

// A row matches a search term if it shows up anywhere the user can actually
// see on the row: the action label, actor name/role, or any of the details
// chips (hospital, patient name, diagnosis, test name, card UID, method).
function matchesSearch(e, term) {
  if (!term) return true;
  const haystack = [
    ACTION_LABELS[e.action] || e.action,
    e.actorName,
    e.actorRole,
    e.details?.hospital,
    e.details?.name,
    e.details?.diagnosis,
    e.details?.testName,
    e.details?.cardUid,
    e.details?.room,
    e.details?.dosage,
    e.details?.method && (METHOD_LABELS[e.details.method] || e.details.method),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(term.toLowerCase());
}

export default function AdminAuditLog() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    api
      .get("/audit")
      .then((res) => setEntries(res.data))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () =>
      entries
        .filter((e) => filter === "all" || e.actorRole === filter)
        .filter((e) => matchesSearch(e, search)),
    [entries, filter, search]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageEntries = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const runSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };

  const clearSearch = () => {
    setSearchInput("");
    setSearch("");
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Audit Log</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          A record of key actions taken across the system, for accountability and security review.
        </p>
      </div>

      <form onSubmit={runSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by actor, action, patient, hospital, card UID..."
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-9 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          {searchInput && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              aria-label="Clear search"
            >
              <X size={15} />
            </button>
          )}
        </div>
        <button
          type="submit"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Search
        </button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          {["all", "admin", "doctor", "patient"].map((f) => (
            <button
              key={f}
              onClick={() => {
                setFilter(f);
                setPage(1);
              }}
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
        {!loading && filtered.length > 0 && (
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
          </p>
        )}
      </div>

      {loading && <SkeletonList rows={4} />}

      {!loading && filtered.length === 0 && entries.length > 0 && (
        <EmptyState icon={Search} title="No matching entries" subtitle="Try a different search term or filter." />
      )}

      {!loading && entries.length === 0 && (
        <EmptyState icon={Shield} title="No audit entries yet" subtitle="Actions like registrations, scans, and record updates will appear here." />
      )}

      {!loading && filtered.length > 0 && (
        <>
          <Card className="p-0">
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {pageEntries.map((e) => {
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
                      {e.details?.hospital && (
                        <span className="inline-flex items-center gap-1">
                          &middot; <Hospital size={12} /> {e.details.hospital}
                        </span>
                      )}
                      {e.details?.name && <span>&middot; {e.details.name}</span>}
                      {e.details?.dosage && <span>&middot; {e.details.dosage}</span>}
                      {e.details?.room && (
                        <span className="inline-flex items-center gap-1">
                          &middot; <DoorOpen size={12} /> {e.details.room}
                          {e.details?.number != null && ` (#${e.details.number})`}
                        </span>
                      )}
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

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Page {safePage} of {totalPages}
              </p>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
