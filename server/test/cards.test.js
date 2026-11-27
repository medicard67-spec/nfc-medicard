import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { createSupabaseMock, chain } from "./mocks/supabaseMock.js";

const mockSupabase = createSupabaseMock();

vi.mock("../src/lib/supabase.js", () => ({
  supabase: mockSupabase,
}));

// the emailed code is Supabase Auth's job; here we only decide what it answers
const mockCode = { send: vi.fn(), check: vi.fn() };
vi.mock("../src/lib/cardCode.js", async () => {
  const actual = await vi.importActual("../src/lib/cardCode.js");
  return {
    ...actual,
    sendCardCode: (...args) => mockCode.send(...args),
    checkCardCode: (...args) => mockCode.check(...args),
  };
});

const PATIENT = { uid: "p1", role: "patient", name: "Ahmad Faiz", email: "faiz@example.com" };
let currentUser = PATIENT;

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

const { default: cardsRouter, normalizeUid, MAX_ATTEMPTS } = await import("../src/routes/cards.js");
const { maskEmail } = await import("../src/lib/cardCode.js");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/cards", cardsRouter);
  return app;
}

const me = (extra = {}) => ({ id: "p1", name: "Ahmad Faiz", email: "faiz@example.com", card_uid: null, card_status: "active", ...extra });
// the next supabase.from() calls answer these, in order
const answers = (...results) => results.forEach((r) => mockSupabase.from.mockReturnValueOnce(chain(r)));

beforeEach(() => {
  vi.clearAllMocks();
  mockSupabase.from.mockReset();
  mockSupabase.from.mockImplementation(() => chain({ data: null, error: null }));
  currentUser = PATIENT;
  mockCode.send.mockResolvedValue();
  mockCode.check.mockResolvedValue(true);
});

describe("helpers", () => {
  it("normalizes a card UID the way cards are stored", () => {
    expect(normalizeUid("04:a3:b2:c1")).toBe("04A3B2C1");
    expect(normalizeUid(" 04 a3-b2 ")).toBe("04A3B2");
  });

  it("hides most of the email address", () => {
    expect(maskEmail("faizrahman@gmail.com")).toBe("f***n@gmail.com");
    expect(maskEmail("ab@x.com")).toBe("a@x.com");
    expect(maskEmail("")).toBe("");
  });
});

describe("POST /api/cards/check", () => {
  it("recognizes the patient's own card", async () => {
    answers({ data: me({ card_uid: "AABB" }), error: null });
    const res = await request(buildApp()).post("/api/cards/check").send({ cardUid: "aa:bb" });
    expect(res.status).toBe(200);
    expect(res.body.result).toBe("mine");
    expect(res.body.canLink).toBe(false);
  });

  it("says when the patient's own card is reported lost", async () => {
    answers({ data: me({ card_uid: "AABB", card_status: "lost" }), error: null });
    const res = await request(buildApp()).post("/api/cards/check").send({ cardUid: "AABB" });
    expect(res.body.result).toBe("mine-lost");
  });

  it("never reveals whose card someone else's card is", async () => {
    answers({ data: me({ card_uid: "AABB" }), error: null }, { data: { id: "p2" }, error: null });
    const res = await request(buildApp()).post("/api/cards/check").send({ cardUid: "CCDD" });
    expect(res.body.result).toBe("not-yours");
    expect(JSON.stringify(res.body)).not.toContain("p2");
  });

  it("offers to link a new card to a patient without one", async () => {
    answers({ data: me(), error: null });
    const res = await request(buildApp()).post("/api/cards/check").send({ cardUid: "CCDD" });
    expect(res.body.result).toBe("unlinked");
    expect(res.body.canLink).toBe(true);
  });

  it("does not offer linking while the patient's card is still active", async () => {
    answers({ data: me({ card_uid: "AABB" }), error: null });
    const res = await request(buildApp()).post("/api/cards/check").send({ cardUid: "CCDD" });
    expect(res.body.canLink).toBe(false);
  });

  it("rejects doctors (patients only)", async () => {
    currentUser = { uid: "d1", role: "doctor", name: "Dr. Sarah" };
    const res = await request(buildApp()).post("/api/cards/check").send({ cardUid: "AABB" });
    expect(res.status).toBe(403);
  });
});

describe("POST /api/cards/link/start", () => {
  it("emails a code and remembers which card is waiting", async () => {
    const upsert = chain({ data: null, error: null });
    answers(
      { data: me(), error: null }, // patient
      { data: null, error: null }, // card not in use
      { data: null, error: null }, // card never replaced
      { data: null, error: null }, // no pending request
    );
    mockSupabase.from.mockReturnValueOnce(upsert);

    const res = await request(buildApp()).post("/api/cards/link/start").send({ cardUid: "ccdd" });

    expect(res.status).toBe(200);
    expect(res.body.emailHint).toBe("f***z@example.com");
    expect(mockCode.send).toHaveBeenCalledWith("faiz@example.com");
    expect(upsert.upsert).toHaveBeenCalledWith(expect.objectContaining({ patient_id: "p1", card_uid: "CCDD", attempts: 0 }));
  });

  it("refuses while the patient still has an active card", async () => {
    answers({ data: me({ card_uid: "AABB" }), error: null });
    const res = await request(buildApp()).post("/api/cards/link/start").send({ cardUid: "CCDD" });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("has-card");
    expect(mockCode.send).not.toHaveBeenCalled();
  });

  it("refuses a card that belongs to someone", async () => {
    answers({ data: me(), error: null }, { data: { id: "p2" }, error: null });
    const res = await request(buildApp()).post("/api/cards/link/start").send({ cardUid: "CCDD" });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("card-taken");
  });

  it("refuses a card that was replaced before", async () => {
    answers({ data: me(), error: null }, { data: null, error: null }, { data: { card_uid: "CCDD", patient_id: "p9" }, error: null });
    const res = await request(buildApp()).post("/api/cards/link/start").send({ cardUid: "CCDD" });
    expect(res.status).toBe(409);
  });

  it("sends patients without an email to the desk", async () => {
    answers({ data: me({ email: "" }), error: null });
    const res = await request(buildApp()).post("/api/cards/link/start").send({ cardUid: "CCDD" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("no-email");
  });

  it("makes the patient wait a minute between codes", async () => {
    answers(
      { data: me(), error: null }, { data: null, error: null }, { data: null, error: null },
      { data: { sent_at: new Date(Date.now() - 20000).toISOString() }, error: null },
    );
    const res = await request(buildApp()).post("/api/cards/link/start").send({ cardUid: "CCDD" });
    expect(res.status).toBe(429);
    expect(res.body.retryAfter).toBeGreaterThan(30);
    expect(mockCode.send).not.toHaveBeenCalled();
  });

  it("explains when the email could not be sent", async () => {
    mockCode.send.mockRejectedValue(new Error("Email rate limit exceeded"));
    answers({ data: me(), error: null }, { data: null, error: null }, { data: null, error: null }, { data: null, error: null });
    const res = await request(buildApp()).post("/api/cards/link/start").send({ cardUid: "CCDD" });
    expect(res.status).toBe(502);
    expect(res.body.code).toBe("email-failed");
  });
});

describe("adding a card to the phone (online MediCard)", () => {
  const pending = (extra = {}) => ({
    patient_id: "p1", card_uid: "AABB", attempts: 0,
    sent_at: new Date().toISOString(), expires_at: new Date(Date.now() + 600000).toISOString(), ...extra,
  });

  it("emails a code when the patient taps their own active card", async () => {
    answers({ data: me({ card_uid: "AABB" }), error: null }, { data: null, error: null });
    const res = await request(buildApp()).post("/api/cards/link/start").send({ cardUid: "aa:bb" });
    expect(res.status).toBe(200);
    expect(res.body.mode).toBe("add");
    expect(mockCode.send).toHaveBeenCalledWith("faiz@example.com");
  });

  it("refuses the patient's own card while it is reported lost", async () => {
    answers({ data: me({ card_uid: "AABB", card_status: "lost" }), error: null });
    const res = await request(buildApp()).post("/api/cards/link/start").send({ cardUid: "AABB" });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("card-lost");
  });

  it("refuses a phone token as a card", async () => {
    const res = await request(buildApp()).post("/api/cards/link/start").send({ cardUid: `MCP${"A".repeat(32)}` });
    expect(res.status).toBe(409);
    expect(mockCode.send).not.toHaveBeenCalled();
  });

  it("gives the phone a token and stores only its hash", async () => {
    const insert = chain({ data: { id: "oc1" }, error: null });
    answers(
      { data: me({ card_uid: "AABB" }), error: null }, // patient
      { data: pending(), error: null }, // waiting request
      { data: null, error: null }, // delete request
    );
    mockSupabase.from.mockReturnValueOnce(insert);

    const res = await request(buildApp()).post("/api/cards/link/confirm").send({ code: "123456", phone: true, deviceName: "Pixel 9" });

    expect(res.status).toBe(200);
    expect(res.body.onlineCard.id).toBe("oc1");
    expect(res.body.onlineCard.token).toMatch(/^MCP[0-9A-F]{32}$/);
    const row = insert.insert.mock.calls[0][0];
    expect(row).toMatchObject({ patient_id: "p1", card_uid: "AABB", device_name: "Pixel 9" });
    expect(row.token_hash).toHaveLength(64);
    expect(JSON.stringify(row)).not.toContain(res.body.onlineCard.token);
  });

  it("lists the phones the card is on", async () => {
    answers(
      { data: me({ card_uid: "AABB" }), error: null },
      { data: [], error: null },
      { data: [{ id: "oc1", card_uid: "AABB", device_name: "Pixel 9", created_at: "2026-11-27T00:00:00Z" }, { id: "oc0", card_uid: "OLD1", device_name: "Old phone" }], error: null },
    );
    const res = await request(buildApp()).get("/api/cards/mine");
    expect(res.body.phones.map((p) => [p.id, p.works])).toEqual([["oc1", true], ["oc0", false]]);
  });

  it("removes the card from a phone", async () => {
    const revoke = chain({ data: [{ id: "oc1", device_name: "Pixel 9" }], error: null });
    mockSupabase.from.mockReturnValueOnce(revoke);
    const res = await request(buildApp()).delete("/api/cards/online/oc1");
    expect(res.status).toBe(200);
    expect(revoke.eq).toHaveBeenCalledWith("patient_id", "p1");
  });
});

describe("POST /api/cards/link/confirm", () => {
  const pending = (extra = {}) => ({
    patient_id: "p1", card_uid: "CCDD", attempts: 0,
    sent_at: new Date().toISOString(), expires_at: new Date(Date.now() + 600000).toISOString(), ...extra,
  });

  it("links the card when the code is right", async () => {
    const update = chain({ data: me({ card_uid: "CCDD" }), error: null });
    answers(
      { data: me(), error: null }, // patient
      { data: pending(), error: null }, // waiting request
      { data: null, error: null }, // card still free
      { data: null, error: null }, // never replaced
    );
    mockSupabase.from.mockReturnValueOnce(update);

    const res = await request(buildApp()).post("/api/cards/link/confirm").send({ code: "123 456" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ cardUid: "CCDD", status: "active", lostAt: null, onlineCard: null });
    expect(mockCode.check).toHaveBeenCalledWith("faiz@example.com", "123456");
    expect(update.update).toHaveBeenCalledWith(expect.objectContaining({ card_uid: "CCDD", card_status: "active" }));
  });

  it("retires the lost card it replaces", async () => {
    const retire = chain({ data: null, error: null });
    answers(
      { data: me({ card_uid: "AABB", card_status: "lost" }), error: null },
      { data: pending(), error: null },
      { data: null, error: null },
      { data: null, error: null },
    );
    mockSupabase.from.mockReturnValueOnce(retire);
    mockSupabase.from.mockReturnValueOnce(chain({ data: me({ card_uid: "CCDD" }), error: null }));

    const res = await request(buildApp()).post("/api/cards/link/confirm").send({ code: "123456" });

    expect(res.status).toBe(200);
    expect(retire.upsert).toHaveBeenCalledWith(expect.objectContaining({ card_uid: "AABB", patient_id: "p1" }));
  });

  it("counts a wrong code and says how many tries are left", async () => {
    mockCode.check.mockResolvedValue(false);
    const update = chain({ data: null, error: null });
    answers({ data: me(), error: null }, { data: pending({ attempts: 1 }), error: null });
    mockSupabase.from.mockReturnValueOnce(update);

    const res = await request(buildApp()).post("/api/cards/link/confirm").send({ code: "000000" });

    expect(res.status).toBe(400);
    expect(res.body.attemptsLeft).toBe(MAX_ATTEMPTS - 2);
    expect(update.update).toHaveBeenCalledWith({ attempts: 2 });
  });

  it("cancels after too many wrong codes", async () => {
    mockCode.check.mockResolvedValue(false);
    answers({ data: me(), error: null }, { data: pending({ attempts: MAX_ATTEMPTS - 1 }), error: null });
    const res = await request(buildApp()).post("/api/cards/link/confirm").send({ code: "000000" });
    expect(res.status).toBe(410);
  });

  it("refuses an expired code without checking it", async () => {
    answers({ data: me(), error: null }, { data: pending({ expires_at: new Date(Date.now() - 1000).toISOString() }), error: null });
    const res = await request(buildApp()).post("/api/cards/link/confirm").send({ code: "123456" });
    expect(res.status).toBe(410);
    expect(mockCode.check).not.toHaveBeenCalled();
  });

  it("asks for a new tap when nothing is waiting", async () => {
    answers({ data: me(), error: null }, { data: null, error: null });
    const res = await request(buildApp()).post("/api/cards/link/confirm").send({ code: "123456" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("no-request");
  });
});

describe("POST /api/cards/lost and /found", () => {
  it("lets a patient report their own card lost", async () => {
    const update = chain({ data: me({ card_uid: "AABB", card_status: "lost", card_lost_at: "2026-11-26T10:00:00Z" }), error: null });
    answers({ data: me({ card_uid: "AABB" }), error: null });
    mockSupabase.from.mockReturnValueOnce(update);

    const res = await request(buildApp()).post("/api/cards/lost").send({ patientId: "someone-else" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("lost");
    expect(update.eq).toHaveBeenCalledWith("id", "p1"); // their own, whatever patientId says
  });

  it("lets an admin report a patient's card lost", async () => {
    currentUser = { uid: "a1", role: "admin", name: "Admin" };
    const update = chain({ data: me({ id: "p7", card_uid: "AABB", card_status: "lost" }), error: null });
    answers({ data: me({ id: "p7", card_uid: "AABB" }), error: null });
    mockSupabase.from.mockReturnValueOnce(update);

    const res = await request(buildApp()).post("/api/cards/lost").send({ patientId: "p7" });

    expect(res.status).toBe(200);
    expect(update.eq).toHaveBeenCalledWith("id", "p7");
  });

  it("has nothing to report without a card", async () => {
    answers({ data: me(), error: null });
    const res = await request(buildApp()).post("/api/cards/lost").send({});
    expect(res.status).toBe(400);
  });

  it("does not let doctors report cards", async () => {
    currentUser = { uid: "d1", role: "doctor", name: "Dr. Sarah" };
    const res = await request(buildApp()).post("/api/cards/lost").send({ patientId: "p1" });
    expect(res.status).toBe(403);
  });

  it("marks a found card active again", async () => {
    const update = chain({ data: me({ card_uid: "AABB" }), error: null });
    answers({ data: me({ card_uid: "AABB", card_status: "lost" }), error: null });
    mockSupabase.from.mockReturnValueOnce(update);

    const res = await request(buildApp()).post("/api/cards/found").send({});

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("active");
    expect(update.update).toHaveBeenCalledWith(expect.objectContaining({ card_status: "active", card_lost_at: null }));
  });
});
