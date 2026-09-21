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
  it("includes imageUrls and physicianDepartment on each returned record", async () => {
    mockSupabase.from.mockReturnValueOnce(
      chain({
        data: [
          {
            id: "h1", patient_id: "p1", diagnosis: "Laceration", date: "2026-01-01",
            physician: "Dr. Sarah Jenkins", physician_id: "doctor1", physician_department: "Orthopedics",
            remarks: "", image_urls: ["https://example.com/a.png", "https://example.com/b.png"],
            created_at: new Date().toISOString(),
          },
        ],
        error: null,
      })
    );

    const res = await request(buildApp()).get("/api/medical-history").query({ patientId: "p1" });

    expect(res.status).toBe(200);
    expect(res.body[0].imageUrls).toEqual(["https://example.com/a.png", "https://example.com/b.png"]);
    expect(res.body[0].physicianDepartment).toBe("Orthopedics");
  });

  it("sorts by when the record was published (created_at), not the clinical date", async () => {
    const listChain = chain({ data: [], error: null });
    mockSupabase.from.mockReturnValueOnce(listChain);

    await request(buildApp()).get("/api/medical-history").query({ patientId: "p1" });

    expect(listChain.order).toHaveBeenCalledWith("created_at", { ascending: false });
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
    mockSupabase.from.mockReturnValueOnce(chain({ data: { department: "Orthopedics" }, error: null }));
    mockSupabase.from.mockReturnValueOnce(
      chain({
        data: {
          id: "h1", patient_id: "p1", diagnosis: "Routine check", date: "2026-01-01",
          physician: "Dr. Sarah Jenkins", physician_id: "doctor1", physician_department: "Orthopedics",
          remarks: "", image_urls: [], created_at: new Date().toISOString(),
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
    expect(res.body.physicianDepartment).toBe("Orthopedics");
  });

  it("uploads attached images and stores their URLs", async () => {
    mockSupabase.from.mockReturnValueOnce(chain({ data: { department: "Orthopedics" }, error: null }));
    mockSupabase.from.mockReturnValueOnce(
      chain({
        data: {
          id: "h1", patient_id: "p1", diagnosis: "Laceration - left forearm", date: "2026-01-01",
          physician: "Dr. Sarah Jenkins", physician_id: "doctor1", physician_department: "Orthopedics",
          remarks: "Healing well",
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

  it("rejects referring to a doctor id that doesn't exist", async () => {
    mockSupabase.from.mockReturnValueOnce(chain({ data: { department: "Orthopedics" }, error: null }));
    mockSupabase.from.mockReturnValueOnce(chain({ data: null, error: null }));

    const res = await request(buildApp())
      .post("/api/medical-history")
      .field("patientId", "p1")
      .field("diagnosis", "Routine check")
      .field("referredToDoctorId", "missing-doctor");

    expect(res.status).toBe(400);
  });

  it("referring to a specific doctor stores their name and department, ignoring any department field", async () => {
    mockSupabase.from.mockReturnValueOnce(chain({ data: { department: "Orthopedics" }, error: null }));
    mockSupabase.from.mockReturnValueOnce(
      chain({ data: { id: "doctor2", name: "Dr. Robert Chan", department: "Cardiology" }, error: null })
    );
    mockSupabase.from.mockReturnValueOnce(
      chain({
        data: {
          id: "h1", patient_id: "p1", diagnosis: "Chest pain", date: "2026-01-01",
          physician: "Dr. Sarah Jenkins", physician_id: "doctor1", physician_department: "Orthopedics",
          remarks: "", image_urls: [],
          referred_to_doctor_id: "doctor2", referred_to_doctor_name: "Dr. Robert Chan",
          referred_to_doctor_department: "Cardiology", referred_to_department: null,
          created_at: new Date().toISOString(),
        },
        error: null,
      })
    );

    const res = await request(buildApp())
      .post("/api/medical-history")
      .field("patientId", "p1")
      .field("diagnosis", "Chest pain")
      .field("referredToDoctorId", "doctor2")
      .field("referredToDepartment", "Neurology");

    expect(res.status).toBe(201);
    expect(res.body.referredToDoctorName).toBe("Dr. Robert Chan");
    expect(res.body.referredToDoctorDepartment).toBe("Cardiology");
    expect(res.body.referredToDepartment).toBeNull();

    const insertCallIndex = mockSupabase.from.mock.calls.findIndex(([table]) => table === "medical_history");
    const insertChain = mockSupabase.from.mock.results[insertCallIndex].value;
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ referred_to_doctor_id: "doctor2", referred_to_department: null })
    );
  });

  it("referring to a department (no specific doctor) stores it plainly", async () => {
    mockSupabase.from.mockReturnValueOnce(chain({ data: { department: "Orthopedics" }, error: null }));
    mockSupabase.from.mockReturnValueOnce(
      chain({
        data: {
          id: "h1", patient_id: "p1", diagnosis: "Numbness", date: "2026-01-01",
          physician: "Dr. Sarah Jenkins", physician_id: "doctor1", physician_department: "Orthopedics",
          remarks: "", image_urls: [],
          referred_to_doctor_id: null, referred_to_doctor_name: null, referred_to_doctor_department: null,
          referred_to_department: "Neurology",
          created_at: new Date().toISOString(),
        },
        error: null,
      })
    );

    const res = await request(buildApp())
      .post("/api/medical-history")
      .field("patientId", "p1")
      .field("diagnosis", "Numbness")
      .field("referredToDepartment", "Neurology");

    expect(res.status).toBe(201);
    expect(res.body.referredToDepartment).toBe("Neurology");
    expect(res.body.referredToDoctorId).toBeNull();
  });
});

describe("PATCH /api/medical-history/:id", () => {
  it("rejects a patient trying to edit a record", async () => {
    currentUser = { uid: "p1", role: "patient", name: "Ahmad Faiz", email: "patient@medicard.dev" };

    const res = await request(buildApp())
      .patch("/api/medical-history/h1")
      .send({ diagnosis: "Self-edit" });

    expect(res.status).toBe(403);
  });

  it("rejects an empty edit with no fields", async () => {
    const res = await request(buildApp()).patch("/api/medical-history/h1").send({});

    expect(res.status).toBe(400);
  });

  it("returns 404 when the record doesn't exist", async () => {
    mockSupabase.from.mockReturnValueOnce(chain({ data: null, error: null }));

    const res = await request(buildApp()).patch("/api/medical-history/missing").send({ diagnosis: "X" });

    expect(res.status).toBe(404);
  });

  it("updates diagnosis, date, and remarks, preserving remarks exactly as sent", async () => {
    const multilineRemarks = "Line one.\n\nLine two with   spacing preserved.";
    mockSupabase.from.mockReturnValueOnce(
      chain({
        data: {
          id: "h1", patient_id: "p1", diagnosis: "Updated diagnosis", date: "2026-02-02",
          physician: "Dr. Sarah Jenkins", physician_id: "doctor1", remarks: multilineRemarks,
          image_urls: [], created_at: new Date().toISOString(),
        },
        error: null,
      })
    );

    const res = await request(buildApp())
      .patch("/api/medical-history/h1")
      .send({ diagnosis: "Updated diagnosis", date: "2026-02-02", remarks: multilineRemarks });

    expect(res.status).toBe(200);
    expect(res.body.diagnosis).toBe("Updated diagnosis");
    expect(res.body.remarks).toBe(multilineRemarks);

    const updateCallIndex = mockSupabase.from.mock.calls.findIndex(([table]) => table === "medical_history");
    const updateChain = mockSupabase.from.mock.results[updateCallIndex].value;
    expect(updateChain.update).toHaveBeenCalledWith({
      diagnosis: "Updated diagnosis",
      date: "2026-02-02",
      remarks: multilineRemarks,
    });
  });
});
