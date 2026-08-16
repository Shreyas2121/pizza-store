import { useEffect } from "react";
import { CHAT_API_HOOKS } from "@/hooks";
import { useUser } from "@/features/auth";
import { useSocketStore } from "@/store";
import { io } from "socket.io-client";
import { Routes } from "react-router";
import { AppRoutes } from "./router/routes";
import { BASE_URL } from "@/shared/config";
import { ErrorBoundary, GlobalModal } from "@/shared/ui";

export function App() {
  const { setSocket } = useSocketStore();
  const { user, isLoggedIn } = useUser();

  CHAT_API_HOOKS.useSyncChatStatus(isLoggedIn);

  useEffect(() => {
    const socket = io(BASE_URL);
    setSocket(socket);

    if (user) {
      socket.emit("joinRoom", { userId: user.id });
    }

    return () => {
      socket.disconnect();
    };
  }, [setSocket, user]);

  return (
    <ErrorBoundary>
      <GlobalModal />
      <Routes>{AppRoutes()}</Routes>
    </ErrorBoundary>
  );
}

export default App;
