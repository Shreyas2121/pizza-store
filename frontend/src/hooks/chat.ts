import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API, createMutation, createQuery } from "@/shared/api";
import {
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
        setChatSession(chat.status === "open" || chat.status === "pending" ? chat.status : null);
      } else setChatSession(null);
    },
    enabled,
  });
};

const useGetActiveChat = (userId?: number | undefined) => {
  return createQuery<ChatSessionWithUser | undefined>(
    [QUERY_KEYS.support.adminUserChat, userId],
    `/chat/active/${userId}`,
    "data",
    {},
    { enabled: !!userId }
  );
};

const useGetChatMessages = (chatSessionId: number) => {
  return createQuery<Message[]>(
    [QUERY_KEYS.chat.messages, chatSessionId],
    `/chat/messages/${chatSessionId}`,
    "data",
    {},
    { enabled: !!chatSessionId }
  );
};

const useGetExistingMessages = (userId?: number) => {
  return createQuery<Message[]>(
    [QUERY_KEYS.chat.messages, userId],
    userId ? `/chat/messages/user/${userId}` : "/chat/messages",
    "data"
  );
};

const useSendMessage = () => {
  return createMutation<Message>(
    "/chat/send",
    "post"
  );
};

const useGetAllSupportRequests = () => {
  return createQuery<ChatSessionWithUser[]>(
    [QUERY_KEYS.support.admin],
    "/chat/all",
    "data"
  );
};

const useGetSupportRequests = (status?: string) => {
  return createQuery<ChatSessionWithUser[]>(
    [QUERY_KEYS.support.admin, status],
    `/chat/all${status ? `?status=${status}` : ""}`,
    "data"
  );
};

const useUpdateSupportStatus = () => {
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
        queryKey: [QUERY_KEYS.support.admin],
      });
    },
  });
};

const useUpdateSupportRequest = useUpdateSupportStatus;

export const CHAT_API_HOOKS = {
  useChatRequest,
  useSyncChatStatus,
  useGetActiveChat,
  useGetChatMessages,
  useGetExistingMessages,
  useSendMessage,
  useGetAllSupportRequests,
  useGetSupportRequests,
  useUpdateSupportStatus,
  useUpdateSupportRequest,
};
