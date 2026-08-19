import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, mayaDailyCheckIns, mayaGameSessions, mayaMemories, mayaMessages, mayaMoodLogs, mayaPreferences, mayaRelationships, mayaYoutubeSessions, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export type MayaMessageInput = {
  content: string;
  kind?: "text" | "voice" | "photo" | "activity";
  mediaUrl?: string;
};

export async function getRecentMessages(userId: number, limit = 60) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(mayaMessages).where(eq(mayaMessages.userId, userId)).orderBy(desc(mayaMessages.createdAt)).limit(limit);
}

export async function createMessage(input: MayaMessageInput & { userId: number; role: "user" | "maya"; emotion?: string; emotionIntensity?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Maya's memory is temporarily unavailable.");
  await db.insert(mayaMessages).values({
    userId: input.userId,
    role: input.role,
    kind: input.kind ?? "text",
    content: input.content,
    mediaUrl: input.mediaUrl,
    emotion: input.emotion,
    emotionIntensity: input.emotionIntensity,
    reactions: [],
  });
  const [message] = await db.select().from(mayaMessages).where(eq(mayaMessages.userId, input.userId)).orderBy(desc(mayaMessages.id)).limit(1);
  return message;
}

export async function getMemories(userId: number, limit = 40) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(mayaMemories).where(eq(mayaMemories.userId, userId)).orderBy(desc(mayaMemories.updatedAt)).limit(limit);
}

export async function createMemory(userId: number, topic: string, detail: string, category: string) {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(mayaMemories).where(and(eq(mayaMemories.userId, userId), eq(mayaMemories.topic, topic))).limit(1);
  if (existing[0]) {
    await db.update(mayaMemories).set({ detail, category, relevance: 4 }).where(eq(mayaMemories.id, existing[0].id));
  } else {
    await db.insert(mayaMemories).values({ userId, topic: topic.slice(0, 160), detail, category: category.slice(0, 48), relevance: 3 });
  }
}

export async function saveMood(userId: number, userMood: string, mayaEmotion: string, intensity: number, checkInId?: number) {
  const db = await getDb();
  if (!db) return;
  await db.insert(mayaMoodLogs).values({ userId, checkInId, userMood: userMood.slice(0, 96), mayaEmotion: mayaEmotion.slice(0, 32), intensity });
}

export async function getMoodLog(userId: number, limit = 30) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(mayaMoodLogs).where(eq(mayaMoodLogs.userId, userId)).orderBy(desc(mayaMoodLogs.createdAt)).limit(limit);
}

export async function getDailyCheckIns(userId: number, limit = 30) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(mayaDailyCheckIns).where(eq(mayaDailyCheckIns.userId, userId)).orderBy(desc(mayaDailyCheckIns.createdAt)).limit(limit);
}

export async function openDailyCheckIn(userId: number, checkInDate: string) {
  const db = await getDb();
  if (!db) throw new Error("Maya's check-in journal is temporarily unavailable.");
  const [existing] = await db.select().from(mayaDailyCheckIns).where(and(eq(mayaDailyCheckIns.userId, userId), eq(mayaDailyCheckIns.checkInDate, checkInDate))).limit(1);
  if (existing) return { created: false, checkIn: existing };
  await db.insert(mayaDailyCheckIns).values({ userId, checkInDate });
  const [checkIn] = await db.select().from(mayaDailyCheckIns).where(and(eq(mayaDailyCheckIns.userId, userId), eq(mayaDailyCheckIns.checkInDate, checkInDate))).limit(1);
  return { created: true, checkIn: checkIn! };
}

export async function getDailyCheckInForDate(userId: number, checkInDate: string) {
  const db = await getDb();
  if (!db) return undefined;
  const [checkIn] = await db.select().from(mayaDailyCheckIns).where(and(eq(mayaDailyCheckIns.userId, userId), eq(mayaDailyCheckIns.checkInDate, checkInDate))).limit(1);
  return checkIn;
}

export async function getOrCreatePreferences(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Maya's preferences are temporarily unavailable.");
  const [existing] = await db.select().from(mayaPreferences).where(eq(mayaPreferences.userId, userId)).limit(1);
  if (existing) return existing;
  await db.insert(mayaPreferences).values({ userId });
  const [created] = await db.select().from(mayaPreferences).where(eq(mayaPreferences.userId, userId)).limit(1);
  return created!;
}

export async function updatePreferences(userId: number, input: { theme?: "violet" | "rose" | "ocean" | "sunset"; voiceStyle?: number; displayPhoto?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Maya's preferences are temporarily unavailable.");
  await getOrCreatePreferences(userId);
  await db.update(mayaPreferences).set(input).where(eq(mayaPreferences.userId, userId));
  return getOrCreatePreferences(userId);
}

export async function toggleMessageReaction(userId: number, messageId: number, emoji: string) {
  const db = await getDb();
  if (!db) throw new Error("Maya's reactions are temporarily unavailable.");
  const [message] = await db.select().from(mayaMessages).where(and(eq(mayaMessages.id, messageId), eq(mayaMessages.userId, userId))).limit(1);
  if (!message) throw new Error("That message is not available.");
  const current = Array.isArray(message.reactions) ? message.reactions : [];
  const reactions = current.includes(emoji) ? current.filter((reaction) => reaction !== emoji) : [...current, emoji].slice(-8);
  await db.update(mayaMessages).set({ reactions }).where(eq(mayaMessages.id, messageId));
  return reactions;
}

export async function getOrCreateRelationship(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Maya's relationship memory is temporarily unavailable.");
  const [existing] = await db.select().from(mayaRelationships).where(eq(mayaRelationships.userId, userId)).limit(1);
  if (existing) return existing;
  await db.insert(mayaRelationships).values({ userId });
  const [created] = await db.select().from(mayaRelationships).where(eq(mayaRelationships.userId, userId)).limit(1);
  return created!;
}

export async function updateRelationship(userId: number, input: { mood: string; topic?: string; tone?: string }) {
  const db = await getDb();
  if (!db) return;
  const relationship = await getOrCreateRelationship(userId);
  await db.update(mayaRelationships).set({
    rapportScore: Math.min(100, relationship.rapportScore + 1),
    recurringMood: input.mood.slice(0, 96),
    lastMeaningfulTopic: input.topic?.slice(0, 160),
    preferredTone: input.tone?.slice(0, 64),
  }).where(eq(mayaRelationships.userId, userId));
}

export async function saveGameSession(userId: number, gameType: "chess" | "sudoku" | "ticTacToe" | "brainteaser" | "math" | "calendar" | "voice", state: Record<string, unknown>, result?: string) {
  const db = await getDb();
  if (!db) throw new Error("Maya's activity journal is temporarily unavailable.");
  await db.insert(mayaGameSessions).values({ userId, gameType, state, result: result?.slice(0, 32) });
}

export async function saveYoutubeSession(userId: number, videoUrl: string, title?: string, notes?: string) {
  const db = await getDb();
  if (!db) throw new Error("Maya's co-watch journal is temporarily unavailable.");
  await db.insert(mayaYoutubeSessions).values({ userId, videoUrl: videoUrl.slice(0, 2048), title: title?.slice(0, 320), notes: notes?.slice(0, 6000) });
}
