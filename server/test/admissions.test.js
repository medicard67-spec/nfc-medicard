import { describe, it, expect, vi, beforeEach } from "vitest";
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

const { default: admissionsRouter } = await import("../src/routes/admissions.js");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/admissions", admissionsRouter);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { uid: "doctor1", role: "doctor", name: "Dr. Sarah Jenkins", email: "doctor@medicard.dev" };
});

describe("GET /api/admissions", () => {
  it("requires a patientId", async () => {
    const res = await request(buildApp()).get("/api/admissions");
    expect(res.status).toBe(400);
  });

  it("rejects a patient reading someone else's admissions", async () => {
    currentUser = { uid: "patient1", role: "patient", name: "Ahmad Faiz", email: "patient@medicard.dev" };

    const res = await request(buildApp()).get("/api/admissions").query({ patientId: "someone-else" });

    expect(res.status).toBe(403);
  });

  it("returns admissions ordered newest first", async () => {
    mockSupabase.from.mockReturnValueOnce(
      chain({
        data: [
          {
            id: "a1", patient_id: "p1", admitted_by: "Dr. Sarah Jenkins", admitted_by_id: "doctor1",
            ward: "Ward 3A", reason: "Observation", admitted_at: "2026-09-15T00:00:00Z",
            discharged_at: null, discharged_by: null, created_at: "2026-09-15T00:00:00Z",
          },
        ],
        error: null,
      })
    );

    const res = await request(buildApp()).get("/api/admissions").query({ patientId: "p1" });

    expect(res.status).toBe(200);
    expect(res.body[0].ward).toBe("Ward 3A");
    expect(res.body[0].dischargedAt).toBeNull();
  });
});

describe("POST /api/admissions", () => {
  it("rejects a patient trying to admit themselves", async () => {
    currentUser = { uid: "p1", role: "patient", name: "Ahmad Faiz", email: "patient@medicard.dev" };

    const res = await request(buildApp()).post("/api/admissions").send({ patientId: "p1" });

    expect(res.status).toBe(403);
  });

  it("rejects admitting a patient who already has an open admission", async () => {
    mockSupabase.from.mockReturnValueOnce(chain({ data: { id: "existing-admission" }, error: null }));

    const res = await request(buildApp()).post("/api/admissions").send({ patientId: "p1", ward: "Ward 3A" });

    expect(res.status).toBe(409);
  });

  it("admits a patient with the submitting doctor attached", async () => {
    mockSupabase.from.mockReturnValueOnce(chain({ data: null, error: null })); // no open admission
    mockSupabase.from.mockReturnValueOnce(
      chain({
        data: {
          id: "a1", patient_id: "p1", admitted_by: "Dr. Sarah Jenkins", admitted_by_id: "doctor1",
          ward: "Ward 3A", reason: "Observation", admitted_at: new Date().toISOString(),
          discharged_at: null, discharged_by: null, created_at: new Date().toISOString(),
        },
        error: null,
      })
    );

    const res = await request(buildApp())
      .post("/api/admissions")
      .send({ patientId: "p1", ward: "Ward 3A", reason: "Observation" });

    expect(res.status).toBe(201);
    expect(res.body.admittedBy).toBe("Dr. Sarah Jenkins");
    expect(res.body.ward).toBe("Ward 3A");
    expect(res.body.dischargedAt).toBeNull();
  });
});

describe("PATCH /api/admissions/:id/discharge", () => {
  it("rejects a patient trying to discharge", async () => {
    currentUser = { uid: "p1", role: "patient", name: "Ahmad Faiz", email: "patient@medicard.dev" };

    const res = await request(buildApp()).patch("/api/admissions/a1/discharge").send({});

    expect(res.status).toBe(403);
  });

  it("returns 404 when the admission doesn't exist", async () => {
    mockSupabase.from.mockReturnValueOnce(chain({ data: null, error: null }));

    const res = await request(buildApp()).patch("/api/admissions/missing/discharge").send({});

    expect(res.status).toBe(404);
  });

  it("rejects discharging an admission that's already discharged", async () => {
    mockSupabase.from.mockReturnValueOnce(
      chain({ data: { id: "a1", patient_id: "p1", discharged_at: "2026-09-10T00:00:00Z" }, error: null })
    );

    const res = await request(buildApp()).patch("/api/admissions/a1/discharge").send({});

    expect(res.status).toBe(400);
  });

  it("discharges an open admission", async () => {
    mockSupabase.from.mockReturnValueOnce(
      chain({ data: { id: "a1", patient_id: "p1", ward: "Ward 3A", discharged_at: null }, error: null })
    );
    mockSupabase.from.mockReturnValueOnce(
      chain({
        data: {
          id: "a1", patient_id: "p1", admitted_by: "Dr. Sarah Jenkins", admitted_by_id: "doctor1",
          ward: "Ward 3A", reason: "Observation", admitted_at: "2026-09-15T00:00:00Z",
          discharged_at: "2026-09-22T00:00:00Z", discharged_by: "Dr. Sarah Jenkins",
          created_at: "2026-09-15T00:00:00Z",
        },
        error: null,
      })
    );

    const res = await request(buildApp()).patch("/api/admissions/a1/discharge").send({});

    expect(res.status).toBe(200);
    expect(res.body.dischargedAt).toBe("2026-09-22T00:00:00Z");
    expect(res.body.dischargedBy).toBe("Dr. Sarah Jenkins");
  });
});
