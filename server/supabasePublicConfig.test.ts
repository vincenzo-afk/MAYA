import { describe, expect, it } from "vitest";

const runExternalCheck = process.env.RUN_EXTERNAL_CREDENTIAL_CHECKS === "true";

describe("Supabase public browser configuration", () => {
  it.runIf(runExternalCheck)("accepts the configured project URL and publishable key", async () => {
    const url = process.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
    const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    expect(url).toMatch(/^https:\/\/.+\.supabase\.co$/);
    expect(publishableKey).toMatch(/^sb_publishable_/);

    const response = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: publishableKey! },
    });

    expect(response.ok).toBe(true);
  });
});
