import { describe, expect, it } from "vitest";
import { displayNameForEmail, normalizeEmail } from "./_core/emailAuth";

describe("Maya email verification helpers", () => {
  it("normalizes email addresses before sending or provisioning a session", () => {
    expect(normalizeEmail("  Maya.User+Home@Example.COM ")).toBe("maya.user+home@example.com");
    expect(normalizeEmail(null)).toBe("");
  });

  it("derives a friendly fallback name without treating email as a login provider choice", () => {
    expect(displayNameForEmail("maya.user@example.com")).toBe("Maya User");
  });
});
