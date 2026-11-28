// Checks for the defects found in the 28 Nov 2026 test round.
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { createSupabaseMock, chain } from "./mocks/supabaseMock.js";

const mockSupabase = createSupabaseMock();
vi.mock("../src/lib/supabase.js", () => ({
  supabase: mockSupabase,
  AVATARS_BUCKET: "avatars",
  PRIVATE_BUCKETS: ["lab-results", "radiology", "medical-images"],
}));

let currentUser = { uid: "doctor1", role: "doctor", name: "Dr. Sarah Jenkins", email: "doctor@medicard.dev" };
vi.mock("../src/middleware/auth.js", async () => {
  const actual = await vi.importActual("../src/middleware/auth.js");
  return { ...actual, requireAuth: (req, _res, next) => { req.user = currentUser; next(); } };
});

const { malaysiaToday, malaysiaDayStart } = await import("../src/lib/time.js");
const { safeFileName } = await import("../src/lib/upload.js");
const { catchAsyncErrors } = await import("../src/lib/asyncErrors.js");
const { addInterval, isDate, default: medicationsRouter } = await import("../src/routes/medications.js");
const { icName, default: patientsRouter } = await import("../src/routes/patients.js");
const { default: messagesRouter } = await import("../src/routes/messages.js");

function app(path, router) {
  const a = express();
  a.use(express.json());
  a.use(path, catchAsyncErrors(router));
  a.use((err, _req, res, _next) => res.status(500).json({ error: "Something went wrong on the server. Please try again." }));
  return a;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { uid: "doctor1", role: "doctor", name: "Dr. Sarah Jenkins", email: "doctor@medicard.dev" };
});

describe("Malaysian dates on a UTC server", () => {
  it("is already the next day at 7:30 am Malaysia time", () => {
    const at = new Date("2026-11-29T07:30:00+08:00"); // still 28 Nov in UTC
    expect(malaysiaToday(at)).toBe("2026-11-29");
    expect(malaysiaDayStart(at)).toBe("2026-11-28T16:00:00.000Z"); // midnight in Malaysia
  });
});

describe("renewal dates", () => {
  it("stays inside the month instead of spilling over", () => {
    expect(addInterval("2027-01-31", "monthly")).toBe("2027-02-28");
    expect(addInterval("2028-01-31", "monthly")).toBe("2028-02-29");
    expect(addInterval("2026-11-30", "quarterly")).toBe("2027-02-28");
    expect(addInterval("2028-02-29", "yearly")).toBe("2029-02-28");
    expect(addInterval("2026-11-28", "weekly")).toBe("2026-12-05");
    expect(addInterval("2026-11-28", "none")).toBe(null);
  });
  it("only accepts real dates", () => {
    expect(isDate("2026-11-28")).toBe(true);
    expect(isDate("2026-02-30")).toBe(false);
    expect(isDate("notadate")).toBe(false);
  });
});

describe("upload file names", () => {
  it("turns any file name into a storage-safe one", () => {
    expect(safeFileName("résultat.png")).toBe("resultat.png");
    expect(safeFileName("report[final].pdf")).toBe("report-final.pdf");
    expect(safeFileName("化验.png")).toMatch(/^[A-Za-z0-9._-]+$/);
    expect(safeFileName("scan 1.png")).toBe("scan-1.png");
  });
});

describe("errors inside a route always get an answer", () => {
  it("answers a broken request instead of leaving it hanging", async () => {
    const r = express.Router();
    r.get("/", async () => { throw new Error("boom"); });
    const res = await request(app("/x", r)).get("/x");
    expect(res.status).toBe(500);
  });
  it("refuses a medication with an invalid start date", async () => {
    const res = await request(app("/api/medications", medicationsRouter))
      .post("/api/medications").send({ patientId: "p1", name: "x", dosage: "1", startDate: "notadate" });
    expect(res.status).toBe(400);
  });
});

describe("patients", () => {
  it("keeps names in capital letters, as on the IC", () => {
    expect(icName("  ahmad  faiz bin rahman ")).toBe("AHMAD FAIZ BIN RAHMAN");
  });
  it("searches safely when the search has a comma", async () => {
    const q = chain({ data: [], error: null });
    mockSupabase.from.mockReturnValueOnce(q);
    const res = await request(app("/api/patients", patientsRouter)).get("/api/patients?search=" + encodeURIComponent("Ali, (Ahmad)"));
    expect(res.status).toBe(200);
    expect(q.or).toHaveBeenCalledWith("name.ilike.%Ali Ahmad%,ic.ilike.%Ali Ahmad%");
  });
  it("saves an edited name in capitals, on the profile too", async () => {
    const patientQ = chain({ data: { id: "p1", name: "SITI AMINAH" }, error: null });
    const profileQ = chain({ data: null, error: null });
    mockSupabase.from.mockReturnValueOnce(patientQ).mockReturnValueOnce(profileQ);
    const res = await request(app("/api/patients", patientsRouter)).patch("/api/patients/p1").send({ name: "siti aminah" });
    expect(res.status).toBe(200);
    expect(patientQ.update).toHaveBeenCalledWith(expect.objectContaining({ name: "SITI AMINAH" }));
    expect(profileQ.update).toHaveBeenCalledWith({ name: "SITI AMINAH" });
  });
  it("won't attach a retired card when registering a patient by hand", async () => {
    mockSupabase.from
      .mockReturnValueOnce(chain({ data: null, error: null })) // no patient has it
      .mockReturnValueOnce(chain({ data: { card_uid: "AABB" }, error: null })); // but it was retired
    const res = await request(app("/api/patients", patientsRouter))
      .post("/api/patients").send({ email: "a@b.c", password: "secret123", name: "x", cardUid: "AABB" });
    expect(res.status).toBe(409);
  });
});

describe("messages", () => {
  it("doesn't let a patient address a message to a non-doctor account", async () => {
    currentUser = { uid: "p1", role: "patient", name: "Ahmad Faiz", email: "faiz@example.com" };
    mockSupabase.from
      .mockReturnValueOnce(chain({ data: null, error: null })) // that account is not a doctor
      .mockReturnValueOnce(chain({ data: null, error: null })); // no earlier doctor message
    const insertQ = chain({ data: { id: "m1", patient_id: "p1", doctor_id: null, sender_role: "patient", text: "hi" }, error: null });
    mockSupabase.from.mockReturnValueOnce(insertQ);
    const res = await request(app("/api/messages", messagesRouter))
      .post("/api/messages").send({ patientId: "p1", doctorId: "p2", text: "hi" });
    expect(res.status).toBe(201);
    expect(insertQ.insert).toHaveBeenCalledWith(expect.objectContaining({ doctor_id: null }));
  });
  it("a doctor only marks messages for them (or the care team) as read", async () => {
    const q = chain({ error: null });
    mockSupabase.from.mockReturnValueOnce(q);
    await request(app("/api/messages", messagesRouter)).post("/api/messages/mark-read").send({ patientId: "p1" });
    expect(q.or).toHaveBeenCalledWith("doctor_id.eq.doctor1,and(doctor_id.is.null,sender_role.eq.patient)");
  });
});

describe("uploaded file names keep their accents", () => {
  it("reads the name the way the browser sent it", async () => {
    const { fileNameOf } = await import("../src/lib/upload.js");
    const asReceived = Buffer.from("résultat.pdf", "utf8").toString("latin1");
    expect(fileNameOf({ originalname: asReceived })).toBe("résultat.pdf");
    expect(fileNameOf({ originalname: "scan.png" })).toBe("scan.png");
  });
});

describe("round 2 fixes", () => {
  it("treats lower-case or colon-separated card UIDs as the same card", async () => {
    const { normalizeUid } = await import("../src/lib/onlineCard.js");
    expect(normalizeUid("04:a3:a2:ed:3d:02:89")).toBe("04A3A2ED3D0289");
    expect(normalizeUid(" 04 a3 a2 ")).toBe("04A3A2");
  });
  it("answers database errors in plain words", async () => {
    const { sendDbError } = await import("../src/lib/dbError.js");
    const res = { status: vi.fn(() => res), json: vi.fn(() => res) };
    sendDbError(res, { code: "23503", message: 'violates foreign key constraint "x"' });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Patient not found." });
  });
  it("refuses a blank message", async () => {
    currentUser = { uid: "p1", role: "patient", name: "AHMAD FAIZ", email: "faiz@example.com" };
    const res = await request(app("/api/messages", messagesRouter)).post("/api/messages").send({ patientId: "p1", text: "   " });
    expect(res.status).toBe(400);
  });
  it("refuses an age that isn't a number", async () => {
    const res = await request(app("/api/patients", patientsRouter)).patch("/api/patients/p1").send({ age: "abc" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/valid age/);
  });
});
