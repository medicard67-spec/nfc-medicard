import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { createSupabaseMock, chain } from "./mocks/supabaseMock.js";

const mockSupabase = createSupabaseMock();

vi.mock("../src/lib/supabase.js", () => ({
  supabase: mockSupabase,
  AVATARS_BUCKET: "avatars",
}));

// Controllable "logged in as" user for each test; requireRole below is the
// real middleware, so role restrictions are genuinely exercised.
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

const { default: patientsRouter } = await import("../src/routes/patients.js");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/patients", patientsRouter);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { uid: "doctor1", role: "doctor", name: "Dr. Sarah Jenkins", email: "doctor@medicard.dev" };
});

describe("GET /api/patients", () => {
  it("rejects a patient trying to list all patients", async () => {
    currentUser = { uid: "patient1", role: "patient", name: "Ahmad Faiz", email: "patient@medicard.dev" };

    const res = await request(buildApp()).get("/api/patients");

    expect(res.status).toBe(403);
  });

  it("allows a doctor and returns the patient list", async () => {
    mockSupabase.from.mockReturnValueOnce(
      chain({
        data: [
          { id: "p1", name: "Ahmad Faiz", email: "a@b.com", ic: "010203-14-1234", gender: "Male", age: 25, allergies: [], chronic_illnesses: [], created_at: new Date().toISOString() },
        ],
        error: null,
      })
    );

    const res = await request(buildApp()).get("/api/patients");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe("Ahmad Faiz");
  });
});

describe("POST /api/patients", () => {
  it("rejects when required fields are missing", async () => {
    const res = await request(buildApp()).post("/api/patients").send({ name: "Missing Email" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it("creates a patient account when fields are valid", async () => {
    mockSupabase.auth.admin.createUser.mockResolvedValue({
      data: { user: { id: "new-patient-id" } },
      error: null,
    });
    // First from() call inside createPatientAccount inserts into "profiles"
    mockSupabase.from.mockReturnValueOnce(chain({ data: null, error: null }));
    // Second from() call inserts into "patients" and selects it back
    mockSupabase.from.mockReturnValueOnce(
      chain({
        data: {
          id: "new-patient-id", name: "New Patient", email: "new@medicard.dev",
          ic: "", dob: null, age: null, gender: "", blood_type: "", allergies: [],
          chronic_illnesses: [], height: null, weight: null, phone: "",
          emergency_contact_name: "", emergency_contact_phone: "", card_uid: null,
          created_at: new Date().toISOString(),
        },
        error: null,
      })
    );

    const res = await request(buildApp())
      .post("/api/patients")
      .send({ name: "New Patient", email: "new@medicard.dev", password: "password123" });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("New Patient");
    expect(mockSupabase.auth.admin.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: "new@medicard.dev", password: "password123" })
    );
  });
});

describe("POST /api/patients/:id/card", () => {
  beforeEach(() => {
    currentUser = { uid: "admin1", role: "admin", name: "System Administrator", email: "admin@medicard.dev" };
  });

  it("rejects a doctor (admin-only action)", async () => {
    currentUser = { uid: "doctor1", role: "doctor", name: "Dr. Sarah Jenkins", email: "doctor@medicard.dev" };

    const res = await request(buildApp()).post("/api/patients/p1/card").send({ cardUid: "AABBCCDD" });

    expect(res.status).toBe(403);
  });

  it("rejects when cardUid is missing", async () => {
    const res = await request(buildApp()).post("/api/patients/p1/card").send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cardUid is required/i);
  });

  it("rejects when the patient already has a card", async () => {
    mockSupabase.from.mockReturnValueOnce(chain({ data: { id: "p1", name: "Ahmad Faiz", card_uid: "04A3B2C1" }, error: null }));

    const res = await request(buildApp()).post("/api/patients/p1/card").send({ cardUid: "AABBCCDD" });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already has a card/i);
  });

  it("rejects when the card UID is already used by another patient", async () => {
    mockSupabase.from.mockReturnValueOnce(chain({ data: { id: "p1", name: "Ahmad Faiz", card_uid: null }, error: null }));
    mockSupabase.from.mockReturnValueOnce(chain({ data: { id: "p2" }, error: null }));

    const res = await request(buildApp()).post("/api/patients/p1/card").send({ cardUid: "AABBCCDD" });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already registered/i);
  });

  it("binds the card to an existing patient with no account changes", async () => {
    mockSupabase.from.mockReturnValueOnce(chain({ data: { id: "p1", name: "Ahmad Faiz", card_uid: null }, error: null }));
    mockSupabase.from.mockReturnValueOnce(chain({ data: null, error: null }));
    mockSupabase.from.mockReturnValueOnce(
      chain({
        data: {
          id: "p1", name: "Ahmad Faiz", email: "patient@medicard.dev", ic: "", dob: null, age: null,
          gender: "", blood_type: "", allergies: [], chronic_illnesses: [], height: null, weight: null,
          phone: "", emergency_contact_name: "", emergency_contact_phone: "", card_uid: "AABBCCDD",
          created_at: new Date().toISOString(),
        },
        error: null,
      })
    );

    const res = await request(buildApp()).post("/api/patients/p1/card").send({ cardUid: "AABBCCDD" });

    expect(res.status).toBe(200);
    expect(res.body.cardUid).toBe("AABBCCDD");
    expect(mockSupabase.auth.admin.createUser).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/patients/:id", () => {
  it("rejects a patient editing someone else's profile", async () => {
    currentUser = { uid: "patient1", role: "patient", name: "Ahmad Faiz", email: "patient@medicard.dev" };

    const res = await request(buildApp())
      .patch("/api/patients/someone-else")
      .send({ phone: "0123456789" });

    expect(res.status).toBe(403);
  });

  it("lets a patient update their own contact details only, ignoring clinical fields", async () => {
    currentUser = { uid: "p1", role: "patient", name: "Ahmad Faiz", email: "patient@medicard.dev" };
    mockSupabase.from.mockReturnValueOnce(
      chain({
        data: {
          id: "p1", name: "Ahmad Faiz", email: "patient@medicard.dev", ic: "", dob: null, age: null,
          gender: "", blood_type: "O+", allergies: [], chronic_illnesses: [], height: null, weight: null,
          phone: "0123456789", emergency_contact_name: "Mum", emergency_contact_phone: "0199999999",
          card_uid: null, created_at: new Date().toISOString(),
        },
        error: null,
      })
    );

    const res = await request(buildApp())
      .patch("/api/patients/p1")
      .send({ phone: "0123456789", bloodType: "Z-", name: "Hacked Name" });

    expect(res.status).toBe(200);
    expect(res.body.phone).toBe("0123456789");
    const updateCall = mockSupabase.from.mock.results[0].value.update.mock.calls[0][0];
    expect(updateCall).not.toHaveProperty("blood_type");
    expect(updateCall).not.toHaveProperty("name");
  });

  it("still lets a doctor update clinical fields", async () => {
    mockSupabase.from.mockReturnValueOnce(
      chain({
        data: {
          id: "p1", name: "Ahmad Faiz", email: "patient@medicard.dev", ic: "", dob: null, age: null,
          gender: "", blood_type: "A+", allergies: [], chronic_illnesses: [], height: null, weight: null,
          phone: "", emergency_contact_name: "", emergency_contact_phone: "", card_uid: null,
          created_at: new Date().toISOString(),
        },
        error: null,
      })
    );

    const res = await request(buildApp()).patch("/api/patients/p1").send({ bloodType: "A+" });

    expect(res.status).toBe(200);
    expect(res.body.bloodType).toBe("A+");
  });
});

describe("POST /api/patients/:id/avatar", () => {
  it("rejects a patient uploading an avatar for someone else", async () => {
    currentUser = { uid: "patient1", role: "patient", name: "Ahmad Faiz", email: "patient@medicard.dev" };

    const res = await request(buildApp())
      .post("/api/patients/someone-else/avatar")
      .attach("file", Buffer.from("fake-image-bytes"), { filename: "photo.png", contentType: "image/png" });

    expect(res.status).toBe(403);
  });

  it("rejects a request with no file", async () => {
    const res = await request(buildApp()).post("/api/patients/p1/avatar");

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/file is required/i);
  });

  it("rejects a non-image file", async () => {
    const res = await request(buildApp())
      .post("/api/patients/p1/avatar")
      .attach("file", Buffer.from("not an image"), { filename: "notes.txt", contentType: "text/plain" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/must be an image/i);
  });

  it("lets a patient upload their own avatar and returns the new avatarUrl", async () => {
    currentUser = { uid: "p1", role: "patient", name: "Ahmad Faiz", email: "patient@medicard.dev" };
    mockSupabase.from.mockReturnValueOnce(
      chain({
        data: {
          id: "p1", name: "Ahmad Faiz", email: "patient@medicard.dev", ic: "", dob: null, age: null,
          gender: "", blood_type: "", allergies: [], chronic_illnesses: [], height: null, weight: null,
          phone: "", emergency_contact_name: "", emergency_contact_phone: "", card_uid: null,
          avatar_url: "https://example.com/file", created_at: new Date().toISOString(),
        },
        error: null,
      })
    );

    const res = await request(buildApp())
      .post("/api/patients/p1/avatar")
      .attach("file", Buffer.from("fake-image-bytes"), { filename: "photo.png", contentType: "image/png" });

    expect(res.status).toBe(200);
    expect(res.body.avatarUrl).toBe("https://example.com/file");
  });
});
