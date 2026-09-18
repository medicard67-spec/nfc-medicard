import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { createSupabaseMock, chain } from "./mocks/supabaseMock.js";

const mockSupabase = createSupabaseMock();

vi.mock("../src/lib/supabase.js", () => ({
  supabase: mockSupabase,
}));

let currentUser = { uid: "admin1", role: "admin", name: "System Administrator", email: "admin@medicard.dev" };

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

const { default: queueRouter } = await import("../src/routes/queue.js");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/queue", queueRouter);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { uid: "admin1", role: "admin", name: "System Administrator", email: "admin@medicard.dev" };
});

describe("POST /api/queue", () => {
  it("rejects a doctor (admin-only)", async () => {
    currentUser = { uid: "doctor1", role: "doctor", name: "Dr. Sarah Jenkins", email: "doctor@medicard.dev" };

    const res = await request(buildApp()).post("/api/queue").send({ patientId: "p1", room: "Room 3" });

    expect(res.status).toBe(403);
  });

  it("rejects when patientId or room is missing", async () => {
    const res = await request(buildApp()).post("/api/queue").send({ patientId: "p1" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it("rejects when the patient doesn't exist", async () => {
    mockSupabase.from.mockReturnValueOnce(chain({ data: null, error: null }));

    const res = await request(buildApp()).post("/api/queue").send({ patientId: "p1", room: "Room 3" });

    expect(res.status).toBe(404);
  });

  it("assigns the next sequential number for today and returns the ticket", async () => {
    mockSupabase.from.mockReturnValueOnce(chain({ data: { id: "p1", name: "Ahmad Faiz" }, error: null })); // patient lookup
    mockSupabase.from.mockReturnValueOnce(chain({ data: null, error: null, count: 4 })); // today's count
    mockSupabase.from.mockReturnValueOnce(
      chain({
        data: { id: "t1", patient_id: "p1", patient_name: "Ahmad Faiz", number: 5, room: "Room 3", checked_in_by: "System Administrator", created_at: new Date().toISOString() },
        error: null,
      })
    ); // insert

    const res = await request(buildApp()).post("/api/queue").send({ patientId: "p1", room: "Room 3" });

    expect(res.status).toBe(201);
    expect(res.body.number).toBe(5);
    expect(res.body.room).toBe("Room 3");
    expect(res.body.patientName).toBe("Ahmad Faiz");
  });
});

describe("GET /api/queue", () => {
  it("rejects a patient", async () => {
    currentUser = { uid: "p1", role: "patient", name: "Ahmad Faiz", email: "patient@medicard.dev" };

    const res = await request(buildApp()).get("/api/queue");

    expect(res.status).toBe(403);
  });

  it("lists today's tickets", async () => {
    mockSupabase.from.mockReturnValueOnce(
      chain({ data: [{ id: "t1", patient_id: "p1", patient_name: "Ahmad Faiz", number: 1, room: "Room 1", checked_in_by: "Admin", created_at: new Date().toISOString() }], error: null })
    );

    const res = await request(buildApp()).get("/api/queue");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].number).toBe(1);
  });
});

describe("GET /api/queue/mine", () => {
  it("rejects an admin", async () => {
    const res = await request(buildApp()).get("/api/queue/mine");

    expect(res.status).toBe(403);
  });

  it("returns null when the patient hasn't checked in today", async () => {
    currentUser = { uid: "p1", role: "patient", name: "Ahmad Faiz", email: "patient@medicard.dev" };
    mockSupabase.from.mockReturnValueOnce(chain({ data: null, error: null }));

    const res = await request(buildApp()).get("/api/queue/mine");

    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  it("returns the patient's own ticket for today", async () => {
    currentUser = { uid: "p1", role: "patient", name: "Ahmad Faiz", email: "patient@medicard.dev" };
    mockSupabase.from.mockReturnValueOnce(
      chain({ data: { id: "t1", patient_id: "p1", patient_name: "Ahmad Faiz", number: 3, room: "Room 2", checked_in_by: "Admin", created_at: new Date().toISOString() }, error: null })
    );

    const res = await request(buildApp()).get("/api/queue/mine");

    expect(res.status).toBe(200);
    expect(res.body.number).toBe(3);
    expect(res.body.room).toBe("Room 2");
  });
});
