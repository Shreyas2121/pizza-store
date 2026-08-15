// Importing routes

import { useEffect } from "react";
import { CHAT_API_HOOKS } from "./hooks";
import { useSocketStore, useUser } from "./store";
import { io } from "socket.io-client";
import { Routes } from "react-router";
import { AppRoutes } from "./routes";
import { BASE_URL } from "./lib";
import { ErrorBoundary, GlobalModal } from "./components/common";

function App() {
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
