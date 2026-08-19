import { describe, expect, it } from "vitest";

const runLiveCredentialCheck = process.env.RUN_EXTERNAL_CREDENTIAL_CHECK === "1";

describe("external production credentials", () => {
  it.runIf(runLiveCredentialCheck)("authenticates the configured Groq and Supabase server integrations", async () => {
    const groqKey = process.env.GROQ_API_KEY;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

    expect(groqKey, "GROQ_API_KEY must be configured").toBeTruthy();
    expect(supabaseUrl, "SUPABASE_URL must be configured").toMatch(/^https:\/\//);
    expect(supabaseSecretKey, "SUPABASE_SECRET_KEY must be configured").toBeTruthy();

    const [groqResponse, supabaseResponse] = await Promise.all([
      fetch("https://api.groq.com/openai/v1/models", {
        headers: { Authorization: `Bearer ${groqKey}` },
      }),
      fetch(`${supabaseUrl}/auth/v1/settings`, {
        headers: { apikey: supabaseSecretKey! },
      }),
    ]);

    expect(groqResponse.ok, `Groq credential verification returned ${groqResponse.status}`).toBe(true);
    expect(supabaseResponse.ok, `Supabase credential verification returned ${supabaseResponse.status}`).toBe(true);
  }, 15_000);
});
