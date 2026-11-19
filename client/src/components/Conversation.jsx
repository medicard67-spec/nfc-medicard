import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import api from "../lib/api.js";
import Card from "./Card.jsx";
import { SkeletonList } from "./Skeleton.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useUnread } from "../context/UnreadContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { t, dateLocale } from "../i18n/index.js";

function messageTime(iso) {
  return new Date(iso).toLocaleString(dateLocale(), { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

// One patient's conversation with their care team, as a chat: oldest at the
// top, your own messages on the right, the reply box underneath. Used by both
// the doctor (patient record, Message tab) and the patient (Messages page).
// Checks for new messages every 15 s while open and marks them read.
export default function Conversation({
  patientId,
  emptyText = "No messages yet.",
  placeholder = "Write a message...",
  listClass = "max-h-[55vh]",
}) {
  const toast = useToast();
  const { role, profile } = useAuth();
  const { refresh: refreshUnread } = useUnread();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  const load = () =>
    api
      .get("/messages", { params: { patientId } })
      .then((res) => setMessages([...res.data].reverse()))
      .catch(() => {})
      .finally(() => setLoading(false));
  const markRead = () => api.post("/messages/mark-read", { patientId }).then(refreshUnread).catch(() => {});

  useEffect(() => {
    if (!patientId) return;
    load().then(markRead);
    const interval = setInterval(() => load().then(markRead), 15000);
    return () => clearInterval(interval);
  }, [patientId]);

  // keep the newest message in view
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length]);

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      await api.post("/messages", { patientId, text: text.trim() });
      setText("");
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || t("Failed to send message."));
    } finally {
      setSending(false);
    }
  };

  // a doctor's own messages are the ones they sent; a patient's are all patient messages
  const isMine = (m) => m.senderRole === role && (role !== "doctor" || m.doctorId === profile?.uid);

  return (
    <Card className="overflow-hidden !p-0">
      <h3 className="px-4 pb-3 pt-4 text-sm font-semibold text-slate-700 dark:text-slate-200">{t("Conversation")}</h3>
      <div ref={listRef} className={`${listClass} min-h-[10rem] space-y-3 overflow-y-auto border-y border-slate-100 bg-slate-50/60 px-4 py-4 dark:border-slate-800 dark:bg-slate-900/40`}>
        {loading && <SkeletonList rows={2} />}
        {!loading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center text-sm text-slate-400 dark:text-slate-500">
            <MessageCircle size={22} className="mb-2" />
            {t(emptyText)}
          </div>
        )}
        {messages.map((m) => {
          const mine = isMine(m);
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] sm:max-w-[70%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                {!mine && (
                  <span className="mb-0.5 px-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                    {m.senderName}
                    <span className="text-slate-400 dark:text-slate-500"> · {t(m.senderRole === "patient" ? "Patient" : "Doctor")}</span>
                  </span>
                )}
                <div
                  className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                    mine
                      ? "rounded-br-md bg-brand-600 text-white"
                      : m.senderRole === "patient"
                      ? "rounded-bl-md bg-white text-slate-800 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700"
                      : "rounded-bl-md bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100"
                  }`}
                >
                  {m.text}
                </div>
                <span className="mt-0.5 px-1 text-[11px] text-slate-400 dark:text-slate-500">{messageTime(m.createdAt)}</span>
              </div>
            </div>
          );
        })}
      </div>
      <form onSubmit={submit} className="flex items-end gap-2 p-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends, Shift+Enter starts a new line
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form.requestSubmit();
            }
          }}
          rows={2}
          placeholder={t(placeholder)}
          className="min-w-0 flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
        <button
          disabled={sending || !text.trim()}
          aria-label={t("Send")}
          className="flex h-10 flex-shrink-0 items-center gap-1.5 rounded-xl bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 sm:px-4"
        >
          <Send size={15} />
          <span className="hidden sm:inline">{sending ? t("Sending...") : t("Send")}</span>
        </button>
      </form>
    </Card>
  );
}
