// The first configured CLIENT_ORIGIN is where email confirmation links should
// redirect back to. Must also be added to the Supabase project's
// Authentication -> URL Configuration -> Redirect URLs allow list, or
// Supabase will ignore emailRedirectTo and fall back to the project's Site
// URL instead.
export function getClientOrigin() {
  return (process.env.CLIENT_ORIGIN || "http://localhost:5173").split(",")[0].trim();
}
