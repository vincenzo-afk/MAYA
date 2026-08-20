import { createClient } from "@supabase/supabase-js";

function getClient() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Email verification is not configured yet.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: true } });
}

export async function completeEmailVerificationFromUrl() {
  const client = getClient();
  const { data } = await client.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) return false;
  const response = await fetch("/api/auth/complete-email-verification", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ accessToken }),
  });
  if (!response.ok) throw new Error("That email verification link has expired. Request a new one.");
  window.history.replaceState({}, document.title, window.location.pathname);
  return true;
}
