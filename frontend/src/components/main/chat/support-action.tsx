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
    if (!socket) return;

    const handleStatusChange = (updatedData: string) => {
      const updatedSession = JSON.parse(updatedData) as ChatSession;
      if (updatedSession.status === "rejected") {
        showNotification({
          message: "Your chat request has been rejected.",
          color: "red",
        });
      }
      setChatSession(updatedSession.status === "open" ? "open" : null);
    };

    socket.on("chatStatusChange", handleStatusChange);
    return () => {
      socket.off("chatStatusChange", handleStatusChange);
    };
  }, [socket, setChatSession]);

  if (!isLoggedIn || chatSession === "pending") return null;

  return (
    <button
      type="button"
      aria-label={chatSession === "open" ? "Open support chat" : "Request support"}
      className="
        fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-6 sm:bottom-[max(2rem,env(safe-area-inset-bottom))] sm:left-8
        flex items-center space-x-2
        bg-brand text-white
        px-4 py-2.5 rounded-pill
        shadow-panel hover:bg-brand-hover
        transition-all duration-200
        z-40
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
            options: { size: 440, padding: "lg", radius: "lg" },
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
