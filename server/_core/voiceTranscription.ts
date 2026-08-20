import { ENV } from "./env";

export type TranscribeOptions = {
  audioData?: Buffer | Uint8Array;
  audioUrl?: string;
  fileName?: string;
  mimeType?: string;
  language?: string;
  prompt?: string;
};

export type WhisperSegment = {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
};

export type WhisperResponse = {
  task: "transcribe";
  language: string;
  duration: number;
  text: string;
  segments: WhisperSegment[];
};

export type TranscriptionResponse = WhisperResponse;

export type TranscriptionError = {
  error: string;
  code: "FILE_TOO_LARGE" | "INVALID_FORMAT" | "TRANSCRIPTION_FAILED" | "UPLOAD_FAILED" | "SERVICE_ERROR";
  details?: string;
};

async function resolveAudio(options: TranscribeOptions): Promise<{ bytes: Uint8Array; mimeType: string } | TranscriptionError> {
  if (options.audioData) return { bytes: new Uint8Array(options.audioData), mimeType: options.mimeType ?? "audio/webm" };
  if (!options.audioUrl) return { error: "No audio was provided", code: "INVALID_FORMAT" };

  try {
    const response = await fetch(options.audioUrl);
    if (!response.ok) return { error: "Failed to download audio file", code: "INVALID_FORMAT", details: `HTTP ${response.status}: ${response.statusText}` };
    return { bytes: new Uint8Array(await response.arrayBuffer()), mimeType: response.headers.get("content-type") || "audio/mpeg" };
  } catch (error) {
    return { error: "Failed to fetch audio file", code: "SERVICE_ERROR", details: error instanceof Error ? error.message : "Unknown error" };
  }
}

function getFileExtension(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    "audio/webm": "webm", "audio/mp3": "mp3", "audio/mpeg": "mp3", "audio/wav": "wav",
    "audio/wave": "wav", "audio/ogg": "ogg", "audio/m4a": "m4a", "audio/mp4": "m4a",
  };
  return mimeToExt[mimeType] || "audio";
}

function promptFor(options: TranscribeOptions) {
  return options.prompt || (options.language
    ? `Transcribe the user's voice to text. The user's working language is ${options.language}.`
    : "Transcribe the user's voice to text.");
}

/** Uses Groq Whisper in external production and retains the managed service only as a local fallback. */
export async function transcribeAudio(options: TranscribeOptions): Promise<TranscriptionResponse | TranscriptionError> {
  try {
    const audio = await resolveAudio(options);
    if ("error" in audio) return audio;
    if (audio.bytes.byteLength > 16 * 1024 * 1024) return { error: "Audio file exceeds maximum size limit", code: "FILE_TOO_LARGE" };

    const formData = new FormData();
    const blobBytes = new Uint8Array(audio.bytes.byteLength);
    blobBytes.set(audio.bytes);
    formData.append("file", new Blob([blobBytes.buffer], { type: audio.mimeType }), options.fileName || `audio.${getFileExtension(audio.mimeType)}`);
    formData.append("model", ENV.groqApiKey ? "whisper-large-v3-turbo" : "whisper-1");
    formData.append("response_format", "verbose_json");
    formData.append("prompt", promptFor(options));
    if (options.language) formData.append("language", options.language);

    const endpoint = ENV.groqApiKey
      ? "https://api.groq.com/openai/v1/audio/transcriptions"
      : ENV.forgeApiUrl ? new URL("v1/audio/transcriptions", `${ENV.forgeApiUrl.replace(/\/+$/, "")}/`).toString() : "";
    const apiKey = ENV.groqApiKey || ENV.forgeApiKey;
    if (!endpoint || !apiKey) return { error: "Voice transcription service is not configured", code: "SERVICE_ERROR" };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      body: formData,
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return { error: "Transcription service request failed", code: "TRANSCRIPTION_FAILED", details: `${response.status} ${response.statusText}${errorText ? `: ${errorText}` : ""}` };
    }

    const result = await response.json() as WhisperResponse;
    if (!result.text || typeof result.text !== "string") return { error: "Invalid transcription response", code: "SERVICE_ERROR" };
    return result;
  } catch (error) {
    return { error: "Voice transcription failed", code: "SERVICE_ERROR", details: error instanceof Error ? error.message : "An unexpected error occurred" };
  }
}
