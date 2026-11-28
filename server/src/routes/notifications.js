import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { createDueReminders } from "../lib/notify.js";

const router = Router();

function toJson(row) {
  return {
    id: row.id,
    type: row.type,
    data: row.data || {},
    link: row.link,
    read: row.read,
    createdAt: row.created_at,
  };
}

// The logged-in user's latest 50 notifications, newest first.
router.get("/", requireAuth, async (req, res) => {
  await createDueReminders(req.user);
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", req.user.uid)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map(toJson));
});

// For the red badge on the bell; the app asks every 20 s.
router.get("/unread-count", requireAuth, async (req, res) => {
  await createDueReminders(req.user);
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", req.user.uid)
    .eq("read", false);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ count: count || 0 });
});

// Mark the given notifications (ids) as read, or all of them when no ids are sent.
// Only ever touches the logged-in user's own notifications.
router.post("/read", requireAuth, async (req, res) => {
  if (req.body?.ids !== undefined && !Array.isArray(req.body.ids)) {
    return res.status(400).json({ error: "ids must be a list." });
  }
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : null;
  let query = supabase.from("notifications").update({ read: true }).eq("user_id", req.user.uid).eq("read", false);
  if (ids) query = query.in("id", ids);
  const { error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// The app registers its phone for push after login (one row per phone; a
// phone that someone else logged in on before is moved to this user).
router.post("/devices", requireAuth, async (req, res) => {
  const { token, platform, lang } = req.body || {};
  if (!token || typeof token !== "string") return res.status(400).json({ error: "token is required" });
  const { error } = await supabase.from("device_tokens").upsert(
    { user_id: req.user.uid, token, platform: platform || "android", lang: ["en", "ms"].includes(lang) ? lang : "en", updated_at: new Date().toISOString() },
    { onConflict: "token" }
  );
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// On logout: stop pushing to this phone.
router.post("/devices/remove", requireAuth, async (req, res) => {
  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: "token is required" });
  const { error } = await supabase.from("device_tokens").delete().eq("token", token).eq("user_id", req.user.uid);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

export default router;
