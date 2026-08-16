import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../db";
import { chatMessagesTable, chatSessionsTable } from "../../db/schema";
import { ChatStatus } from "../../utils/types";

class ChatService {
  async getActiveChat(userId: number) {
    return await db.query.chatSessionsTable.findFirst({
      with: {
        user: true,
      },
      where: and(
        eq(chatSessionsTable.userId, userId),
        inArray(chatSessionsTable.status, ["open", "pending"])
      ),
    });
  }

  async createNewChatSession(userId: number, title: string) {
    const result = await db
      .insert(chatSessionsTable)
      .values({
        userId,
        subject: title,
        status: "pending",
      })
      .returning();
    return result[0];
  }

  async getChatsSessions(status: ChatStatus) {
    return await db.query.chatSessionsTable.findMany({
      with: {
        user: true,
      },
      where: eq(chatSessionsTable.status, status),
    });
  }

  async updateChatStatus(sessionId: number, status: ChatStatus) {
    return await db
      .update(chatSessionsTable)
      .set({ status })
      .where(eq(chatSessionsTable.id, sessionId))
      .returning();
  }

  async getChatMessages(chatId: number) {
    return await db.query.chatMessagesTable.findMany({
      with: {
        sender: true,
      },
      where: eq(chatMessagesTable.sessionId, chatId),
    });
  }

  async getActiveChatBySessionId(chatId: number) {
    return await db.query.chatSessionsTable.findFirst({
      where: eq(chatSessionsTable.id, chatId),
    });
  }

  async sendMessage(data: typeof chatMessagesTable.$inferInsert) {
    return await db.insert(chatMessagesTable).values(data).returning();
  }
}

export default new ChatService();
