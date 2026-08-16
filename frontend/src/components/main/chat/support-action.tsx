import { MessageCircle } from "lucide-react";
import ChatRequest from "./chat-request";
import { useEffect } from "react";
import { showNotification } from "@mantine/notifications";
import { useAuthModalStore, useSocketStore, useUser } from "@/store";
import { ChatSession } from "@/lib";
import { Chat } from "@/components/common";

const SupportAction = () => {
  const { openModal } = useAuthModalStore();
  const { chatSession, socket, setChatSession } = useSocketStore();
  const { isLoggedIn } = useUser();

  useEffect(() => {
    if (socket) {
      socket.on("chatStatusChange", (updatedData) => {
        const chatSession = JSON.parse(updatedData) as ChatSession;
        if (chatSession.status === "rejected") {
          showNotification({
            message: "Your chat request has been rejected.",
            variant: "error",
          });
        }
        setChatSession(chatSession.status === "open" ? "open" : null);
      });
    }
  }, [socket]);

  if (!isLoggedIn || chatSession === "pending") return null;

  return (
    <button
      className="
        fixed bottom-10 right-10
        flex items-center space-x-2
        bg-brand text-white
        px-4 py-2 rounded-full
        shadow-lg hover:bg-brand-hover
        transition-colors
        z-[999]
      "
      onClick={() => {
        if (chatSession === "open") {
          openModal({
            content: <Chat height="100%" width="100%" />,
            title: "",
          });
        } else {
          openModal({
            content: <ChatRequest />,
            title: "",
          });
        }
      }}
    >
      <MessageCircle size={20} />
      <span>{chatSession === "open" ? "Chat" : "Support"}</span>
    </button>
  );
};

export default SupportAction;
