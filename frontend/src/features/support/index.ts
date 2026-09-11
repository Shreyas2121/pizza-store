export { SupportAction, ChatRequestForm } from "./components/chat-widget";
export { Chat } from "./components/chat";
export { SupportStatusPill } from "./components/admin/support-status-pill";

export { SupportActions } from "./components/admin/support-actions";
export {
  adminSupportColumns,
  getPriority,
  getWaitTime,
} from "./components/admin/admin-support-columns";

export { AdminSupportPage } from "./pages/admin-support-page";
export { AdminChatPage } from "./pages/admin-chat-page";

export {
  supportKeys,
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
} from "./api/chat.queries";

export { useSupportStore } from "./model/support.store";
export type {
  ChatStatus,
  ChatSession,
  ChatSessionWithUser,
  Message,
} from "./model/support.types";
export { chatStatus } from "./model/support.types";
