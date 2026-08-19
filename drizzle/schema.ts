import { index, int, json, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const mayaMessages = mysqlTable("maya_messages", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["user", "maya"]).notNull(),
  kind: mysqlEnum("kind", ["text", "voice", "photo", "activity"]).notNull().default("text"),
  content: text("content").notNull(),
  mediaUrl: text("mediaUrl"),
  emotion: varchar("emotion", { length: 32 }),
  emotionIntensity: int("emotionIntensity"),
  reactions: json("reactions").$type<string[]>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("maya_messages_user_created_idx").on(table.userId, table.createdAt)]);

export const mayaMemories = mysqlTable("maya_memories", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  topic: varchar("topic", { length: 160 }).notNull(),
  detail: text("detail").notNull(),
  category: varchar("category", { length: 48 }).notNull().default("preference"),
  relevance: int("relevance").notNull().default(3),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("maya_memories_user_updated_idx").on(table.userId, table.updatedAt)]);

export const mayaMoodLogs = mysqlTable("maya_mood_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  checkInId: int("checkInId"),
  userMood: varchar("userMood", { length: 96 }).notNull(),
  mayaEmotion: varchar("mayaEmotion", { length: 32 }).notNull(),
  intensity: int("intensity").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("maya_mood_user_created_idx").on(table.userId, table.createdAt),
  index("maya_mood_session_created_idx").on(table.userId, table.checkInId, table.createdAt),
]);

export const mayaDailyCheckIns = mysqlTable("maya_daily_checkins", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  checkInDate: varchar("checkInDate", { length: 10 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("maya_daily_checkins_user_date_unique").on(table.userId, table.checkInDate),
  index("maya_daily_checkins_user_created_idx").on(table.userId, table.createdAt),
]);

export const mayaPreferences = mysqlTable("maya_preferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  theme: mysqlEnum("theme", ["violet", "rose", "ocean", "sunset"]).notNull().default("violet"),
  voiceStyle: int("voiceStyle").notNull().default(0),
  displayPhoto: text("displayPhoto"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("maya_preferences_user_unique").on(table.userId)]);

export const mayaRelationships = mysqlTable("maya_relationships", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  rapportScore: int("rapportScore").notNull().default(1),
  preferredTone: varchar("preferredTone", { length: 64 }).notNull().default("warm and curious"),
  recurringMood: varchar("recurringMood", { length: 96 }),
  lastMeaningfulTopic: varchar("lastMeaningfulTopic", { length: 160 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("maya_relationships_user_unique").on(table.userId)]);

export const mayaGameSessions = mysqlTable("maya_game_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  gameType: mysqlEnum("gameType", ["chess", "sudoku", "ticTacToe", "brainteaser", "math", "calendar", "voice", "ludo", "snakesLadders", "connectFour", "game2048", "wouldYouRather"]).notNull(),
  state: json("state").$type<Record<string, unknown>>().notNull(),
  result: varchar("result", { length: 32 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("maya_games_user_updated_idx").on(table.userId, table.updatedAt)]);

export const mayaYoutubeSessions = mysqlTable("maya_youtube_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  videoUrl: text("videoUrl").notNull(),
  title: varchar("title", { length: 320 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("maya_youtube_user_created_idx").on(table.userId, table.createdAt)]);

export type MayaMessage = typeof mayaMessages.$inferSelect;
