import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { createSupabaseMock, chain } from "./mocks/supabaseMock.js";

const mockSupabase = createSupabaseMock();

vi.mock("../src/lib/supabase.js", () => ({
  supabase: mockSupabase,
  MEDICAL_IMAGES_BUCKET: "medical-images",
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

const { default: medicalHistoryRouter } = await import("../src/routes/medicalHistory.js");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/medical-history", medicalHistoryRouter);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { uid: "doctor1", role: "doctor", name: "Dr. Sarah Jenkins", email: "doctor@medicard.dev" };
});

describe("GET /api/medical-history", () => {
  it("includes imageUrls on each returned record", async () => {
    mockSupabase.from.mockReturnValueOnce(
      chain({
        data: [
          {
            id: "h1", patient_id: "p1", diagnosis: "Laceration", date: "2026-01-01",
            physician: "Dr. Sarah Jenkins", physician_id: "doctor1", remarks: "",
            image_urls: ["https://example.com/a.png", "https://example.com/b.png"],
            created_at: new Date().toISOString(),
          },
        ],
        error: null,
      })
    );

    const res = await request(buildApp()).get("/api/medical-history").query({ patientId: "p1" });

    expect(res.status).toBe(200);
    expect(res.body[0].imageUrls).toEqual(["https://example.com/a.png", "https://example.com/b.png"]);
  });
});

describe("POST /api/medical-history", () => {
  it("rejects when required fields are missing", async () => {
    const res = await request(buildApp()).post("/api/medical-history").send({ patientId: "p1" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it("rejects a patient trying to create a record", async () => {
    currentUser = { uid: "p1", role: "patient", name: "Ahmad Faiz", email: "patient@medicard.dev" };

    const res = await request(buildApp())
      .post("/api/medical-history")
      .field("patientId", "p1")
      .field("diagnosis", "Self-diagnosis");

    expect(res.status).toBe(403);
  });

  it("creates a record with no images (backward compatible)", async () => {
    mockSupabase.from.mockReturnValueOnce(
      chain({
        data: {
          id: "h1", patient_id: "p1", diagnosis: "Routine check", date: "2026-01-01",
          physician: "Dr. Sarah Jenkins", physician_id: "doctor1", remarks: "",
          image_urls: [], created_at: new Date().toISOString(),
        },
        error: null,
      })
    );

    const res = await request(buildApp())
      .post("/api/medical-history")
      .field("patientId", "p1")
      .field("diagnosis", "Routine check");

    expect(res.status).toBe(201);
    expect(res.body.imageUrls).toEqual([]);
  });

  it("uploads attached images and stores their URLs", async () => {
    mockSupabase.from.mockReturnValueOnce(
      chain({
        data: {
          id: "h1", patient_id: "p1", diagnosis: "Laceration - left forearm", date: "2026-01-01",
          physician: "Dr. Sarah Jenkins", physician_id: "doctor1", remarks: "Healing well",
          image_urls: ["https://example.com/file", "https://example.com/file"],
          created_at: new Date().toISOString(),
        },
        error: null,
      })
    );

    const res = await request(buildApp())
      .post("/api/medical-history")
      .field("patientId", "p1")
      .field("diagnosis", "Laceration - left forearm")
      .field("remarks", "Healing well")
      .attach("images", Buffer.from("fake-image-1"), { filename: "wound1.png", contentType: "image/png" })
      .attach("images", Buffer.from("fake-image-2"), { filename: "wound2.png", contentType: "image/png" });

    expect(res.status).toBe(201);
    expect(res.body.imageUrls).toHaveLength(2);

    const insertCallIndex = mockSupabase.from.mock.calls.findIndex(([table]) => table === "medical_history");
    const insertChain = mockSupabase.from.mock.results[insertCallIndex].value;
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ image_urls: expect.arrayContaining([expect.any(String)]) })
    );
  });
});
