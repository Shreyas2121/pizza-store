import { useEffect } from "react";
import { Hourglass, MessageCircle } from "lucide-react";
import { showNotification } from "@mantine/notifications";
import { useMediaQuery } from "@mantine/hooks";
import { useLocation } from "react-router";
import ChatRequest from "./chat-request";
import { useUser } from "@/features/auth";
import { useAuthModalStore } from "@/shared/model";
import { useSocketStore } from "@/store";
import { ChatSession } from "@/lib";
import { Chat } from "@/components/common";

const SupportAction = () => {
  const { openModal } = useAuthModalStore();
  const { chatSession, socket, setChatSession } = useSocketStore();
  const { isLoggedIn } = useUser();
  const location = useLocation();
  const isMobile = useMediaQuery("(max-width: 639px)");
  const aboveCommerceBar = location.pathname === "/cart";

  useEffect(() => {
    if (!socket) return;
    const handleStatusChange = (updatedData: string) => {
      const updatedSession = JSON.parse(updatedData) as ChatSession;
      if (updatedSession.status === "rejected") showNotification({ message: "Your support request could not be accepted.", color: "red" });
      setChatSession(updatedSession.status === "open" || updatedSession.status === "pending" ? updatedSession.status : null);
    };
    socket.on("chatStatusChange", handleStatusChange);
    return () => { socket.off("chatStatusChange", handleStatusChange); };
  }, [socket, setChatSession]);

  if (!isLoggedIn) return null;
  const pending = chatSession === "pending";

  return (
    <button
      type="button"
      disabled={pending}
      aria-label={pending ? "Support request pending" : chatSession === "open" ? "Open support chat" : "Request support"}
      style={{ bottom: aboveCommerceBar ? "calc(max(1rem, env(safe-area-inset-bottom)) + 5.25rem)" : "max(1.5rem, env(safe-area-inset-bottom))" }}
      className="fixed left-4 z-40 flex min-h-11 items-center gap-2 rounded-pill bg-brand px-4 font-semibold text-white shadow-panel transition-colors hover:bg-brand-hover disabled:bg-ink-muted disabled:opacity-90 sm:left-8"
      onClick={() => {
        if (chatSession === "open") {
          openModal({ content: <Chat height={isMobile ? "calc(100dvh - 60px)" : "620px"} />, title: "", options: { size: 480, padding: 0, radius: "lg", fullScreen: isMobile } });
        } else {
          openModal({ content: <ChatRequest />, title: "", options: { size: 440, padding: "lg", radius: "lg" } });
        }
      }}
    >
      {pending ? <Hourglass size={18} /> : <MessageCircle size={19} />}
      <span>{pending ? "Support requested" : chatSession === "open" ? "Support chat" : "Support"}</span>
    </button>
  );
};

export default SupportAction;
