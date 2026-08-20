import { afterEach, describe, expect, it, vi } from "vitest";

const { upload, createSignedUrl, from, getSupabaseServerClient } = vi.hoisted(() => {
  const upload = vi.fn();
  const createSignedUrl = vi.fn();
  const from = vi.fn(() => ({ upload, createSignedUrl }));
  const getSupabaseServerClient = vi.fn(() => ({ storage: { from } }));
  return { upload, createSignedUrl, from, getSupabaseServerClient };
});

vi.mock("./supabaseConfig", () => ({ getSupabaseServerClient }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
  upload.mockReset();
  createSignedUrl.mockReset();
  from.mockClear();
});

describe("Maya external media adapters", () => {
  it("stores private voice media in the Supabase bucket behind a protected app URL", async () => {
    upload.mockResolvedValue({ error: null });
    const { storagePut } = await import("./storage");
    const stored = await storagePut("maya/user/voice/note.webm", new Uint8Array([1, 2]), "audio/webm");

    expect(from).toHaveBeenCalledWith("maya-media");
    expect(upload).toHaveBeenCalledWith(expect.stringMatching(/^maya\/user\/voice\/note_[a-f0-9]{8}\.webm$/), expect.any(Blob), expect.objectContaining({ contentType: "audio/webm", upsert: false }));
    expect(stored.url).toMatch(/^\/manus-storage\/maya\/user\/voice\/note_[a-f0-9]{8}\.webm$/);
  });

  it("uses the configured Groq Whisper endpoint without downloading already-uploaded audio", async () => {
    vi.stubEnv("GROQ_API_KEY", "gsk_test_only");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ task: "transcribe", language: "en", duration: 1, text: "hello Maya", segments: [] }), { status: 200 }));
    const { transcribeAudio } = await import("./_core/voiceTranscription");
    const result = await transcribeAudio({ audioData: new Uint8Array([1, 2, 3]), fileName: "note.webm", mimeType: "audio/webm", language: "en" });

    expect(fetchSpy).toHaveBeenCalledWith("https://api.groq.com/openai/v1/audio/transcriptions", expect.objectContaining({ headers: expect.objectContaining({ authorization: "Bearer gsk_test_only" }) }));
    const body = fetchSpy.mock.calls[0][1]?.body as FormData;
    expect(body.get("model")).toBe("whisper-large-v3-turbo");
    expect("text" in result && result.text).toBe("hello Maya");
  });
});
