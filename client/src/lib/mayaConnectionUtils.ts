export const CONNECTION_PROMPTS = [
  "Ask me one unexpectedly good this-or-that question, then tell me your pick.",
  "Give me a tiny reset for this moment — nothing preachy, just something I can actually do.",
  "Ask me a thoughtful question that makes an ordinary day feel a little more interesting.",
  "Let’s make a two-minute plan for the rest of my day. Keep it simple.",
] as const;

export function buildLittleWinMessage(win: string) {
  return `I want to share a small win: ${win.trim()}. Celebrate it naturally — warm but not over the top, and ask one follow-up only if it fits.`;
}

export function pickConnectionPrompt(random: () => number = Math.random) {
  const index = Math.min(CONNECTION_PROMPTS.length - 1, Math.max(0, Math.floor(random() * CONNECTION_PROMPTS.length)));
  return CONNECTION_PROMPTS[index];
}
