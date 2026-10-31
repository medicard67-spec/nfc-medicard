import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import { createSupabaseMock, chain } from "./mocks/supabaseMock.js";

const mockSupabase = createSupabaseMock();

vi.mock("../src/lib/supabase.js", () => ({
  supabase: mockSupabase,
}));

let currentUser = { uid: "doctor1", role: "doctor", name: "Dr. Sarah Jenkins", email: "doctor@medicard.dev" };

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

const { default: appointmentsRouter } = await import("../src/routes/appointments.js");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/appointments", appointmentsRouter);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { uid: "doctor1", role: "doctor", name: "Dr. Sarah Jenkins", email: "doctor@medicard.dev" };
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/appointments", () => {
  it("rejects a date in the past", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-31T04:00:00Z"), toFake: ["Date"] });

    const res = await request(buildApp())
      .post("/api/appointments")
      .send({ patientId: "p1", date: "2026-10-30" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/past date/);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it("rejects a date that isn't a real date", async () => {
    const res = await request(buildApp())
      .post("/api/appointments")
      .send({ patientId: "p1", date: "next tuesday" });

    expect(res.status).toBe(400);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it("uses Malaysian time: today is allowed even while it is still yesterday in UTC", async () => {
    // 2026-10-30 18:00 UTC is already 2026-10-31 02:00 in Malaysia.
    vi.useFakeTimers({ now: new Date("2026-10-30T18:00:00Z"), toFake: ["Date"] });
    mockSupabase.from.mockReturnValueOnce(
      chain({
        data: {
          id: "a1", patient_id: "p1", doctor_id: "doctor1", doctor_name: "Dr. Sarah Jenkins",
          date: "2026-10-31", notes: "", status: "scheduled", created_at: "2026-10-30T18:00:00Z",
        },
        error: null,
      })
    );

    const res = await request(buildApp())
      .post("/api/appointments")
      .send({ patientId: "p1", date: "2026-10-31" });

    expect(res.status).toBe(201);
    expect(res.body.date).toBe("2026-10-31");
  });

  it("saves the time and returns it as HH:MM", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-31T04:00:00Z"), toFake: ["Date"] });
    const query = chain({
      data: {
        id: "a3", patient_id: "p1", doctor_id: "doctor1", doctor_name: "Dr. Sarah Jenkins",
        date: "2026-11-14", start_time: "14:30:00", notes: "", status: "scheduled", created_at: "2026-10-31T04:00:00Z",
      },
      error: null,
    });
    mockSupabase.from.mockReturnValueOnce(query);

    const res = await request(buildApp())
      .post("/api/appointments")
      .send({ patientId: "p1", date: "2026-11-14", time: "14:30" });

    expect(res.status).toBe(201);
    expect(query.insert).toHaveBeenCalledWith(expect.objectContaining({ date: "2026-11-14", start_time: "14:30" }));
    expect(res.body.time).toBe("14:30");
  });

  it("rejects a time that isn't a real time", async () => {
    const res = await request(buildApp())
      .post("/api/appointments")
      .send({ patientId: "p1", date: "2099-01-01", time: "25:00" });

    expect(res.status).toBe(400);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it("rejects a time earlier today (Malaysian time)", async () => {
    // 04:00 UTC = 12:00 noon in Malaysia
    vi.useFakeTimers({ now: new Date("2026-10-31T04:00:00Z"), toFake: ["Date"] });

    const res = await request(buildApp())
      .post("/api/appointments")
      .send({ patientId: "p1", date: "2026-10-31", time: "11:30" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already passed/);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it("allows a later time today", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-31T04:00:00Z"), toFake: ["Date"] });
    mockSupabase.from.mockReturnValueOnce(
      chain({
        data: {
          id: "a4", patient_id: "p1", doctor_id: "doctor1", doctor_name: "Dr. Sarah Jenkins",
          date: "2026-10-31", start_time: "15:00:00", notes: "", status: "scheduled", created_at: "2026-10-31T04:00:00Z",
        },
        error: null,
      })
    );

    const res = await request(buildApp())
      .post("/api/appointments")
      .send({ patientId: "p1", date: "2026-10-31", time: "15:00" });

    expect(res.status).toBe(201);
  });

  it("still accepts an appointment with no time (older app versions)", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-31T04:00:00Z"), toFake: ["Date"] });
    mockSupabase.from.mockReturnValueOnce(
      chain({
        data: {
          id: "a5", patient_id: "p1", doctor_id: "doctor1", doctor_name: "Dr. Sarah Jenkins",
          date: "2026-11-02", start_time: null, notes: "", status: "scheduled", created_at: "2026-10-31T04:00:00Z",
        },
        error: null,
      })
    );

    const res = await request(buildApp())
      .post("/api/appointments")
      .send({ patientId: "p1", date: "2026-11-02" });

    expect(res.status).toBe(201);
    expect(res.body.time).toBeNull();
  });

  it("allows a future date", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-31T04:00:00Z"), toFake: ["Date"] });
    mockSupabase.from.mockReturnValueOnce(
      chain({
        data: {
          id: "a2", patient_id: "p1", doctor_id: "doctor1", doctor_name: "Dr. Sarah Jenkins",
          date: "2026-11-14", notes: "Follow-up", status: "scheduled", created_at: "2026-10-31T04:00:00Z",
        },
        error: null,
      })
    );

    const res = await request(buildApp())
      .post("/api/appointments")
      .send({ patientId: "p1", date: "2026-11-14", notes: "Follow-up" });

    expect(res.status).toBe(201);
  });
});
