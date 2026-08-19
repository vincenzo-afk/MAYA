import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("Groq LLM adapter", () => {
  it("uses Groq with a conversational model for streamed Maya replies", async () => {
    vi.stubEnv("GROQ_API_KEY", "gsk_test_only");
    vi.stubEnv("BUILT_IN_FORGE_API_KEY", "");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("data: [DONE]\n\n", { status: 200 }));
    const { invokeLLMStream } = await import("./_core/llm");

    await invokeLLMStream({ messages: [{ role: "user", content: "Hi Maya" }] });

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.groq.com/openai/v1/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: "Bearer gsk_test_only" }),
      })
    );
    expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))).toMatchObject({
      model: "llama-3.3-70b-versatile",
      stream: true,
    });
  });

  it("uses Groq’s strict structured-output model for Maya emotion and memory extraction", async () => {
    vi.stubEnv("GROQ_API_KEY", "gsk_test_only");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ choices: [] }), { status: 200 }));
    const { invokeLLM } = await import("./_core/llm");

    await invokeLLM({
      messages: [{ role: "user", content: "Remember that I like chess" }],
      response_format: {
        type: "json_schema",
        json_schema: { name: "memory", strict: true, schema: { type: "object", properties: {}, required: [], additionalProperties: false } },
      },
    });

    expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))).toMatchObject({ model: "openai/gpt-oss-20b" });
  });
});
