import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API, createMutation, createQuery } from "@/shared/api";
import { useSocketStore } from "../model/support.store";

import {
  ChatSession,
  ChatSessionWithUser,
  ChatStatus,
  Message,
} from "../model/support.types";

export const supportKeys = {
  all: ["support"] as const,
  user: () => ["user-support"] as const,
  admin: () => ["all-support"] as const,
  adminUserChat: (userId?: number) => ["admin-user-chat", userId] as const,
  messages: (id?: number) => ["chat-messages", id] as const,
};

export const useChatRequest = () => {
  return createMutation<{
    message: string;
    data: ChatSession;
  }>("/chat/request", "post");
};

export const useSyncChatStatus = (enabled: boolean = true) => {
  const { setChatSession } = useSocketStore();
  return useQuery({
    queryKey: supportKeys.user(),
    queryFn: async () => {
      const { data } = await API.get("/chat/active");
      const chat = data.data as ChatSession | undefined;
      if (chat) {
        setChatSession(chat.status === "open" || chat.status === "pending" ? chat.status : null);
      } else setChatSession(null);
    },
    enabled,
  });
};

export const useGetActiveChat = (userId?: number | undefined) => {
  return createQuery<ChatSessionWithUser | undefined>(
    supportKeys.adminUserChat(userId),
    `/chat/active/${userId}`,
    "data",
    {},
    { enabled: !!userId }
  );
};

export const useGetChatMessages = (chatSessionId: number) => {
  return createQuery<Message[]>(
    supportKeys.messages(chatSessionId),
    `/chat/messages/${chatSessionId}`,
    "data",
    {},
    { enabled: !!chatSessionId }
  );
};

export const useGetExistingMessages = (userId?: number) => {
  return createQuery<Message[]>(
    supportKeys.messages(userId),
    userId ? `/chat/messages/user/${userId}` : "/chat/messages",
    "data"
  );
};

export const useSendMessage = () => {
  return createMutation<Message>(
    "/chat/send",
    "post"
  );
};

export const useGetAllSupportRequests = () => {
  return createQuery<ChatSessionWithUser[]>(
    supportKeys.admin(),
    "/chat/all",
    "data"
  );
};

export const useGetSupportRequests = (status?: string) => {
  return createQuery<ChatSessionWithUser[]>(
    [...supportKeys.admin(), status],
    `/chat/all${status ? `?status=${status}` : ""}`,
    "data",
    undefined,
    { placeholderData: keepPreviousData }
  );
};

export const useUpdateSupportStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      chatSessionId,
      chatId,
      status,
    }: {
      chatSessionId?: number;
      chatId?: string | number;
      status: ChatStatus;
    }) => {
      const id = chatSessionId ?? chatId;
      const { data } = await API.patch(`/chat/status/${id}`, {
        status,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: supportKeys.admin(),
      });
    },
  });
};

export const useUpdateSupportRequest = useUpdateSupportStatus;
