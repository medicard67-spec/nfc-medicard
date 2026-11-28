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

const { default: queueRouter } = await import("../src/routes/queue.js");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/queue", queueRouter);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { uid: "admin1", role: "admin", name: "System Administrator", email: "admin@medicard.dev" };
});

describe("POST /api/queue", () => {
  it("rejects a doctor (admin-only)", async () => {
    currentUser = { uid: "doctor1", role: "doctor", name: "Dr. Sarah Jenkins", email: "doctor@medicard.dev" };

    const res = await request(buildApp()).post("/api/queue").send({ patientId: "p1", room: "Room 3" });

    expect(res.status).toBe(403);
  });

  it("rejects when patientId or room is missing", async () => {
    const res = await request(buildApp()).post("/api/queue").send({ patientId: "p1" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it("rejects when the patient doesn't exist", async () => {
    mockSupabase.from.mockReturnValueOnce(chain({ data: null, error: null }));

    const res = await request(buildApp()).post("/api/queue").send({ patientId: "p1", room: "Room 3" });

    expect(res.status).toBe(404);
  });

  it("assigns the next sequential number for today and returns the ticket", async () => {
    mockSupabase.from.mockReturnValueOnce(chain({ data: { id: "p1", name: "Ahmad Faiz" }, error: null })); // patient lookup
    mockSupabase.from.mockReturnValueOnce(chain({ data: null, error: null })); // no open ticket today
    mockSupabase.from.mockReturnValueOnce(chain({ data: { number: 4 }, error: null })); // highest number today
    mockSupabase.from.mockReturnValueOnce(
      chain({
        data: { id: "t1", patient_id: "p1", patient_name: "Ahmad Faiz", number: 5, room: "Room 3", checked_in_by: "System Administrator", created_at: new Date().toISOString() },
        error: null,
      })
    ); // insert

    const res = await request(buildApp()).post("/api/queue").send({ patientId: "p1", room: "Room 3" });

    expect(res.status).toBe(201);
    expect(res.body.number).toBe(5);
    expect(res.body.room).toBe("Room 3");
    expect(res.body.patientName).toBe("Ahmad Faiz");
  });

  it("doesn't give a patient a second ticket on the same day", async () => {
    mockSupabase.from.mockReturnValueOnce(chain({ data: { id: "p1", name: "Ahmad Faiz" }, error: null }));
    mockSupabase.from.mockReturnValueOnce(
      chain({ data: { id: "t1", patient_id: "p1", patient_name: "Ahmad Faiz", number: 3, room: "Room 2", status: "waiting" }, error: null })
    );

    const res = await request(buildApp()).post("/api/queue").send({ patientId: "p1", room: "Room 3" });

    expect(res.status).toBe(200);
    expect(res.body.number).toBe(3);
    expect(res.body.alreadyCheckedIn).toBe(true);
  });

  it("moves a ticket to the next number when two check-ins pick the same one", async () => {
    const mine = { id: "t2", patient_id: "p1", patient_name: "Ahmad Faiz", number: 5, room: "Room 3", created_at: "2026-11-29T02:00:01.000Z" };
    mockSupabase.from.mockReturnValueOnce(chain({ data: { id: "p1", name: "Ahmad Faiz" }, error: null }));
    mockSupabase.from.mockReturnValueOnce(chain({ data: null, error: null })); // no open ticket
    mockSupabase.from.mockReturnValueOnce(chain({ data: { number: 4 }, error: null })); // highest -> 5
    mockSupabase.from.mockReturnValueOnce(chain({ data: mine, error: null })); // insert as #5
    mockSupabase.from.mockReturnValueOnce(chain({ data: [{ id: "t1", created_at: "2026-11-29T02:00:00.000Z" }], error: null })); // someone else got #5 first
    const moveQ = chain({ data: { ...mine, number: 6 }, error: null });
    mockSupabase.from.mockReturnValueOnce(moveQ); // update
    mockSupabase.from.mockReturnValueOnce(chain({ data: { number: 5 }, error: null })); // highest -> 6

    const res = await request(buildApp()).post("/api/queue").send({ patientId: "p1", room: "Room 3" });

    expect(res.status).toBe(201);
    expect(res.body.number).toBe(6);
    expect(moveQ.update).toHaveBeenCalledWith({ number: 6 });
  });
});

describe("GET /api/queue", () => {
  it("rejects a patient", async () => {
    currentUser = { uid: "p1", role: "patient", name: "Ahmad Faiz", email: "patient@medicard.dev" };

    const res = await request(buildApp()).get("/api/queue");

    expect(res.status).toBe(403);
  });

  it("lists today's tickets", async () => {
    mockSupabase.from.mockReturnValueOnce(
      chain({ data: [{ id: "t1", patient_id: "p1", patient_name: "Ahmad Faiz", number: 1, room: "Room 1", checked_in_by: "Admin", created_at: new Date().toISOString() }], error: null })
    );

    const res = await request(buildApp()).get("/api/queue");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].number).toBe(1);
  });
});

describe("GET /api/queue/mine", () => {
  it("rejects an admin", async () => {
    const res = await request(buildApp()).get("/api/queue/mine");

    expect(res.status).toBe(403);
  });

  it("returns null when the patient hasn't checked in today", async () => {
    currentUser = { uid: "p1", role: "patient", name: "Ahmad Faiz", email: "patient@medicard.dev" };
    mockSupabase.from.mockReturnValueOnce(chain({ data: null, error: null }));

    const res = await request(buildApp()).get("/api/queue/mine");

    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  it("returns the patient's own ticket for today", async () => {
    currentUser = { uid: "p1", role: "patient", name: "Ahmad Faiz", email: "patient@medicard.dev" };
    mockSupabase.from.mockReturnValueOnce(
      chain({ data: { id: "t1", patient_id: "p1", patient_name: "Ahmad Faiz", number: 3, room: "Room 2", checked_in_by: "Admin", created_at: new Date().toISOString() }, error: null })
    );

    const res = await request(buildApp()).get("/api/queue/mine");

    expect(res.status).toBe(200);
    expect(res.body.number).toBe(3);
    expect(res.body.room).toBe("Room 2");
  });
});

describe("PATCH /api/queue/:id/call", () => {
  const ticket = { id: "t1", patient_id: "p1", patient_name: "Ahmad Faiz", number: 7, room: "Room 3", status: "waiting", created_at: new Date().toISOString() };

  it("rejects a patient calling themselves in", async () => {
    currentUser = { uid: "p1", role: "patient", name: "Ahmad Faiz", email: "patient@medicard.dev" };
    const res = await request(buildApp()).patch("/api/queue/t1/call");
    expect(res.status).toBe(403);
  });

  it("calls the patient in, tells them it's their turn, and tells the next person they're next", async () => {
    const made = [];
    mockSupabase.from.mockImplementation((table) => {
      let result = { data: null, error: null };
      if (table === "queue_tickets") {
        const n = made.filter((m) => m.table === "queue_tickets").length;
        result = [
          { data: ticket, error: null },
          { data: { ...ticket, status: "called", called_at: new Date().toISOString(), called_by: "System Administrator" }, error: null },
          { data: { ...ticket, id: "t2", patient_id: "p2", number: 8 }, error: null },
        ][n];
      }
      const q = chain(result);
      made.push({ table, q });
      return q;
    });

    const res = await request(buildApp()).patch("/api/queue/t1/call");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("called");
    const sent = made.filter((m) => m.table === "notifications").flatMap((m) => [...m.q.insert.mock.calls, ...m.q.upsert.mock.calls].map((c) => c[0][0]));
    expect(sent.map((r) => [r.user_id, r.type, r.data.room])).toEqual([["p1", "queue.called", "Room 3"], ["p2", "queue.next", "Room 3"]]);
    mockSupabase.from.mockReset();
  });

  it("won't call someone who has already been seen", async () => {
    mockSupabase.from.mockReturnValueOnce(chain({ data: { ...ticket, status: "done" }, error: null }));
    const res = await request(buildApp()).patch("/api/queue/t1/call");
    expect(res.status).toBe(400);
  });
});

describe("POST /api/queue/self (patient taps their own card)", () => {
  // answers per table, in the order the route asks
  function tables(map) {
    const made = [];
    mockSupabase.from.mockImplementation((table) => {
      const list = map[table] || [];
      const n = made.filter((m) => m.table === table).length;
      const q = chain(list[n] ?? { data: null, error: null });
      made.push({ table, q });
      return q;
    });
    return made;
  }
  const patient = { id: "p1", name: "Ahmad Faiz", card_uid: "AABB", card_status: "active" };

  beforeEach(() => {
    currentUser = { uid: "p1", role: "patient", name: "Ahmad Faiz", email: "faiz@example.com" };
  });

  it("checks in a patient with an appointment today, to that doctor", async () => {
    const made = tables({
      patients: [{ data: patient, error: null }],
      queue_tickets: [
        { data: null, error: null }, // no ticket yet today
        { data: { number: 6 }, error: null }, // highest number today
        { data: { id: "t9", patient_id: "p1", patient_name: "Ahmad Faiz", number: 7, room: "Dr. Sarah Jenkins", status: "waiting" }, error: null },
      ],
      appointments: [{ data: { id: "a1", doctor_name: "Dr. Sarah Jenkins", start_time: "10:00:00" }, error: null }],
    });

    const res = await request(buildApp()).post("/api/queue/self").send({ cardUid: "aa:bb" });

    expect(res.status).toBe(201);
    expect(res.body.number).toBe(7);
    const insert = made.filter((m) => m.table === "queue_tickets")[2].q.insert;
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ patient_id: "p1", number: 7, room: "Dr. Sarah Jenkins" }));
    mockSupabase.from.mockReset();
  });

  it("refuses without an appointment today", async () => {
    tables({ patients: [{ data: patient, error: null }] });
    const res = await request(buildApp()).post("/api/queue/self").send({ cardUid: "AABB" });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("no-appointment");
    mockSupabase.from.mockReset();
  });

  it("refuses someone else's card or a lost card", async () => {
    tables({ patients: [{ data: patient, error: null }, { data: { ...patient, card_status: "lost" }, error: null }] });
    const other = await request(buildApp()).post("/api/queue/self").send({ cardUid: "CCDD" });
    const lost = await request(buildApp()).post("/api/queue/self").send({ cardUid: "AABB" });
    expect(other.status).toBe(403);
    expect(lost.status).toBe(403);
    mockSupabase.from.mockReset();
  });

  it("returns today's ticket instead of a second one", async () => {
    tables({
      patients: [{ data: patient, error: null }],
      queue_tickets: [{ data: { id: "t3", patient_id: "p1", number: 3, room: "Room 1", status: "waiting" }, error: null }],
    });
    const res = await request(buildApp()).post("/api/queue/self").send({ cardUid: "AABB" });
    expect(res.status).toBe(200);
    expect(res.body.alreadyCheckedIn).toBe(true);
    expect(res.body.number).toBe(3);
    mockSupabase.from.mockReset();
  });

  it("is for patients only", async () => {
    currentUser = { uid: "admin1", role: "admin", name: "System Administrator" };
    const res = await request(buildApp()).post("/api/queue/self").send({ cardUid: "AABB" });
    expect(res.status).toBe(403);
  });
});
