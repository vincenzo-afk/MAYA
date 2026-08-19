import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type SupabaseServerConfig = {
  url: string;
  secretKey: string;
};

export function resolveSupabaseServerConfig(env: NodeJS.ProcessEnv = process.env): SupabaseServerConfig {
  const url = env.SUPABASE_URL?.trim();
  const secretKey = env.SUPABASE_SECRET_KEY?.trim();

  if (!url || !secretKey) {
    throw new Error("Maya's Supabase server connection is not configured.");
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      throw new Error("Supabase URL must use HTTPS.");
    }
  } catch {
    throw new Error("Maya's Supabase URL is invalid.");
  }

  return { url, secretKey };
}

let client: SupabaseClient | null = null;

/**
 * Creates a server-only client. The secret key must never be imported by browser code.
 * Per-user filtering remains enforced in every database helper below this boundary.
 */
export function getSupabaseServerClient(): SupabaseClient {
  if (!client) {
    const { url, secretKey } = resolveSupabaseServerConfig();
    client = createClient(url, secretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
  }

  return client;
}

export function resetSupabaseServerClientForTests() {
  client = null;
}
