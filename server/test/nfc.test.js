import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { createSupabaseMock, chain } from "./mocks/supabaseMock.js";

const mockSupabase = createSupabaseMock();

vi.mock("../src/lib/supabase.js", () => ({
  supabase: mockSupabase,
}));

// Stub auth entirely so this test focuses on the NFC lookup logic itself,
// not the auth middleware (already covered in auth.test.js).
vi.mock("../src/middleware/auth.js", () => ({
  requireAuth: (req, _res, next) => {
    req.user = { uid: "doctor1", role: "doctor", name: "Dr. Sarah Jenkins", email: "doctor@medicard.dev" };
    next();
  },
  requireRole: () => (_req, _res, next) => next(),
}));

const { default: nfcRouter } = await import("../src/routes/nfc.js");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/nfc", nfcRouter);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/nfc/:cardUid", () => {
  it("returns the bound patient when the card is registered", async () => {
    const patientRow = {
      id: "p1", name: "Ahmad Faiz", email: "patient@medicard.dev", ic: "010203-14-1234",
      dob: "2001-02-03", age: 25, gender: "Male", blood_type: "O+",
      allergies: ["Penicillin"], chronic_illnesses: [], height: 172, weight: 68,
      phone: "", emergency_contact_name: "", emergency_contact_phone: "",
      card_uid: "04A3B2C1", created_at: new Date().toISOString(),
    };
    mockSupabase.from.mockReturnValueOnce(chain({ data: patientRow, error: null }));

    const app = buildApp();
    const res = await request(app).get("/api/nfc/04A3B2C1");

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Ahmad Faiz");
    expect(res.body.cardUid).toBe("04A3B2C1");
  });

  it("returns 404 for an unregistered card", async () => {
    mockSupabase.from.mockReturnValueOnce(chain({ data: null, error: null }));

    const app = buildApp();
    const res = await request(app).get("/api/nfc/DEADBEEF");

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not registered/i);
  });

  it("records the scan method (qr) in the audit log", async () => {
    const patientRow = {
      id: "p1", name: "Ahmad Faiz", email: "patient@medicard.dev", ic: "010203-14-1234",
      card_uid: "04A3B2C1", created_at: new Date().toISOString(),
    };
    mockSupabase.from.mockReturnValueOnce(chain({ data: patientRow, error: null }));

    const res = await request(buildApp()).get("/api/nfc/04A3B2C1").query({ method: "qr" });

    expect(res.status).toBe(200);
    const auditCallIndex = mockSupabase.from.mock.calls.findIndex(([table]) => table === "audit_log");
    expect(auditCallIndex).toBeGreaterThan(-1);
    const auditChain = mockSupabase.from.mock.results[auditCallIndex].value;
    expect(auditChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ details: expect.objectContaining({ method: "qr" }) })
    );
  });

  it("falls back to 'manual' for an unrecognized or missing method", async () => {
    const patientRow = { id: "p1", name: "Ahmad Faiz", card_uid: "04A3B2C1" };
    mockSupabase.from.mockReturnValueOnce(chain({ data: patientRow, error: null }));

    const res = await request(buildApp()).get("/api/nfc/04A3B2C1").query({ method: "bogus" });

    expect(res.status).toBe(200);
    const auditCallIndex = mockSupabase.from.mock.calls.findIndex(([table]) => table === "audit_log");
    const auditChain = mockSupabase.from.mock.results[auditCallIndex].value;
    expect(auditChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ details: expect.objectContaining({ method: "manual" }) })
    );
  });
});
