import { z } from "zod";
import { transcribeAudio } from "../_core/voiceTranscription";
import { protectedProcedure, router } from "../_core/trpc";
import { storagePut } from "../storage";
import {
  createMessage,
  getDailyCheckIns,
  getMemories,
  getMoodLog,
  getOrCreatePreferences,
  getOrCreateRelationship,
  getRecentMessages,
  openDailyCheckIn,
  saveGameSession,
  saveYoutubeSession,
  setRelationshipTone,
  toggleMessageReaction,
  updatePreferences,
} from "../db";
import { generateMayaReply } from "../mayaBrain";

const messageInput = z.object({
  content: z.string().trim().min(1).max(4000),
  kind: z.enum(["text", "voice", "activity"]).default("text"),
  mediaUrl: z.string().max(2048).optional(),
});

function decodeDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("The recorded audio could not be read.");
  return { mimeType: match[1], bytes: Buffer.from(match[2], "base64") };
}

export const mayaRouter = router({
  bootstrap: protectedProcedure.query(async ({ ctx }) => {
    const [messages, preferences, mood, dailyCheckIns, relationship] = await Promise.all([
      getRecentMessages(ctx.user.id, 80),
      getOrCreatePreferences(ctx.user.id),
      getMoodLog(ctx.user.id, 12),
      getDailyCheckIns(ctx.user.id, 30),
      getOrCreateRelationship(ctx.user.id),
    ]);
    return { messages: messages.reverse(), preferences, mood, dailyCheckIns, relationship };
  }),

  sendMessage: protectedProcedure.input(messageInput).mutation(async ({ ctx, input }) => {
    const userMessage = await createMessage({ userId: ctx.user.id, role: "user", ...input });
    const brain = await generateMayaReply(ctx.user.id, input);
    const mayaMessage = await createMessage({
      userId: ctx.user.id,
      role: "maya",
      kind: "text",
      content: brain.reply,
      emotion: brain.emotion.label,
      emotionIntensity: brain.emotion.intensity,
    });
    return { userMessage, mayaMessage, emotion: brain.emotion };
  }),

  processVoiceNote: protectedProcedure.input(z.object({
    audioData: z.string().min(32).max(15_000_000),
    fileName: z.string().max(120).default("voice-note.webm"),
    language: z.string().max(8).optional(),
  })).mutation(async ({ ctx, input }) => {
    const { bytes, mimeType } = decodeDataUrl(input.audioData);
    if (bytes.byteLength > 16 * 1024 * 1024) throw new Error("Voice notes must be below 16 MB.");
    const key = `maya/${ctx.user.id}/voice/${Date.now()}-${input.fileName.replace(/[^a-z0-9._-]/gi, "-")}`;
    const { url } = await storagePut(key, bytes, mimeType);
    const transcriptResult = await transcribeAudio({
      audioData: bytes,
      fileName: input.fileName,
      mimeType,
      language: input.language,
      prompt: "A personal conversation with Maya, an AI companion. The user may speak English or Hinglish.",
    });
    if (!("text" in transcriptResult) || !transcriptResult.text?.trim()) {
      throw new Error("Maya could not transcribe that voice note. Please try again in a quieter place or send a shorter recording.");
    }
    const transcript = transcriptResult.text.trim();
    const userMessage = await createMessage({ userId: ctx.user.id, role: "user", kind: "voice", content: transcript, mediaUrl: url });
    const brain = await generateMayaReply(ctx.user.id, { content: transcript, kind: "voice" });
    const mayaMessage = await createMessage({
      userId: ctx.user.id,
      role: "maya",
      kind: "voice",
      content: brain.reply,
      emotion: brain.emotion.label,
      emotionIntensity: brain.emotion.intensity,
    });
    return { userMessage, mayaMessage, transcript, emotion: brain.emotion };
  }),

  setReaction: protectedProcedure.input(z.object({
    messageId: z.number().int().positive(),
    emoji: z.string().min(1).max(8),
  })).mutation(({ ctx, input }) => toggleMessageReaction(ctx.user.id, input.messageId, input.emoji)),

  sendMedia: protectedProcedure.input(z.object({
    type: z.enum(["GIF", "sticker"]),
    mediaUrl: z.string().url().max(2048).optional(),
    sticker: z.string().min(1).max(16).optional(),
  }).refine((input) => input.type === "GIF" ? Boolean(input.mediaUrl) : Boolean(input.sticker), "Select a GIF or sticker first.")).mutation(({ ctx, input }) => createMessage({
    userId: ctx.user.id,
    role: "user",
    kind: "activity",
    content: input.type === "GIF" ? "GIF" : `Sticker: ${input.sticker}`,
    mediaUrl: input.type === "GIF" ? input.mediaUrl : undefined,
  })),

  memories: protectedProcedure.query(({ ctx }) => getMemories(ctx.user.id, 100)),
  mood: protectedProcedure.query(({ ctx }) => getMoodLog(ctx.user.id, 30)),
  dailyCheckIns: protectedProcedure.query(({ ctx }) => getDailyCheckIns(ctx.user.id, 30)),
  openDailyCheckIn: protectedProcedure.input(z.object({ checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })).mutation(({ ctx, input }) => openDailyCheckIn(ctx.user.id, input.checkInDate)),

  preferences: protectedProcedure.query(({ ctx }) => getOrCreatePreferences(ctx.user.id)),
  updatePreferences: protectedProcedure.input(z.object({
    theme: z.enum(["violet", "rose", "ocean", "sunset"]).optional(),
    voiceStyle: z.number().int().min(0).max(9).optional(),
    displayPhoto: z.string().max(2048).nullable().optional(),
  })).mutation(({ ctx, input }) => updatePreferences(ctx.user.id, input)),

  setCompanionTone: protectedProcedure.input(z.object({
    tone: z.enum(["soft and reassuring", "playful and cheeky", "honest and direct", "quiet and spacious"]),
  })).mutation(({ ctx, input }) => setRelationshipTone(ctx.user.id, input.tone)),

  saveGameSession: protectedProcedure.input(z.object({
    gameType: z.enum(["chess", "sudoku", "ticTacToe", "brainteaser", "math", "calendar", "voice", "ludo", "snakesLadders", "connectFour", "game2048", "wouldYouRather"]),
    state: z.record(z.string(), z.unknown()),
    result: z.string().max(32).optional(),
  })).mutation(({ ctx, input }) => saveGameSession(ctx.user.id, input.gameType, input.state, input.result)),

  saveYoutubeSession: protectedProcedure.input(z.object({
    videoUrl: z.string().url().max(2048),
    title: z.string().max(320).optional(),
    notes: z.string().max(6000).optional(),
  })).mutation(({ ctx, input }) => saveYoutubeSession(ctx.user.id, input.videoUrl, input.title, input.notes)),
});
