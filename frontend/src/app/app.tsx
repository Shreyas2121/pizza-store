import { Suspense, useEffect } from "react";
import { useUser } from "@/features/auth";
import { useSocketStore, useSyncChatStatus } from "@/features/support";
import { io } from "socket.io-client";
import { Routes } from "react-router";
import { AppRoutes } from "./router/routes";
import { ScrollManager } from "./router/scroll-manager";
import { BASE_URL } from "@/shared/config";
import { ErrorBoundary, GlobalModal, RouteSkeleton } from "@/shared/ui";

export function App() {
  const { setSocket } = useSocketStore();
  const { user, isLoggedIn } = useUser();

  useSyncChatStatus(isLoggedIn);


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
      <ScrollManager />
      <GlobalModal />
      <Suspense fallback={<RouteSkeleton />}>
        <Routes>{AppRoutes()}</Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;
