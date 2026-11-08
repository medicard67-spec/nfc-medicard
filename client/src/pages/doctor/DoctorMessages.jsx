import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import api from "../../lib/api.js";
import Card from "../../components/Card.jsx";
import Avatar from "../../components/Avatar.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { SkeletonList } from "../../components/Skeleton.jsx";
import { t, dateLocale } from "../../i18n/index.js";

// Today: "2:30 pm"; earlier: "3 Nov".
function shortTime(iso) {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString(dateLocale(), { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString(dateLocale(), { day: "numeric", month: "short" });
}

// The doctor's inbox: one row per patient conversation, newest first. Opening
// one goes to that patient's record on the Message tab.
export default function DoctorMessages() {
  const navigate = useNavigate();
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () =>
      api
        .get("/messages/inbox")
        .then((res) => setThreads(res.data))
        .catch(() => {})
        .finally(() => setLoading(false));
    load();
    const interval = setInterval(load, 20000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">{t("Messages")}</h1>

      {loading && <SkeletonList rows={3} />}

      {!loading && threads.length === 0 && (
        <EmptyState
          icon={MessageCircle}
          title={t("No conversations yet")}
          subtitle={t("Message a patient from their record. Their replies will show up here.")}
        />
      )}

      {!loading && threads.length > 0 && (
        <Card className="divide-y divide-slate-100 p-0 dark:divide-slate-800">
          {threads.map((th) => {
            const m = th.lastMessage;
            const unread = th.unread > 0;
            return (
              <button
                key={th.patientId}
                onClick={() => navigate(`/doctor/patient/${th.patientId}?tab=Message`)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <Avatar name={th.patientName} url={th.avatarUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className={`truncate text-sm text-slate-800 dark:text-slate-100 ${unread ? "font-bold" : "font-semibold"}`}>
                      {th.patientName}
                    </p>
                    <span className={`flex-shrink-0 text-xs ${unread ? "font-semibold text-brand-700 dark:text-brand-300" : "text-slate-400 dark:text-slate-500"}`}>
                      {shortTime(m.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className={`truncate text-sm ${unread ? "font-medium text-slate-700 dark:text-slate-200" : "text-slate-500 dark:text-slate-400"}`}>
                      {m.senderRole === "doctor" && <span className="text-slate-400 dark:text-slate-500">{t("You:")} </span>}
                      {m.text}
                    </p>
                    {unread && (
                      <span className="flex h-5 min-w-[1.25rem] flex-shrink-0 items-center justify-center rounded-full bg-brand-600 px-1.5 text-[11px] font-bold text-white">
                        {th.unread > 9 ? "9+" : th.unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </Card>
      )}
    </div>
  );
}
