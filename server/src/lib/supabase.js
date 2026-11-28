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

// Medical files are private: they are only shown through short-lived signed
// links handed out by the API to people allowed to see that patient.
// Profile pictures stay public.
export const PRIVATE_BUCKETS = [LAB_RESULTS_BUCKET, RADIOLOGY_BUCKET, MEDICAL_IMAGES_BUCKET];

export async function ensureStorageBuckets() {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) throw error;

  const byName = new Map(buckets.map((b) => [b.name, b]));
  for (const bucket of [LAB_RESULTS_BUCKET, RADIOLOGY_BUCKET, AVATARS_BUCKET, MEDICAL_IMAGES_BUCKET]) {
    const existing = byName.get(bucket);
    const isPublic = !PRIVATE_BUCKETS.includes(bucket);
    if (!existing) {
      const { error: createError } = await supabase.storage.createBucket(bucket, { public: isPublic });
      if (createError) throw createError;
      console.log(`Created Supabase Storage bucket: ${bucket} (${isPublic ? "public" : "private"})`);
    } else if (Boolean(existing.public) !== isPublic) {
      const { error: updateError } = await supabase.storage.updateBucket(bucket, { public: isPublic });
      if (updateError) throw updateError;
      console.log(`Made Supabase Storage bucket ${isPublic ? "public" : "private"}: ${bucket}`);
    }
  }
}
