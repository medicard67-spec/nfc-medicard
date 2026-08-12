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

const { default: usersRouter } = await import("../src/routes/users.js");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/users", usersRouter);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { uid: "admin1", role: "admin", name: "System Administrator", email: "admin@medicard.dev" };
});

describe("POST /api/users (create doctor)", () => {
  it("rejects a hospital that isn't on the Malaysia allow-list", async () => {
    const res = await request(buildApp()).post("/api/users").send({
      email: "new.doctor@medicard.dev",
      password: "password123",
      name: "Dr. New Doctor",
      role: "doctor",
      department: "Cardiology",
      hospital: "Some Hospital in Singapore",
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/malaysian hospitals/i);
    expect(mockSupabase.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it("rejects a missing hospital for a doctor account", async () => {
    const res = await request(buildApp()).post("/api/users").send({
      email: "new.doctor@medicard.dev",
      password: "password123",
      name: "Dr. New Doctor",
      role: "doctor",
      department: "Cardiology",
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/malaysian hospitals/i);
  });

  it("creates a doctor account with a valid Malaysian hospital", async () => {
    mockSupabase.auth.admin.createUser.mockResolvedValue({
      data: { user: { id: "new-doctor-id" } },
      error: null,
    });
    // First from() call inserts into "profiles"
    mockSupabase.from.mockReturnValueOnce(chain({ data: null, error: null }));
    // Second from() call inserts into "doctors"
    mockSupabase.from.mockReturnValueOnce(chain({ data: null, error: null }));

    const res = await request(buildApp()).post("/api/users").send({
      email: "new.doctor@medicard.dev",
      password: "password123",
      name: "Dr. New Doctor",
      role: "doctor",
      department: "Cardiology",
      hospital: "Hospital Kuala Lumpur (HKL)",
    });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Dr. New Doctor");

    const doctorsCallIndex = mockSupabase.from.mock.calls.findIndex(([table]) => table === "doctors");
    const doctorsChain = mockSupabase.from.mock.results[doctorsCallIndex].value;
    expect(doctorsChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ hospital: "Hospital Kuala Lumpur (HKL)" })
    );
  });

  it("does not require a hospital for an admin account", async () => {
    mockSupabase.auth.admin.createUser.mockResolvedValue({
      data: { user: { id: "new-admin-id" } },
      error: null,
    });
    mockSupabase.from.mockReturnValueOnce(chain({ data: null, error: null }));

    const res = await request(buildApp()).post("/api/users").send({
      email: "new.admin@medicard.dev",
      password: "password123",
      name: "New Admin",
      role: "admin",
    });

    expect(res.status).toBe(201);
  });
});
