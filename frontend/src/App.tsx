// Importing routes

import { useEffect } from "react";
import { CHAT_API_HOOKS } from "./hooks";
import { useSocketStore, useUser } from "./store";
import { io } from "socket.io-client";
import { Routes } from "react-router";
import { AppRoutes } from "./routes";
import { BASE_URL } from "./lib";
import { GlobalModal } from "./components/common";

function App() {
  const { setSocket } = useSocketStore();
  const { user } = useUser();

  CHAT_API_HOOKS.useSyncChatStatus();

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
    <>
      <GlobalModal />
      <Routes>{AppRoutes()}</Routes>
    </>
  );
}

export default App;
