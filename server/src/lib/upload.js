import { supabase } from "./supabase.js";

// Buckets are created public (see ensureStorageBuckets) for simplicity, matching
// this FYP's original Firebase Storage download-URL behavior. For a real
// deployment with sensitive clinical files, switch to private buckets and
// generate short-lived signed URLs per request instead.
export async function uploadBuffer(bucket, buffer, destPath, contentType) {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(destPath, buffer, { contentType, upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(destPath);
  return data.publicUrl;
}
