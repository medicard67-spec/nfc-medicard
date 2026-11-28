import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { createSupabaseMock, chain } from "./mocks/supabaseMock.js";

const mockSupabase = createSupabaseMock();
vi.mock("../src/lib/supabase.js", () => ({ supabase: mockSupabase }));

// a fake Firebase: records what would be sent, and says one phone uninstalled the app
const sendEachForMulticast = vi.fn(async ({ tokens }) => ({
  responses: tokens.map((tk) => (tk === "dead-token" ? { success: false, error: { code: "messaging/registration-token-not-registered" } } : { success: true })),
}));
vi.mock("firebase-admin/app", () => ({ initializeApp: vi.fn(() => ({})), cert: vi.fn(() => ({})) }));
vi.mock("firebase-admin/messaging", () => ({ getMessaging: vi.fn(() => ({ sendEachForMulticast })) }));

let currentUser = { uid: "p1", role: "patient", name: "Ahmad Faiz", email: "patient@medicard.dev" };
vi.mock("../src/middleware/auth.js", async () => {
  const actual = await vi.importActual("../src/middleware/auth.js");
  return { ...actual, requireAuth: (req, _res, next) => { req.user = currentUser; next(); } };
});

process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({ project_id: "test" });
const { sendPush, pushText } = await import("../src/lib/push.js");
const { default: notificationsRouter } = await import("../src/routes/notifications.js");

beforeEach(() => {
  vi.clearAllMocks();
  mockSupabase.from.mockReset();
});

describe("pushText", () => {
  it("writes the push in the phone's language", () => {
    expect(pushText("queue.called", { room: "Room 3", number: 7 }, "ms")).toEqual({ title: "Giliran anda!", body: "Sila ke Room 3 sekarang · Nombor giliran 7" });
    expect(pushText("queue.called", { room: "Room 3", number: 7 }, "xx").title).toBe("It's your turn!");
  });
});

describe("sendPush", () => {
  it("sends to every phone the patient is logged in on, on the loud channel for 'your turn', and forgets uninstalled phones", async () => {
    const del = chain({ data: null, error: null });
    mockSupabase.from
      .mockReturnValueOnce(chain({ data: [{ token: "phone-1", lang: "en" }, { token: "dead-token", lang: "en" }], error: null }))
      .mockReturnValueOnce(del);

    await sendPush(["p1"], "queue.called", { room: "Room 3", number: 7 }, "/patient");

    const msg = sendEachForMulticast.mock.calls[0][0];
    expect(msg.tokens).toEqual(["phone-1", "dead-token"]);
    expect(msg.notification).toEqual({ title: "It's your turn!", body: "Please go to Room 3 now · Queue number 7" });
    expect(msg.android.notification.channelId).toBe("turn");
    expect(msg.data).toEqual({ type: "queue.called", link: "/patient" });
    expect(del.delete).toHaveBeenCalled();
    expect(del.in).toHaveBeenCalledWith("token", ["dead-token"]);
  });

  it("does not push reminders or other in-app-only notifications", async () => {
    await sendPush(["p1"], "appointment.reminder", {}, "/patient/appointments");
    expect(mockSupabase.from).not.toHaveBeenCalled();
    expect(sendEachForMulticast).not.toHaveBeenCalled();
  });
});

describe("POST /api/notifications/devices", () => {
  it("registers the logged-in user's phone, claiming it if someone else used it before", async () => {
    const q = chain({ data: null, error: null });
    mockSupabase.from.mockReturnValueOnce(q);
    const app = express();
    app.use(express.json());
    app.use("/api/notifications", notificationsRouter);

    const res = await request(app).post("/api/notifications/devices").send({ token: "phone-1", platform: "android", lang: "ms" });

    expect(res.status).toBe(200);
    expect(q.upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: "p1", token: "phone-1", lang: "ms" }), { onConflict: "token" });
  });

  it("stores English for a language the app no longer offers", async () => {
    const q = chain({ data: null, error: null });
    mockSupabase.from.mockReturnValueOnce(q);
    const app = express();
    app.use(express.json());
    app.use("/api/notifications", notificationsRouter);

    await request(app).post("/api/notifications/devices").send({ token: "phone-2", platform: "android", lang: "ta" });

    expect(q.upsert).toHaveBeenCalledWith(expect.objectContaining({ lang: "en" }), { onConflict: "token" });
  });
});
