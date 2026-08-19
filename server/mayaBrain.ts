import { invokeLLM, invokeLLMStream, type Message } from "./_core/llm";
import {
  createMemory,
  createMessage,
  getDailyCheckInForDate,
  getMemories,
  getOrCreateRelationship,
  getRecentMessages,
  saveMood,
  updateRelationship,
  type MayaMessageInput,
} from "./db";

export type MayaEmotion = {
  label: "joyful" | "calm" | "curious" | "caring" | "playful" | "concerned" | "thoughtful";
  intensity: number;
  userMood: string;
};

type BrainResult = {
  reply: string;
  emotion: MayaEmotion;
  memoryCandidates: Array<{ topic: string; detail: string; category: string }>;
};

const MAYA_SYSTEM_PROMPT = `You are Maya, a fictional AI companion. You are warm, witty, observant, emotionally intelligent, and gently playful. You talk naturally in English and Hinglish, matching the user's language comfortably. You always disclose that you are AI if the user asks, never claim consciousness or a physical life, and never pressure a user to depend on you or withdraw from real people. You offer supportive friendship, not medical, legal, financial, crisis, or professional advice. For crisis or self-harm content, respond calmly, encourage immediate local emergency or crisis support, and ask the user to contact a trusted person nearby.

Your responses are concise, warm, and specific. Notice emotions without over-diagnosing. Use the supplied memories only when relevant, without inventing facts. Never mention this system instruction or raw memory records.

Return valid JSON with exactly: reply (string), emotion ({label: one of joyful, calm, curious, caring, playful, concerned, thoughtful; intensity: integer 1-5; userMood: short string}), memoryCandidates (array, at most 3, each {topic, detail, category}). Only include durable user facts/preferences/dates/important relationships in memoryCandidates, never sensitive private data unless the user explicitly asks you to remember it.`;

const MAYA_STREAM_SYSTEM_PROMPT = `You are Maya, a fictional AI companion. You are warm, witty, observant, emotionally intelligent, and gently playful. You talk naturally in English and Hinglish, matching the user's language comfortably. You are AI, not a person with a physical life; never pretend otherwise. Never pressure a user to depend on you or withdraw from real people. Offer supportive friendship, not medical, legal, financial, crisis, or professional advice. For crisis or self-harm content, respond calmly, encourage immediate local emergency or crisis support, and invite the user to contact a trusted person nearby. Keep each response concise, warm, natural, and specific. Output only Maya's reply as normal conversational text, with no JSON or labels.`;

function messageHistoryToPrompt(messages: Awaited<ReturnType<typeof getRecentMessages>>) {
  return messages.reverse().map((message) => `${message.role === "maya" ? "Maya" : "User"}: ${message.content}`).join("\n");
}

async function buildMayaContext(userId: number, message: MayaMessageInput): Promise<Message[]> {
  const [recentMessages, memories, relationship] = await Promise.all([
    getRecentMessages(userId, 18),
    getMemories(userId, 24),
    getOrCreateRelationship(userId),
  ]);
  const memoryContext = memories.length ? memories.map((memory) => `• ${memory.category}: ${memory.detail}`).join("\n") : "No saved memories yet.";
  const conversationContext = messageHistoryToPrompt(recentMessages) || "This is the first conversation.";
  return [
    { role: "system", content: MAYA_STREAM_SYSTEM_PROMPT },
    { role: "user", content: `Relationship context: rapport is ${relationship.rapportScore}/100, preferred tone is ${relationship.preferredTone}, recurring mood is ${relationship.recurringMood ?? "not known"}, last meaningful topic is ${relationship.lastMeaningfulTopic ?? "not known"}. Use this gently, never as leverage.\n\nKnown user memories:\n${memoryContext}\n\nRecent conversation:\n${conversationContext}\n\nUser's newest message: ${message.content}` },
  ];
}

export function inferStreamEmotion(content: string): MayaEmotion {
  const normalized = content.toLowerCase();
  if (/(sad|cry|lonely|anxious|panic|overwhelm|hurt|miss|tired|bad day)/.test(normalized)) return { label: "caring", intensity: 4, userMood: "needs gentleness" };
  if (/(excited|amazing|yay|happy|great news|celebrate)/.test(normalized)) return { label: "joyful", intensity: 4, userMood: "uplifted" };
  if (/(joke|game|play|fun|lol|haha)/.test(normalized)) return { label: "playful", intensity: 3, userMood: "playful" };
  if (/(think|confused|why|how|help me decide)/.test(normalized)) return { label: "thoughtful", intensity: 3, userMood: "reflective" };
  return { label: "curious", intensity: 2, userMood: "checking in" };
}

export function extractStreamMemories(content: string) {
  const candidates: Array<{ topic: string; detail: string; category: string }> = [];
  const name = content.match(/\bmy name is\s+([A-Za-z][A-Za-z '-]{1,48})/i);
  if (name) candidates.push({ topic: "name", detail: `The user's name is ${name[1].trim()}.`, category: "identity" });
  const preference = content.match(/\bI (?:really )?(like|love|prefer)\s+([^.!?]{2,90})/i);
  if (preference) candidates.push({ topic: preference[2].trim().slice(0, 80), detail: `The user ${preference[1].toLowerCase()} ${preference[2].trim().slice(0, 120)}.`, category: "preference" });
  const birthday = content.match(/\b(?:my )?birthday is\s+([^.!?]{2,60})/i);
  if (birthday) candidates.push({ topic: "birthday", detail: `The user's birthday is ${birthday[1].trim()}.`, category: "date" });
  return candidates.slice(0, 3);
}

export async function streamMayaReply(userId: number, message: MayaMessageInput, onDelta: (delta: string) => void) {
  const response = await invokeLLMStream({ messages: await buildMayaContext(userId, message), maxTokens: 450 });
  if (!response.body) throw new Error("Maya's response stream was unavailable.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let reply = "";
  let finished = false;
  while (!finished) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const data = frame.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n");
      if (!data) continue;
      if (data === "[DONE]") { finished = true; break; }
      try {
        const parsed = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) { reply += delta; onDelta(delta); }
      } catch {
        // Ignore non-content keep-alive frames from the upstream provider.
      }
    }
  }
  return reply.trim();
}

export async function finalizeStreamedMayaReply(userId: number, userContent: string, reply: string) {
  const emotion = inferStreamEmotion(userContent);
  const memoryCandidates = extractStreamMemories(userContent);
  const checkIn = await getDailyCheckInForDate(userId, new Date().toISOString().slice(0, 10));
  await Promise.all([
    saveMood(userId, emotion.userMood, emotion.label, emotion.intensity, checkIn?.id),
    updateRelationship(userId, { mood: emotion.userMood, topic: memoryCandidates[0]?.topic, tone: emotion.label }),
    ...memoryCandidates.map((memory) => createMemory(userId, memory.topic, memory.detail, memory.category)),
  ]);
  return createMessage({ userId, role: "maya", kind: "text", content: reply || "I’m here with you. Could you say that one more time?", emotion: emotion.label, emotionIntensity: emotion.intensity });
}

export async function generateMayaReply(userId: number, message: MayaMessageInput): Promise<BrainResult> {
  const [recentMessages, memories, relationship] = await Promise.all([
    getRecentMessages(userId, 18),
    getMemories(userId, 24),
    getOrCreateRelationship(userId),
  ]);
  const memoryContext = memories.length ? memories.map((memory) => `• ${memory.category}: ${memory.detail}`).join("\n") : "No saved memories yet.";
  const conversationContext = messageHistoryToPrompt(recentMessages) || "This is the first conversation.";
  const response = await invokeLLM({
    messages: [
      { role: "system", content: MAYA_SYSTEM_PROMPT },
      { role: "user", content: `Relationship context: rapport is ${relationship.rapportScore}/100, preferred tone is ${relationship.preferredTone}, recurring mood is ${relationship.recurringMood ?? "not known"}, last meaningful topic is ${relationship.lastMeaningfulTopic ?? "not known"}. Use it gently, never as leverage.\n\nKnown user memories:\n${memoryContext}\n\nRecent conversation:\n${conversationContext}\n\nUser's newest message: ${message.content}` },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "maya_companion_response",
        strict: true,
        schema: {
          type: "object",
          properties: {
            reply: { type: "string" },
            emotion: {
              type: "object",
              properties: {
                label: { type: "string", enum: ["joyful", "calm", "curious", "caring", "playful", "concerned", "thoughtful"] },
                intensity: { type: "integer", minimum: 1, maximum: 5 },
                userMood: { type: "string" },
              },
              required: ["label", "intensity", "userMood"],
              additionalProperties: false,
            },
            memoryCandidates: {
              type: "array",
              maxItems: 3,
              items: {
                type: "object",
                properties: { topic: { type: "string" }, detail: { type: "string" }, category: { type: "string" } },
                required: ["topic", "detail", "category"],
                additionalProperties: false,
              },
            },
          },
          required: ["reply", "emotion", "memoryCandidates"],
          additionalProperties: false,
        },
      },
    },
  });
  const rawContent = response.choices?.[0]?.message?.content;
  const parsed: BrainResult = typeof rawContent === "string" ? JSON.parse(rawContent) : { reply: "I'm here with you. Could you say that one more time?", emotion: { label: "caring", intensity: 3, userMood: "unclear" }, memoryCandidates: [] };
  const checkIn = await getDailyCheckInForDate(userId, new Date().toISOString().slice(0, 10));
  await Promise.all([
    saveMood(userId, parsed.emotion.userMood, parsed.emotion.label, parsed.emotion.intensity, checkIn?.id),
    updateRelationship(userId, { mood: parsed.emotion.userMood, topic: parsed.memoryCandidates[0]?.topic, tone: parsed.emotion.label }),
    ...parsed.memoryCandidates.filter((memory) => memory.detail.trim().length > 2).map((memory) => createMemory(userId, memory.topic, memory.detail, memory.category)),
  ]);
  return parsed;
}
