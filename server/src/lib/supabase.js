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
export const AVATARS_BUCKET = "avatars";
export const MEDICAL_IMAGES_BUCKET = "medical-images";

export async function ensureStorageBuckets() {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) throw error;

  const byName = new Map(buckets.map((b) => [b.name, b]));
  for (const bucket of [LAB_RESULTS_BUCKET, RADIOLOGY_BUCKET, AVATARS_BUCKET, MEDICAL_IMAGES_BUCKET]) {
    const existing = byName.get(bucket);
    // Public so uploadBuffer()'s getPublicUrl() results actually resolve in
    // the browser -- the backend still gates who can upload via its own
    // requireAuth/requireRole checks, this only affects read access to files.
    if (!existing) {
      const { error: createError } = await supabase.storage.createBucket(bucket, {
        public: true,
      });
      if (createError) throw createError;
      console.log(`Created Supabase Storage bucket: ${bucket}`);
    } else if (!existing.public) {
      const { error: updateError } = await supabase.storage.updateBucket(bucket, { public: true });
      if (updateError) throw updateError;
      console.log(`Made existing Supabase Storage bucket public: ${bucket}`);
    }
  }
}
