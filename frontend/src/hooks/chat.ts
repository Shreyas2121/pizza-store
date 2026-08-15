import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createMutation, createQuery } from "./useApi";
import {
  API,
  ChatSession,
  ChatSessionWithUser,
  ChatStatus,
  Message,
  QUERY_KEYS,
} from "@/lib";
import { useSocketStore } from "@/store";

const useChatRequest = () => {
  return createMutation<{
    message: string;
    data: ChatSession;
  }>("/chat/request", "post");
};

const useSyncChatStatus = (enabled: boolean = true) => {
  const { setChatSession } = useSocketStore();
  return useQuery({
    queryKey: [QUERY_KEYS.support.user],
    queryFn: async () => {
      const { data } = await API.get("/chat/active");
      const chat = data.data as ChatSession | undefined;
      if (chat) {
        setChatSession(chat.status === "open" ? "open" : null);
      }
    },
    enabled,
  });
};

const useGetActiveChat = (userId?: number | undefined) => {
  return createQuery<ChatSessionWithUser | undefined>(
    [QUERY_KEYS.support.adminUserChat, userId],
    "/chat/active",
    "data",
    {
      userId,
    }
  );
};

const useGetSupportRequests = (status: ChatStatus) => {
  return createQuery<ChatSessionWithUser[]>(
    [QUERY_KEYS.support.admin, status],
    "/chat/requests",
    "data",
    { status }
  );
};

const useUpdateSupportRequest = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (reqBody: { chatId: string; status: ChatStatus }) => {
      const { data } = await API.patch(`/chat/request`, reqBody);
      return data as {
        message: string;
        data: {
          updatedChatSession: ChatSession;
          oldStatus: ChatStatus;
        };
      };
    },
    onSuccess: (res) => {
      client.invalidateQueries({
        queryKey: [
          QUERY_KEYS.support.admin,
          res.data.updatedChatSession.status,
        ],
      });
      client.invalidateQueries({
        queryKey: [QUERY_KEYS.support.admin, res.data.oldStatus],
      });
    },
  });
};

const useGetExistingMessages = (userId?: number) => {
  return createQuery<Message[]>(
    [QUERY_KEYS.chat.messages, userId],
    "/chat/messages",
    "data",
    {
      userId,
    }
  );
};

const useSendMessage = () => {
  return createMutation<Message>(
    "/chat/message",
    "post",
    [[QUERY_KEYS.chat.messages]],
    "data"
  );
};

export const CHAT_API_HOOKS = {
  useChatRequest,
  useSyncChatStatus,
  useGetActiveChat,
  useGetSupportRequests,
  useUpdateSupportRequest,
  useGetExistingMessages,
  useSendMessage,
};
