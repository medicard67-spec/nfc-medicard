import { supabase, PRIVATE_BUCKETS } from "./supabase.js";

// Storage keys only allow plain letters, digits and a few symbols, so a file
// called "résultat [final].pdf" or "化验.png" would be refused. The stored key
// uses a cleaned-up name; the original name is still saved in the database.
export function safeFileName(name) {
  const cleaned = String(name || "file")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // accents: e-acute -> e
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/-+\./g, ".")
    .replace(/^[-.]+|-+$/g, "");
  return (cleaned || "file").slice(-100);
}

// The browser sends the file name as UTF-8 but the upload library reads it as
// Latin-1, which turns "résultat.pdf" into "rÃ©sultat.pdf". This undoes that.
export function fileNameOf(file) {
  const name = file?.originalname || "file";
  const fixed = Buffer.from(name, "latin1").toString("utf8");
  return fixed.includes("�") ? name : fixed;
}

// Uploads a file and returns its storage URL. Files in the private buckets
// (lab results, radiology, history images) can't be opened with this URL on
// its own: signFileUrls() turns it into a short-lived link when it is read.
export async function uploadBuffer(bucket, buffer, destPath, contentType) {
  const parts = destPath.split("/");
  parts[parts.length - 1] = safeFileName(parts[parts.length - 1]);
  const key = parts.join("/");
  const { error } = await supabase.storage
    .from(bucket)
    .upload(key, buffer, { contentType, upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(key);
  return data.publicUrl;
}

const SIGNED_SECONDS = 60 * 60; // links work for an hour

// "https://<project>/storage/v1/object/public/<bucket>/<key>" -> { bucket, key }
function parseStorageUrl(url) {
  const m = /\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/([^?]+)/.exec(url || "");
  return m && PRIVATE_BUCKETS.includes(m[1]) ? { bucket: m[1], key: decodeURIComponent(m[2]) } : null;
}

// Swaps stored URLs of private files for signed links that expire. Anything
// else (avatars, outside links, empty values) comes back unchanged.
export async function signFileUrls(urls) {
  const out = [...urls];
  const byBucket = new Map();
  out.forEach((url, i) => {
    const p = parseStorageUrl(url);
    if (!p) return;
    if (!byBucket.has(p.bucket)) byBucket.set(p.bucket, []);
    byBucket.get(p.bucket).push({ i, key: p.key });
  });
  for (const [bucket, items] of byBucket) {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrls(items.map((x) => x.key), SIGNED_SECONDS);
      if (error || !data) continue;
      data.forEach((d, n) => {
        if (d?.signedUrl) out[items[n].i] = d.signedUrl;
      });
    } catch (err) {
      console.error("Could not sign file links:", err.message);
    }
  }
  return out;
}

export async function signFileUrl(url) {
  return url ? (await signFileUrls([url]))[0] : url;
}
