import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API } from "@/shared/api";
import { useUser } from "@/features/auth";
import { useSupportStore } from "../model/support.store";
import type { ChatSession, ChatSessionWithUser, ChatStatus, Message } from "../model/support.types";

export const supportKeys = {
  all: ["support"] as const,
  user: (viewerId?: number) => ["support", "active", viewerId, "self"] as const,
  admin: () => ["support", "requests"] as const,
  adminUserChat: (userId?: number, viewerId?: number) => ["support", "active", viewerId, userId ?? "self"] as const,
  messages: (userId?: number, sessionId?: number, viewerId?: number) => ["support", "messages", viewerId, userId ?? "self", sessionId ?? "active"] as const,
};
const validUser = (userId?: number) => userId === undefined || (Number.isInteger(userId) && userId > 0);
const userParams = (userId?: number) => userId === undefined ? {} : { userId };

export const useChatRequest = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { title: string }) => (await API.post<{ message: string; data: ChatSession }>("/chat/request", input)).data,
    onSuccess: () => client.invalidateQueries({ queryKey: supportKeys.all }),
  });
};
export const useGetActiveChat = (userId?: number, enabled = true) => {
  const viewerId = useUser((state) => state.user?.id);
  return useQuery({
    queryKey: supportKeys.adminUserChat(userId, viewerId),
    queryFn: async ({ signal }) => (await API.get<{ data?: ChatSessionWithUser | null }>("/chat/active", { params: userParams(userId), signal })).data.data ?? null,
    enabled: enabled && Boolean(viewerId) && validUser(userId),
  });
};
export const useSyncChatStatus = (enabled = true) => {
  const viewerId = useUser((state) => state.user?.id);
  const setChatSession = useSupportStore((state) => state.setChatSession);
  return useQuery({
    queryKey: supportKeys.user(viewerId),
    queryFn: async ({ signal }) => {
      const chat = (await API.get<{ data?: ChatSessionWithUser | null }>("/chat/active", { params: {}, signal })).data.data ?? null;
      setChatSession(chat?.status === "open" || chat?.status === "pending" ? chat.status : null);
      return chat;
    },
    enabled: enabled && Boolean(viewerId),
  });
};
// The API resolves the active session by customer user ID, not by session ID.
// sessionId distinguishes replacement conversations in the query cache.
export const useGetChatMessages = (userId?: number, sessionId?: number, enabled = true) => {
  const viewerId = useUser((state) => state.user?.id);
  return useQuery({
    queryKey: supportKeys.messages(userId, sessionId, viewerId),
    queryFn: async ({ signal }) => (await API.get<{ data: Message[] }>("/chat/messages", { params: userParams(userId), signal })).data.data,
    enabled: enabled && Boolean(viewerId) && validUser(userId),
  });
};
export const useGetExistingMessages = useGetChatMessages;
export const useSendMessage = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { sessionId: number; message: string }) => (await API.post<{ data: Message }>("/chat/message", input)).data.data,
    onSuccess: () => client.invalidateQueries({ queryKey: ["support", "messages"] }),
  });
};
export const useGetSupportRequests = (status: ChatStatus = "pending") => {
  const viewerId = useUser((state) => state.user?.id);
  return useQuery({
    queryKey: [...supportKeys.admin(), viewerId, status],
    queryFn: async ({ signal }) => (await API.get<{ data: ChatSessionWithUser[] }>("/chat/requests", { params: { status }, signal })).data.data,
    enabled: Boolean(viewerId),
  });
};
// Backend queues require a status; this helper defaults to pending.
export const useGetAllSupportRequests = () => useGetSupportRequests();
export const useUpdateSupportStatus = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ chatSessionId, chatId, status }: { chatSessionId?: number; chatId?: string | number; status: ChatStatus }) => {
      const id = Number(chatSessionId ?? chatId);
      if (!Number.isInteger(id) || id <= 0) throw new Error("A valid chat session ID is required.");
      return (await API.patch<{ message: string; data: { updatedChatSession: ChatSession; oldStatus: ChatStatus } }>("/chat/request", { chatId: String(id), status })).data;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: supportKeys.all }),
  });
};
export const useUpdateSupportRequest = useUpdateSupportStatus;
