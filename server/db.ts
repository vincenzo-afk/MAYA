import type { InsertUser, User } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { getSupabaseServerClient } from "./supabaseConfig";

type SupabaseRow = Record<string, unknown>;
type MayaRole = "user" | "maya";
type MayaMessageKind = "text" | "voice" | "photo" | "activity";
type MayaTheme = "violet" | "rose" | "ocean" | "sunset";
type MayaGameType = "chess" | "sudoku" | "ticTacToe" | "brainteaser" | "math" | "calendar" | "voice" | "ludo" | "snakesLadders" | "connectFour" | "game2048" | "wouldYouRather";

export type MayaMessageInput = {
  content: string;
  kind?: MayaMessageKind;
  mediaUrl?: string;
};

function toDate(value: unknown): Date {
  return value instanceof Date ? value : new Date(String(value));
}

function asNumber(value: unknown): number {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) throw new Error("Maya received an invalid database identifier.");
  return numberValue;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function assertResult<T>(data: T, error: { message: string } | null, action: string): T {
  if (error) throw new Error(`Maya could not ${action}: ${error.message}`);
  return data;
}

function mapUser(row: SupabaseRow): User {
  return {
    id: asNumber(row.id),
    openId: asString(row.open_id),
    name: asNullableString(row.name),
    email: asNullableString(row.email),
    loginMethod: asNullableString(row.login_method),
    role: asString(row.role, "user") as "user" | "admin",
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
    lastSignedIn: toDate(row.last_signed_in),
  };
}

function mapMessage(row: SupabaseRow) {
  return {
    id: asNumber(row.id),
    userId: asNumber(row.user_id),
    role: asString(row.role) as MayaRole,
    kind: asString(row.kind, "text") as MayaMessageKind,
    content: asString(row.content),
    mediaUrl: asNullableString(row.media_url),
    emotion: asNullableString(row.emotion),
    emotionIntensity: row.emotion_intensity == null ? null : asNumber(row.emotion_intensity),
    reactions: asStringArray(row.reactions),
    createdAt: toDate(row.created_at),
  };
}

function mapMemory(row: SupabaseRow) {
  return {
    id: asNumber(row.id),
    userId: asNumber(row.user_id),
    topic: asString(row.topic),
    detail: asString(row.detail),
    category: asString(row.category, "preference"),
    relevance: asNumber(row.relevance),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

function mapMoodLog(row: SupabaseRow) {
  return {
    id: asNumber(row.id),
    userId: asNumber(row.user_id),
    checkInId: row.check_in_id == null ? null : asNumber(row.check_in_id),
    userMood: asString(row.user_mood),
    mayaEmotion: asString(row.maya_emotion),
    intensity: asNumber(row.intensity),
    createdAt: toDate(row.created_at),
  };
}

function mapCheckIn(row: SupabaseRow) {
  return {
    id: asNumber(row.id),
    userId: asNumber(row.user_id),
    checkInDate: asString(row.check_in_date),
    createdAt: toDate(row.created_at),
  };
}

function mapPreferences(row: SupabaseRow) {
  return {
    id: asNumber(row.id),
    userId: asNumber(row.user_id),
    theme: asString(row.theme, "violet") as MayaTheme,
    voiceStyle: asNumber(row.voice_style),
    displayPhoto: asNullableString(row.display_photo),
    updatedAt: toDate(row.updated_at),
  };
}

function mapRelationship(row: SupabaseRow) {
  return {
    id: asNumber(row.id),
    userId: asNumber(row.user_id),
    rapportScore: asNumber(row.rapport_score),
    preferredTone: asString(row.preferred_tone, "warm and curious"),
    recurringMood: asNullableString(row.recurring_mood),
    lastMeaningfulTopic: asNullableString(row.last_meaningful_topic),
    updatedAt: toDate(row.updated_at),
  };
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");

  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    open_id: user.openId,
    updated_at: now,
    last_signed_in: user.lastSignedIn instanceof Date ? user.lastSignedIn.toISOString() : now,
  };
  if (user.name !== undefined) payload.name = user.name;
  if (user.email !== undefined) payload.email = user.email;
  if (user.loginMethod !== undefined) payload.login_method = user.loginMethod;
  if (user.role !== undefined) {
    payload.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    payload.role = "admin";
  }
  const { error } = await getSupabaseServerClient().from("users").upsert(payload, { onConflict: "open_id" });
  assertResult(undefined, error, "save the signed-in user");
}

export async function getUserByOpenId(openId: string) {
  const { data, error } = await getSupabaseServerClient().from("users").select("*").eq("open_id", openId).maybeSingle();
  assertResult(data, error, "look up the signed-in user");
  return data ? mapUser(data as SupabaseRow) : undefined;
}

export async function getRecentMessages(userId: number, limit = 60) {
  const { data, error } = await getSupabaseServerClient().from("maya_messages").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
  return assertResult(data ?? [], error, "load recent messages").map((row) => mapMessage(row as SupabaseRow));
}

export async function createMessage(input: MayaMessageInput & { userId: number; role: MayaRole; emotion?: string; emotionIntensity?: number }) {
  const { data, error } = await getSupabaseServerClient().from("maya_messages").insert({
    user_id: input.userId,
    role: input.role,
    kind: input.kind ?? "text",
    content: input.content,
    media_url: input.mediaUrl ?? null,
    emotion: input.emotion ?? null,
    emotion_intensity: input.emotionIntensity ?? null,
    reactions: [],
  }).select("*").single();
  return mapMessage(assertResult(data, error, "save a message") as SupabaseRow);
}

export async function getMemories(userId: number, limit = 40) {
  const { data, error } = await getSupabaseServerClient().from("maya_memories").select("*").eq("user_id", userId).order("updated_at", { ascending: false }).limit(limit);
  return assertResult(data ?? [], error, "load memories").map((row) => mapMemory(row as SupabaseRow));
}

export async function createMemory(userId: number, topic: string, detail: string, category: string) {
  const client = getSupabaseServerClient();
  const { data: existing, error: lookupError } = await client.from("maya_memories").select("id").eq("user_id", userId).eq("topic", topic.slice(0, 160)).maybeSingle();
  assertResult(existing, lookupError, "check a memory");
  const now = new Date().toISOString();
  if (existing) {
    const { error } = await client.from("maya_memories").update({ detail, category: category.slice(0, 48), relevance: 4, updated_at: now }).eq("id", existing.id).eq("user_id", userId);
    assertResult(undefined, error, "update a memory");
    return;
  }
  const { error } = await client.from("maya_memories").insert({ user_id: userId, topic: topic.slice(0, 160), detail, category: category.slice(0, 48), relevance: 3, updated_at: now });
  assertResult(undefined, error, "save a memory");
}

export async function saveMood(userId: number, userMood: string, mayaEmotion: string, intensity: number, checkInId?: number) {
  const { error } = await getSupabaseServerClient().from("maya_mood_logs").insert({ user_id: userId, check_in_id: checkInId ?? null, user_mood: userMood.slice(0, 96), maya_emotion: mayaEmotion.slice(0, 32), intensity });
  assertResult(undefined, error, "save a mood entry");
}

export async function getMoodLog(userId: number, limit = 30) {
  const { data, error } = await getSupabaseServerClient().from("maya_mood_logs").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
  return assertResult(data ?? [], error, "load mood entries").map((row) => mapMoodLog(row as SupabaseRow));
}

export async function getDailyCheckIns(userId: number, limit = 30) {
  const { data, error } = await getSupabaseServerClient().from("maya_daily_checkins").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
  return assertResult(data ?? [], error, "load daily check-ins").map((row) => mapCheckIn(row as SupabaseRow));
}

export async function openDailyCheckIn(userId: number, checkInDate: string) {
  const client = getSupabaseServerClient();
  const { data: before, error: beforeError } = await client.from("maya_daily_checkins").select("*").eq("user_id", userId).eq("check_in_date", checkInDate).maybeSingle();
  assertResult(before, beforeError, "find a daily check-in");
  if (before) return { created: false, checkIn: mapCheckIn(before as SupabaseRow) };
  const { error: insertError } = await client.from("maya_daily_checkins").upsert({ user_id: userId, check_in_date: checkInDate }, { onConflict: "user_id,check_in_date", ignoreDuplicates: true });
  assertResult(undefined, insertError, "open a daily check-in");
  const { data, error } = await client.from("maya_daily_checkins").select("*").eq("user_id", userId).eq("check_in_date", checkInDate).single();
  return { created: true, checkIn: mapCheckIn(assertResult(data, error, "load the daily check-in") as SupabaseRow) };
}

export async function getDailyCheckInForDate(userId: number, checkInDate: string) {
  const { data, error } = await getSupabaseServerClient().from("maya_daily_checkins").select("*").eq("user_id", userId).eq("check_in_date", checkInDate).maybeSingle();
  assertResult(data, error, "look up a daily check-in");
  return data ? mapCheckIn(data as SupabaseRow) : undefined;
}

export async function getOrCreatePreferences(userId: number) {
  const client = getSupabaseServerClient();
  const { error: createError } = await client.from("maya_preferences").upsert({ user_id: userId, updated_at: new Date().toISOString() }, { onConflict: "user_id", ignoreDuplicates: true });
  assertResult(undefined, createError, "prepare preferences");
  const { data, error } = await client.from("maya_preferences").select("*").eq("user_id", userId).single();
  return mapPreferences(assertResult(data, error, "load preferences") as SupabaseRow);
}

export async function updatePreferences(userId: number, input: { theme?: MayaTheme; voiceStyle?: number; displayPhoto?: string | null }) {
  await getOrCreatePreferences(userId);
  const { error } = await getSupabaseServerClient().from("maya_preferences").update({
    ...(input.theme === undefined ? {} : { theme: input.theme }),
    ...(input.voiceStyle === undefined ? {} : { voice_style: input.voiceStyle }),
    ...(input.displayPhoto === undefined ? {} : { display_photo: input.displayPhoto }),
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId);
  assertResult(undefined, error, "update preferences");
  return getOrCreatePreferences(userId);
}

export async function toggleMessageReaction(userId: number, messageId: number, emoji: string) {
  const client = getSupabaseServerClient();
  const { data: message, error: messageError } = await client.from("maya_messages").select("id,reactions").eq("id", messageId).eq("user_id", userId).maybeSingle();
  assertResult(message, messageError, "find that message");
  if (!message) throw new Error("That message is not available.");
  const current = asStringArray(message.reactions);
  const reactions = current.includes(emoji) ? current.filter((reaction) => reaction !== emoji) : [...current, emoji].slice(-8);
  const { error } = await client.from("maya_messages").update({ reactions }).eq("id", messageId).eq("user_id", userId);
  assertResult(undefined, error, "save that reaction");
  return reactions;
}

export async function getOrCreateRelationship(userId: number) {
  const client = getSupabaseServerClient();
  const { error: createError } = await client.from("maya_relationships").upsert({ user_id: userId, updated_at: new Date().toISOString() }, { onConflict: "user_id", ignoreDuplicates: true });
  assertResult(undefined, createError, "prepare relationship memory");
  const { data, error } = await client.from("maya_relationships").select("*").eq("user_id", userId).single();
  return mapRelationship(assertResult(data, error, "load relationship memory") as SupabaseRow);
}

export async function updateRelationship(userId: number, input: { mood: string; topic?: string; tone?: string }) {
  const relationship = await getOrCreateRelationship(userId);
  const { error } = await getSupabaseServerClient().from("maya_relationships").update({
    rapport_score: Math.min(100, relationship.rapportScore + 1),
    recurring_mood: input.mood.slice(0, 96),
    last_meaningful_topic: input.topic?.slice(0, 160) ?? null,
    preferred_tone: input.tone?.slice(0, 64) ?? relationship.preferredTone,
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId);
  assertResult(undefined, error, "update relationship memory");
}

export async function saveGameSession(userId: number, gameType: MayaGameType, state: Record<string, unknown>, result?: string) {
  const { error } = await getSupabaseServerClient().from("maya_game_sessions").insert({ user_id: userId, game_type: gameType, state, result: result?.slice(0, 32) ?? null, updated_at: new Date().toISOString() });
  assertResult(undefined, error, "save the activity session");
}

export async function saveYoutubeSession(userId: number, videoUrl: string, title?: string, notes?: string) {
  const { error } = await getSupabaseServerClient().from("maya_youtube_sessions").insert({ user_id: userId, video_url: videoUrl.slice(0, 2048), title: title?.slice(0, 320) ?? null, notes: notes?.slice(0, 6000) ?? null });
  assertResult(undefined, error, "save the co-watch session");
}
