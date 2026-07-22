import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSupabaseMock } from "./mocks/supabaseMock.js";

const mockSupabase = createSupabaseMock();

vi.mock("../src/lib/supabase.js", () => ({
  supabase: mockSupabase,
}));

const { requireAuth, requireRole } = await import("../src/middleware/auth.js");

function makeRes() {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireAuth", () => {
  it("rejects requests with no bearer token", async () => {
    const req = { headers: {} };
    const res = makeRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Missing bearer token" });
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects an invalid/expired token", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: "bad token" } });

    const req = { headers: { authorization: "Bearer invalid" } };
    const res = makeRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects a valid token whose profile no longer exists", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.com" } }, error: null });
    mockSupabase.from.mockReturnValueOnce({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: { message: "not found" } }) }) }),
    });

    const req = { headers: { authorization: "Bearer valid-but-no-profile" } };
    const res = makeRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("attaches req.user and calls next() for a valid token + profile", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: "u1", email: "doctor@medicard.dev" } }, error: null });
    mockSupabase.from.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: { id: "u1", role: "doctor", name: "Dr. Sarah Jenkins", email: "doctor@medicard.dev" }, error: null }),
        }),
      }),
    });

    const req = { headers: { authorization: "Bearer valid-token" } };
    const res = makeRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toEqual({ uid: "u1", email: "doctor@medicard.dev", role: "doctor", name: "Dr. Sarah Jenkins" });
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe("requireRole", () => {
  it("allows a user whose role is in the allowed list", () => {
    const req = { user: { role: "admin" } };
    const res = makeRes();
    const next = vi.fn();

    requireRole("admin", "doctor")(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("rejects a user whose role is not in the allowed list", () => {
    const req = { user: { role: "patient" } };
    const res = makeRes();
    const next = vi.fn();

    requireRole("admin", "doctor")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects when there is no req.user at all", () => {
    const req = {};
    const res = makeRes();
    const next = vi.fn();

    requireRole("admin")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
