import { vi } from "vitest";

// Builds a chainable object mimicking the Supabase JS query builder. Every
// chain method (select/eq/order/etc.) returns the same object, and the
// object itself is thenable so `await` resolves at any point in the chain
// (matching how supabase-js query builders work) to the given result.
export function chain(result) {
  const obj = {};
  const methods = [
    "select", "insert", "update", "delete", "upsert", "eq", "neq", "or",
    "order", "limit", "single", "maybeSingle",
  ];
  methods.forEach((m) => {
    obj[m] = vi.fn(() => obj);
  });
  obj.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return obj;
}

// tableResults: { [tableName]: { data, error, count? } }
export function createSupabaseMock(tableResults = {}) {
  const from = vi.fn((table) => chain(tableResults[table] ?? { data: null, error: null }));
  return {
    from,
    auth: {
      getUser: vi.fn(),
      resend: vi.fn(() => Promise.resolve({ data: {}, error: null })),
      admin: {
        createUser: vi.fn(),
        listUsers: vi.fn(),
      },
    },
    storage: {
      listBuckets: vi.fn(() => Promise.resolve({ data: [], error: null })),
      createBucket: vi.fn(() => Promise.resolve({ error: null })),
      from: vi.fn(() => ({
        upload: vi.fn(() => Promise.resolve({ error: null })),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: "https://example.com/file" } })),
      })),
    },
  };
}
