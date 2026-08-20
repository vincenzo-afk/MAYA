import { describe, expect, it, vi } from "vitest";

vi.mock("./_core/llm", () => ({ invokeLLM: vi.fn(), invokeLLMStream: vi.fn() }));
vi.mock("./db", () => ({
  createMemory: vi.fn(),
  createMessage: vi.fn(),
  getMemories: vi.fn().mockResolvedValue([]),
  getOrCreateRelationship: vi.fn().mockResolvedValue({ rapportScore: 14, preferredTone: "warm", recurringMood: null, lastMeaningfulTopic: null }),
  getRecentMessages: vi.fn().mockResolvedValue([]),
  saveMood: vi.fn(),
  updateRelationship: vi.fn(),
}));

import { invokeLLMStream } from "./_core/llm";
import { extractStreamMemories, inferStreamEmotion, MAYA_STREAM_SYSTEM_PROMPT, streamMayaReply } from "./mayaBrain";

describe("Maya's emotional response helpers", () => {
  it("responds with care to language that needs gentleness", () => {
    expect(inferStreamEmotion("I feel lonely and overwhelmed today")).toMatchObject({ label: "caring", intensity: 4, userMood: "needs gentleness" });
  });

  it("recognizes playful invitations", () => {
    expect(inferStreamEmotion("Let's play a fun game, Maya")).toMatchObject({ label: "playful", userMood: "playful" });
  });

  it("handles negation before saving a negative emotional signal", () => {
    expect(inferStreamEmotion("I'm not sad today, just quiet.")).toMatchObject({ label: "curious", userMood: "checking in" });
  });

  it("distinguishes frustration, affection, and pride", () => {
    expect(inferStreamEmotion("I'm so frustrated with this assignment")).toMatchObject({ label: "frustrated", userMood: "frustrated" });
    expect(inferStreamEmotion("I love you, that was really sweet")).toMatchObject({ label: "affectionate", userMood: "affectionate" });
    expect(inferStreamEmotion("I passed my exam today!")).toMatchObject({ label: "proud", userMood: "proud" });
  });

  it("keeps the streaming persona natural and bounded", () => {
    expect(MAYA_STREAM_SYSTEM_PROMPT).toContain("Ask at most one open, useful follow-up");
    expect(MAYA_STREAM_SYSTEM_PROMPT).toContain("Never pressure the user to depend on you");
    expect(MAYA_STREAM_SYSTEM_PROMPT).toContain("markdown");
  });
});

describe("Maya's durable-memory extraction", () => {
  it("extracts an explicit name, preference, and birthday without inventing facts", () => {
    const memories = extractStreamMemories("My name is Aisha. I love masala chai. My birthday is 14 June.");
    expect(memories).toEqual(expect.arrayContaining([
      expect.objectContaining({ topic: "name", detail: "The user's name is Aisha." }),
      expect.objectContaining({ category: "preference", detail: "The user love masala chai." }),
      expect.objectContaining({ topic: "birthday", detail: "The user's birthday is 14 June." }),
    ]));
  });

  it("caps memory candidates at three records", () => {
    expect(extractStreamMemories("My name is Arya. I like music. My birthday is Friday.")).toHaveLength(3);
  });
});

describe("Maya's streamed replies", () => {
  it("emits each streamed token and returns the completed reply", async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hi "}}]}\n\n'));
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"there"}}]}\n\n'));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });
    vi.mocked(invokeLLMStream).mockResolvedValue({ body } as Response);
    const deltas: string[] = [];
    await expect(streamMayaReply(1, { content: "hello", kind: "text" }, (delta) => deltas.push(delta))).resolves.toBe("Hi there");
    expect(deltas).toEqual(["Hi ", "there"]);
  });

  it("gives the caller a clear error when an upstream stream is unavailable", async () => {
    vi.mocked(invokeLLMStream).mockResolvedValue({ body: null } as Response);
    await expect(streamMayaReply(1, { content: "hello", kind: "text" }, vi.fn())).rejects.toThrow("response stream was unavailable");
  });
});
