import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Copy server/.env.example to server/.env and fill them in."
  );
}

// Service-role client: bypasses Row Level Security entirely. This is the only
// client the backend uses -- all authorization is enforced in our own route
// handlers (requireAuth / requireRole), not by RLS.
export const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export const LAB_RESULTS_BUCKET = "lab-results";
export const RADIOLOGY_BUCKET = "radiology";

export async function ensureStorageBuckets() {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) throw error;

  const existing = new Set(buckets.map((b) => b.name));
  for (const bucket of [LAB_RESULTS_BUCKET, RADIOLOGY_BUCKET]) {
    if (!existing.has(bucket)) {
      const { error: createError } = await supabase.storage.createBucket(bucket, {
        public: false,
      });
      if (createError) throw createError;
      console.log(`Created Supabase Storage bucket: ${bucket}`);
    }
  }
}
