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

const { default: medicationsRouter } = await import("../src/routes/medications.js");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/medications", medicationsRouter);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { uid: "doctor1", role: "doctor", name: "Dr. Sarah Jenkins", email: "doctor@medicard.dev" };
});

describe("GET /api/medications", () => {
  it("requires a patientId", async () => {
    const res = await request(buildApp()).get("/api/medications");
    expect(res.status).toBe(400);
  });

  it("rejects a patient reading someone else's medications", async () => {
    currentUser = { uid: "patient1", role: "patient", name: "Ahmad Faiz", email: "patient@medicard.dev" };

    const res = await request(buildApp()).get("/api/medications").query({ patientId: "someone-else" });

    expect(res.status).toBe(403);
  });

  it("lets a patient read their own medications, including renewal frequency", async () => {
    currentUser = { uid: "p1", role: "patient", name: "Ahmad Faiz", email: "patient@medicard.dev" };
    mockSupabase.from.mockReturnValueOnce(
      chain({
        data: [
          {
            id: "m1", patient_id: "p1", name: "Amoxicillin", dosage: "500mg", frequency: "3x daily",
            renewal_frequency: "none", start_date: "2026-09-01", end_date: null,
            prescribed_by: "Dr. Sarah Jenkins", prescribed_by_id: "doctor1", notes: "",
            created_at: new Date().toISOString(),
          },
          {
            id: "m2", patient_id: "p1", name: "Metformin", dosage: "500mg", frequency: "2x daily",
            renewal_frequency: "monthly", start_date: "2026-08-01", end_date: "2026-09-01",
            prescribed_by: "Dr. Sarah Jenkins", prescribed_by_id: "doctor1", notes: "",
            created_at: new Date().toISOString(),
          },
        ],
        error: null,
      })
    );

    const res = await request(buildApp()).get("/api/medications").query({ patientId: "p1" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].renewalFrequency).toBe("none");
    expect(res.body[1].renewalFrequency).toBe("monthly");
    expect(res.body[1].endDate).toBe("2026-09-01");
  });
});

describe("POST /api/medications", () => {
  it("rejects when required fields are missing", async () => {
    const res = await request(buildApp()).post("/api/medications").send({ patientId: "p1", name: "Amoxicillin" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it("rejects a patient trying to add their own medication", async () => {
    currentUser = { uid: "p1", role: "patient", name: "Ahmad Faiz", email: "patient@medicard.dev" };

    const res = await request(buildApp())
      .post("/api/medications")
      .send({ patientId: "p1", name: "Amoxicillin", dosage: "500mg" });

    expect(res.status).toBe(403);
  });

  it("with no renewal frequency, has no computed end date (indefinite)", async () => {
    mockSupabase.from.mockReturnValueOnce(
      chain({
        data: {
          id: "m1", patient_id: "p1", name: "Amoxicillin", dosage: "500mg", frequency: "3x daily",
          renewal_frequency: "none", start_date: "2026-09-19", end_date: null,
          prescribed_by: "Dr. Sarah Jenkins", prescribed_by_id: "doctor1", notes: "",
          created_at: new Date().toISOString(),
        },
        error: null,
      })
    );

    const res = await request(buildApp())
      .post("/api/medications")
      .send({ patientId: "p1", name: "Amoxicillin", dosage: "500mg", frequency: "3x daily" });

    expect(res.status).toBe(201);
    expect(res.body.prescribedBy).toBe("Dr. Sarah Jenkins");
    expect(res.body.endDate).toBeNull();
    expect(res.body.renewalFrequency).toBe("none");
  });

  it("with a monthly renewal frequency, computes the end date one month out", async () => {
    mockSupabase.from.mockReturnValueOnce(
      chain({
        data: {
          id: "m1", patient_id: "p1", name: "Metformin", dosage: "500mg", frequency: "2x daily",
          renewal_frequency: "monthly", start_date: "2026-09-19", end_date: "2026-10-19",
          prescribed_by: "Dr. Sarah Jenkins", prescribed_by_id: "doctor1", notes: "",
          created_at: new Date().toISOString(),
        },
        error: null,
      })
    );

    const res = await request(buildApp())
      .post("/api/medications")
      .send({
        patientId: "p1", name: "Metformin", dosage: "500mg", frequency: "2x daily",
        startDate: "2026-09-19", renewalFrequency: "monthly",
      });

    expect(res.status).toBe(201);
    expect(res.body.renewalFrequency).toBe("monthly");
    expect(res.body.endDate).toBe("2026-10-19");

    const insertCallIndex = mockSupabase.from.mock.calls.findIndex(([table]) => table === "medications");
    const insertChain = mockSupabase.from.mock.results[insertCallIndex].value;
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ renewal_frequency: "monthly", end_date: "2026-10-19" })
    );
  });

  it("rejects an unrecognized renewal frequency by falling back to none", async () => {
    mockSupabase.from.mockReturnValueOnce(
      chain({
        data: {
          id: "m1", patient_id: "p1", name: "Amoxicillin", dosage: "500mg", frequency: "",
          renewal_frequency: "none", start_date: "2026-09-19", end_date: null,
          prescribed_by: "Dr. Sarah Jenkins", prescribed_by_id: "doctor1", notes: "",
          created_at: new Date().toISOString(),
        },
        error: null,
      })
    );

    const res = await request(buildApp())
      .post("/api/medications")
      .send({ patientId: "p1", name: "Amoxicillin", dosage: "500mg", renewalFrequency: "daily-ish-nonsense" });

    expect(res.status).toBe(201);
    const insertCallIndex = mockSupabase.from.mock.calls.findIndex(([table]) => table === "medications");
    const insertChain = mockSupabase.from.mock.results[insertCallIndex].value;
    expect(insertChain.insert).toHaveBeenCalledWith(expect.objectContaining({ renewal_frequency: "none", end_date: null }));
  });
});

describe("PATCH /api/medications/:id/renew", () => {
  it("rejects a patient renewing a medication", async () => {
    currentUser = { uid: "p1", role: "patient", name: "Ahmad Faiz", email: "patient@medicard.dev" };

    const res = await request(buildApp()).patch("/api/medications/m1/renew").send({});

    expect(res.status).toBe(403);
  });

  it("returns 404 when the medication doesn't exist", async () => {
    mockSupabase.from.mockReturnValueOnce(chain({ data: null, error: null }));

    const res = await request(buildApp()).patch("/api/medications/missing/renew").send({});

    expect(res.status).toBe(404);
  });

  it("rejects renewing a medication with no renewal cycle", async () => {
    mockSupabase.from.mockReturnValueOnce(
      chain({ data: { id: "m1", patient_id: "p1", renewal_frequency: "none" }, error: null })
    );

    const res = await request(buildApp()).patch("/api/medications/m1/renew").send({});

    expect(res.status).toBe(400);
  });

  it("pushes an expired monthly medication's due date forward from today", async () => {
    const today = new Date();
    const expected = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, today.getUTCDate()))
      .toISOString()
      .slice(0, 10);

    mockSupabase.from.mockReturnValueOnce(
      chain({
        data: { id: "m1", patient_id: "p1", name: "Metformin", renewal_frequency: "monthly", end_date: "2026-09-01" },
        error: null,
      })
    );
    const updateChain = chain({
      data: {
        id: "m1", patient_id: "p1", name: "Metformin", dosage: "500mg", frequency: "2x daily",
        renewal_frequency: "monthly", start_date: "2026-08-01", end_date: expected,
        prescribed_by: "Dr. Sarah Jenkins", prescribed_by_id: "doctor1", notes: "",
        created_at: new Date().toISOString(),
      },
      error: null,
    });
    mockSupabase.from.mockReturnValueOnce(updateChain);

    const res = await request(buildApp()).patch("/api/medications/m1/renew").send({});

    expect(res.status).toBe(200);
    expect(res.body.endDate).toBe(expected);
    expect(updateChain.update).toHaveBeenCalledWith({ end_date: expected });
  });
});
