import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

export const userRole = pgEnum("maya_user_role", ["user", "admin"]);
export const mayaMessageRole = pgEnum("maya_message_role", ["user", "maya"]);
export const mayaMessageKind = pgEnum("maya_message_kind", ["text", "voice", "photo", "activity"]);
export const mayaTheme = pgEnum("maya_theme", ["violet", "rose", "ocean", "sunset"]);
export const mayaGameType = pgEnum("maya_game_type", ["chess", "sudoku", "ticTacToe", "brainteaser", "math", "calendar", "voice", "ludo", "snakesLadders", "connectFour", "game2048", "wouldYouRather"]);

export const users = pgTable("users", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  openId: varchar("open_id", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("login_method", { length: 64 }),
  role: userRole("role").notNull().default("user"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  lastSignedIn: timestamp("last_signed_in", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const mayaMessages = pgTable("maya_messages", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: mayaMessageRole("role").notNull(),
  kind: mayaMessageKind("kind").notNull().default("text"),
  content: text("content").notNull(),
  mediaUrl: text("media_url"),
  emotion: varchar("emotion", { length: 32 }),
  emotionIntensity: integer("emotion_intensity"),
  reactions: jsonb("reactions").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("maya_messages_user_created_idx").on(table.userId, table.createdAt)]);

export const mayaMemories = pgTable("maya_memories", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  topic: varchar("topic", { length: 160 }).notNull(),
  detail: text("detail").notNull(),
  category: varchar("category", { length: 48 }).notNull().default("preference"),
  relevance: integer("relevance").notNull().default(3),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("maya_memories_user_updated_idx").on(table.userId, table.updatedAt)]);

export const mayaDailyCheckIns = pgTable("maya_daily_checkins", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  checkInDate: varchar("check_in_date", { length: 10 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("maya_daily_checkins_user_date_unique").on(table.userId, table.checkInDate), index("maya_daily_checkins_user_created_idx").on(table.userId, table.createdAt)]);

export const mayaMoodLogs = pgTable("maya_mood_logs", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  checkInId: integer("check_in_id").references(() => mayaDailyCheckIns.id, { onDelete: "set null" }),
  userMood: varchar("user_mood", { length: 96 }).notNull(),
  mayaEmotion: varchar("maya_emotion", { length: 32 }).notNull(),
  intensity: integer("intensity").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("maya_mood_user_created_idx").on(table.userId, table.createdAt), index("maya_mood_session_created_idx").on(table.userId, table.checkInId, table.createdAt)]);

export const mayaPreferences = pgTable("maya_preferences", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  theme: mayaTheme("theme").notNull().default("violet"),
  voiceStyle: integer("voice_style").notNull().default(0),
  displayPhoto: text("display_photo"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("maya_preferences_user_unique").on(table.userId)]);

export const mayaRelationships = pgTable("maya_relationships", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  rapportScore: integer("rapport_score").notNull().default(1),
  preferredTone: varchar("preferred_tone", { length: 64 }).notNull().default("warm and curious"),
  recurringMood: varchar("recurring_mood", { length: 96 }),
  lastMeaningfulTopic: varchar("last_meaningful_topic", { length: 160 }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("maya_relationships_user_unique").on(table.userId)]);

export const mayaGameSessions = pgTable("maya_game_sessions", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  gameType: mayaGameType("game_type").notNull(),
  state: jsonb("state").$type<Record<string, unknown>>().notNull(),
  result: varchar("result", { length: 32 }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("maya_games_user_updated_idx").on(table.userId, table.updatedAt)]);

export const mayaYoutubeSessions = pgTable("maya_youtube_sessions", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  videoUrl: text("video_url").notNull(),
  title: varchar("title", { length: 320 }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("maya_youtube_user_created_idx").on(table.userId, table.createdAt)]);

export type MayaMessage = typeof mayaMessages.$inferSelect;
