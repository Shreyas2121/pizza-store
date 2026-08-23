import { integer, pgTable, text } from "drizzle-orm/pg-core";
import { id, createdAt, updatedAt } from "./_helpers";
import { ChatStatus } from "../../utils/types";
import { usersTable } from "./user.schema";

// ──────────────────────────────────────────────
// Chat Sessions
// ──────────────────────────────────────────────

export const chatSessionsTable = pgTable("chat_sessions", {
  id,
  userId: integer("user_id")
    .references(() => usersTable.id)
    .notNull(),
  subject: text(),
  status: text().$type<ChatStatus>().default("open").notNull(),
  createdAt,
  updatedAt,
});

// ──────────────────────────────────────────────
// Chat Messages
// ──────────────────────────────────────────────

export const chatMessagesTable = pgTable("chat_messages", {
  id,
  sessionId: integer("session_id")
    .references(() => chatSessionsTable.id)
    .notNull(),
  senderId: integer("sender_id")
    .references(() => usersTable.id)
    .notNull(),
  message: text().notNull(),
  createdAt,
});
