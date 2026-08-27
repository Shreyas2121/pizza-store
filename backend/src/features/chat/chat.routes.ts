import { Router } from "express";
import {
  authenticateAdmin,
  authenticateUser,
} from "../../middleware/authenticateUser";
import { AppError, asyncHandler } from "../../utils/error";
import { Auth, ChatStatus } from "../../utils/types";
import chatService from "./chat.service";
import { io } from "../..";
import userService from "../users/user.service";

export const chatRoutes = Router();

// Request Chat;

chatRoutes.post(
  "/request",
  authenticateUser,
  asyncHandler(async (req: Auth, res) => {
    const userId = req.principal!.userId;

    const title = req.body.title as string;

    const activeChat = await chatService.getActiveChat(userId);

    if (activeChat?.status === "open") {
      throw new AppError("Session exists", 409);
    }

    const chatSession = await chatService.createNewChatSession(userId, title);
    io.emit("chatRequest", chatSession);

    res.json({
      message: "Session created",
      data: chatSession,
    });
  })
);

chatRoutes.get(
  "/active",
  authenticateUser,
  asyncHandler(async (req: Auth, res) => {
    let userId: number;
    if (req.query.userId) {
      if (req.principal!.platformRole !== "admin") throw new AppError("Unauthorized", 403);
      userId = parseInt(req.query.userId as string);
    } else {
      userId = req.principal!.userId;
    }
    const activeChat = await chatService.getActiveChat(userId);

    res.json({
      data: activeChat,
    });
  })
);

chatRoutes.get(
  "/requests",
  authenticateAdmin,
  asyncHandler(async (req: Auth, res) => {
    const query = req.query;
    const status = query.status as ChatStatus;

    const requests = await chatService.getChatsSessions(status);

    res.json({
      data: requests,
    });
  })
);

chatRoutes.patch(
  "/request",
  authenticateAdmin,
  asyncHandler(async (req: Auth, res) => {
    const chatSessionId = req.body.chatId as string;
    const status = req.body.status as ChatStatus;

    const previousChatSession = await chatService.getActiveChatBySessionId(parseInt(chatSessionId));
    const [updatedChatSession] = await chatService.updateChatStatus(
      parseInt(chatSessionId),
      status
    );

    io.emit("chatStatusChange", JSON.stringify(updatedChatSession));

    res.json({
      message: "Chat status updated",
      data: {
        updatedChatSession,
          oldStatus: previousChatSession?.status ?? status,
      },
    });
  })
);

chatRoutes.get(
  "/messages",
  authenticateUser,
  asyncHandler(async (req: Auth, res) => {
    let userId: number;
    if (req.query.userId) {
      if (req.principal!.platformRole !== "admin") throw new AppError("Unauthorized", 403);
      userId = parseInt(req.query.userId as string);
    } else {
      userId = req.principal!.userId;
    }

    const activeChat = await chatService.getActiveChat(userId);

    if (!activeChat) {
      throw new AppError("No active chat", 404);
    }

    const data = await chatService.getChatMessages(activeChat.id);

    const messages = data.map((d) => {
      const type = d.sender.role;
      return {
        type,
        timestamp: new Date(d.createdAt).toISOString(),
        id: d.id,
        message: d.message,
      };
    });

    res.json({
      data: messages,
    });
  })
);

chatRoutes.post(
  "/message",
  authenticateUser,
  asyncHandler(async (req: Auth, res) => {
    const userId = req.principal!.userId;

    const data = req.body;

    const session = await chatService.getActiveChatBySessionId(data.sessionId);

    if (!session) throw new AppError("Session not found", 404);
    if (req.principal!.platformRole !== "admin" && session.userId !== userId) {
      throw new AppError("Unauthorized", 403);
    }

  const [messageData] = await chatService.sendMessage({
      ...data,
      senderId: userId,
    });
    const user = await userService.getUserById(messageData.senderId);

    const message = {
      id: messageData.id,
      timestamp: new Date(messageData.createdAt).toISOString(),
      type: user?.role,
      message: messageData.message,
    };

    io.to(`user-${session.userId}`).emit("newMessage", message);

    res.json({
      data: message,
    });
  })
);
