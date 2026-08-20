import { describe, expect, it } from "vitest";
import { CONNECTION_PROMPTS, buildLittleWinMessage, pickConnectionPrompt } from "../client/src/lib/mayaConnectionUtils";

describe("Maya Connection helpers", () => {
  it("creates a bounded, natural little-win message without retaining extra whitespace", () => {
    expect(buildLittleWinMessage("  I finished my walk  ")).toBe("I want to share a small win: I finished my walk. Celebrate it naturally — warm but not over the top, and ask one follow-up only if it fits.");
  });

  it("chooses a valid prompt deterministically at the lower and upper bounds", () => {
    expect(pickConnectionPrompt(() => 0)).toBe(CONNECTION_PROMPTS[0]);
    expect(pickConnectionPrompt(() => 0.999999)).toBe(CONNECTION_PROMPTS[CONNECTION_PROMPTS.length - 1]);
  });
});
