import { afterEach, describe, expect, it, vi } from "vitest";

const envBackup = { ...process.env };

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Supabase server configuration", () => {
  it("requires a server-only key instead of accepting the publishable key", async () => {
    vi.stubEnv("SUPABASE_URL", "https://maya.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "");

    const { resolveSupabaseServerConfig } = await import("./supabaseConfig");
    expect(() => resolveSupabaseServerConfig()).toThrow("Supabase server connection is not configured");
  });

  it("accepts a secure HTTPS project URL and dedicated server key", async () => {
    vi.stubEnv("SUPABASE_URL", "https://maya.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_test_only");

    const { resolveSupabaseServerConfig } = await import("./supabaseConfig");
    expect(resolveSupabaseServerConfig()).toEqual({
      url: "https://maya.supabase.co",
      secretKey: "sb_secret_test_only",
    });
  });

  it("rejects non-HTTPS database endpoints", async () => {
    vi.stubEnv("SUPABASE_URL", "http://maya.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_test_only");

    const { resolveSupabaseServerConfig } = await import("./supabaseConfig");
    expect(() => resolveSupabaseServerConfig()).toThrow("Supabase URL is invalid");
  });
});
