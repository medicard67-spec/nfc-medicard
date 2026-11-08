import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { createSupabaseMock, chain } from "./mocks/supabaseMock.js";

const mockSupabase = createSupabaseMock();

vi.mock("../src/lib/supabase.js", () => ({
  supabase: mockSupabase,
}));

const DOCTOR = { uid: "doctor1", role: "doctor", name: "Dr. Sarah Jenkins", email: "doctor@medicard.dev" };
const PATIENT = { uid: "p1", role: "patient", name: "Ahmad Faiz", email: "patient@medicard.dev" };
let currentUser = DOCTOR;

vi.mock("../src/middleware/auth.js", async () => {
  const actual = await vi.importActual("../src/middleware/auth.js");
  return {
    ...actual,
    requireAuth: (req, _res, next) => {
      req.user = currentUser;
      next();
    },
  };
});

const { default: messagesRouter } = await import("../src/routes/messages.js");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/messages", messagesRouter);
  return app;
}

function msg(over) {
  return {
    id: "m", patient_id: "p1", doctor_id: "doctor1", sender_role: "doctor", sender_name: "Dr. Sarah Jenkins",
    text: "Hi", read: false, created_at: "2026-11-01T02:00:00Z", ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = DOCTOR;
});

describe("GET /api/messages/inbox", () => {
  it("groups a doctor's messages into one conversation per patient, newest first, with unread counts", async () => {
    const query = chain({
      data: [
        msg({ id: "m4", patient_id: "p2", sender_role: "patient", doctor_id: null, sender_name: "Nur Aisyah", text: "Thank you", created_at: "2026-11-03T02:00:00Z" }),
        msg({ id: "m3", sender_role: "patient", sender_name: "Ahmad Faiz", text: "Okay doctor", created_at: "2026-11-02T03:00:00Z" }),
        msg({ id: "m2", sender_role: "patient", sender_name: "Ahmad Faiz", text: "When is my review?", created_at: "2026-11-02T02:00:00Z" }),
        msg({ id: "m1", text: "Your results are ready", read: true, created_at: "2026-11-01T02:00:00Z" }),
      ],
      error: null,
    });
    mockSupabase.from
      .mockReturnValueOnce(query)
      .mockReturnValueOnce(chain({ data: [{ id: "p1", name: "Ahmad Faiz", avatar_url: null }, { id: "p2", name: "Nur Aisyah", avatar_url: null }], error: null }));

    const res = await request(buildApp()).get("/api/messages/inbox");

    expect(res.status).toBe(200);
    expect(query.or).toHaveBeenCalledWith("doctor_id.eq.doctor1,and(doctor_id.is.null,sender_role.eq.patient)");
    expect(res.body.map((t) => [t.patientName, t.lastMessage.text, t.unread])).toEqual([
      ["Nur Aisyah", "Thank you", 1],
      ["Ahmad Faiz", "Okay doctor", 2],
    ]);
  });

  it("is only for doctors", async () => {
    currentUser = PATIENT;
    const res = await request(buildApp()).get("/api/messages/inbox");
    expect(res.status).toBe(403);
  });
});

describe("POST /api/messages", () => {
  it("sends a patient's reply to the doctor who last messaged them", async () => {
    currentUser = PATIENT;
    const insert = chain({ data: msg({ id: "m9", sender_role: "patient", text: "Noted" }), error: null });
    mockSupabase.from
      .mockReturnValueOnce(chain({ data: { doctor_id: "doctor1" }, error: null }))
      .mockReturnValueOnce(insert);

    const res = await request(buildApp()).post("/api/messages").send({ patientId: "p1", text: "Noted" });

    expect(res.status).toBe(201);
    expect(insert.insert).toHaveBeenCalledWith(expect.objectContaining({ doctor_id: "doctor1", sender_role: "patient" }));
  });

  it("leaves a patient's message to the whole care team when no doctor has written yet", async () => {
    currentUser = PATIENT;
    const insert = chain({ data: msg({ id: "m10", sender_role: "patient", doctor_id: null }), error: null });
    mockSupabase.from.mockReturnValueOnce(chain({ data: null, error: null })).mockReturnValueOnce(insert);

    const res = await request(buildApp()).post("/api/messages").send({ patientId: "p1", text: "Hello" });

    expect(res.status).toBe(201);
    expect(insert.insert).toHaveBeenCalledWith(expect.objectContaining({ doctor_id: null }));
  });

  it("tags a doctor's message with that doctor", async () => {
    const insert = chain({ data: msg({ id: "m11" }), error: null });
    mockSupabase.from.mockReturnValueOnce(insert);

    const res = await request(buildApp()).post("/api/messages").send({ patientId: "p1", text: "Hi" });

    expect(res.status).toBe(201);
    expect(insert.insert).toHaveBeenCalledWith(expect.objectContaining({ doctor_id: "doctor1", sender_role: "doctor" }));
  });
});
