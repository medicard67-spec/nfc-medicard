import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import api from "../../lib/api.js";
import Card from "../../components/Card.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { SkeletonList } from "../../components/Skeleton.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { useUnread } from "../../context/UnreadContext.jsx";

export default function PatientMessages() {
  const { profile } = useAuth();
  const toast = useToast();
  const { refresh: refreshUnread } = useUnread();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const load = () => {
    if (!profile?.uid) return;
    api
      .get("/messages", { params: { patientId: profile.uid } })
      .then((res) => setMessages(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(load, [profile?.uid]);

  useEffect(() => {
    if (!profile?.uid) return;
    api.post("/messages/mark-read", { patientId: profile.uid }).then(refreshUnread);
  }, [profile?.uid]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      await api.post("/messages", { patientId: profile.uid, text });
      setText("");
      load();
      toast.success("Message sent.");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Messages</h1>

      <form onSubmit={send} className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message your care team..."
          className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <button
          disabled={sending}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {sending ? "Sending..." : "Send"}
        </button>
      </form>

      {loading && <SkeletonList rows={2} />}

      {!loading && messages.length === 0 && (
        <EmptyState icon="💬" title="No messages yet" subtitle="Messages from your care team will show up here." />
      )}

      <div className="space-y-3">
        {messages.map((m) => (
          <Card key={m.id}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {m.senderRole === "patient" ? "You" : m.senderName}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {m.createdAt ? new Date(m.createdAt).toLocaleString() : "Just now"}
              </p>
            </div>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{m.text}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
