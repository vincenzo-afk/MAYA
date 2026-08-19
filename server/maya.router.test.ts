import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  createMessage: vi.fn(),
  getDailyCheckIns: vi.fn(),
  getMemories: vi.fn(),
  getMoodLog: vi.fn(),
  getOrCreatePreferences: vi.fn(),
  getRecentMessages: vi.fn(),
  openDailyCheckIn: vi.fn(),
  saveGameSession: vi.fn(),
  saveYoutubeSession: vi.fn(),
  toggleMessageReaction: vi.fn(),
  updatePreferences: vi.fn(),
}));

vi.mock("./db", () => dbMocks);
vi.mock("./mayaBrain", () => ({ generateMayaReply: vi.fn() }));
vi.mock("./_core/imageGeneration", () => ({ generateImage: vi.fn() }));
vi.mock("./_core/voiceTranscription", () => ({ transcribeAudio: vi.fn() }));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function caller() {
  const ctx = {
    user: {
      id: 42,
      openId: "maya-test-user",
      name: "Aisha",
      email: "aisha@example.com",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} },
    res: { clearCookie: vi.fn() },
  } as unknown as TrpcContext;
  return appRouter.createCaller(ctx);
}

describe("Maya protected companion APIs", () => {
  beforeEach(() => vi.clearAllMocks());

  it("persists a sticker as an account-scoped activity message", async () => {
    const message = { id: 1, userId: 42, content: "Sticker: 🌷" };
    dbMocks.createMessage.mockResolvedValue(message);

    await expect(caller().maya.sendMedia({ type: "sticker", sticker: "🌷" })).resolves.toEqual(message);
    expect(dbMocks.createMessage).toHaveBeenCalledWith(expect.objectContaining({ userId: 42, role: "user", kind: "activity", content: "Sticker: 🌷" }));
  });

  it("passes reactions only through the current user's message scope", async () => {
    dbMocks.toggleMessageReaction.mockResolvedValue(["♥"]);

    await expect(caller().maya.setReaction({ messageId: 9, emoji: "♥" })).resolves.toEqual(["♥"]);
    expect(dbMocks.toggleMessageReaction).toHaveBeenCalledWith(42, 9, "♥");
  });

  it("saves a co-watch session against the signed-in user", async () => {
    dbMocks.saveYoutubeSession.mockResolvedValue(undefined);

    await caller().maya.saveYoutubeSession({ videoUrl: "https://www.youtube.com/watch?v=abc123", title: "A shared video", notes: "Talked about the music." });
    expect(dbMocks.saveYoutubeSession).toHaveBeenCalledWith(42, "https://www.youtube.com/watch?v=abc123", "A shared video", "Talked about the music.");
  });

  it("accepts and scopes the expanded companion-game sessions to the signed-in user", async () => {
    dbMocks.saveGameSession.mockResolvedValue(undefined);

    await caller().maya.saveGameSession({ gameType: "ludo", state: { user: [0, -1, -1, -1], maya: [-1, -1, -1, -1] }, result: "in-progress" });
    await caller().maya.saveGameSession({ gameType: "connectFour", state: { board: [] } });
    await caller().maya.saveGameSession({ gameType: "game2048", state: { board: [], score: 0 } });

    expect(dbMocks.saveGameSession).toHaveBeenNthCalledWith(1, 42, "ludo", expect.objectContaining({ user: [0, -1, -1, -1] }), "in-progress");
    expect(dbMocks.saveGameSession).toHaveBeenNthCalledWith(2, 42, "connectFour", { board: [] }, undefined);
    expect(dbMocks.saveGameSession).toHaveBeenNthCalledWith(3, 42, "game2048", { board: [], score: 0 }, undefined);
  });

  it("rejects unsupported game-session types before attempting a save", async () => {
    await expect(caller().maya.saveGameSession({ gameType: "unknown-game" as "ludo", state: {} })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(dbMocks.saveGameSession).not.toHaveBeenCalled();
  });

  it("opens a persisted daily check-in using the supplied date", async () => {
    dbMocks.openDailyCheckIn.mockResolvedValue({ created: true, checkIn: { id: 3, checkInDate: "2026-08-19" } });

    await expect(caller().maya.openDailyCheckIn({ checkInDate: "2026-08-19" })).resolves.toMatchObject({ created: true });
    expect(dbMocks.openDailyCheckIn).toHaveBeenCalledWith(42, "2026-08-19");
  });
});
