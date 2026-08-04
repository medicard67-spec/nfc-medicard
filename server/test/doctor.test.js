import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { createSupabaseMock, chain } from "./mocks/supabaseMock.js";

const mockSupabase = createSupabaseMock();

vi.mock("../src/lib/supabase.js", () => ({
  supabase: mockSupabase,
  AVATARS_BUCKET: "avatars",
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

const { default: doctorRouter } = await import("../src/routes/doctor.js");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/doctor", doctorRouter);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { uid: "doctor1", role: "doctor", name: "Dr. Sarah Jenkins", email: "doctor@medicard.dev" };
});

describe("POST /api/doctor/avatar", () => {
  it("rejects a patient trying to use the doctor avatar route", async () => {
    currentUser = { uid: "patient1", role: "patient", name: "Ahmad Faiz", email: "patient@medicard.dev" };

    const res = await request(buildApp())
      .post("/api/doctor/avatar")
      .attach("file", Buffer.from("fake-image-bytes"), { filename: "photo.png", contentType: "image/png" });

    expect(res.status).toBe(403);
  });

  it("rejects a request with no file", async () => {
    const res = await request(buildApp()).post("/api/doctor/avatar");

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/file is required/i);
  });

  it("rejects a non-image file", async () => {
    const res = await request(buildApp())
      .post("/api/doctor/avatar")
      .attach("file", Buffer.from("not an image"), { filename: "notes.txt", contentType: "text/plain" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/must be an image/i);
  });

  it("updates the logged-in doctor's own avatar and returns it", async () => {
    mockSupabase.from.mockReturnValueOnce(
      chain({ data: { department: "Cardiology", avatar_url: "https://example.com/file" }, error: null })
    );

    const res = await request(buildApp())
      .post("/api/doctor/avatar")
      .attach("file", Buffer.from("fake-image-bytes"), { filename: "photo.png", contentType: "image/png" });

    expect(res.status).toBe(200);
    expect(res.body.avatarUrl).toBe("https://example.com/file");
    expect(mockSupabase.from).toHaveBeenCalledWith("doctors");
  });
});
