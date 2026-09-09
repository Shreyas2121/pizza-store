import { useEffect } from "react";
import { io } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { accessKeys } from "@/features/access";
import { useUser } from "@/features/auth";
import { useSocketStore, useSyncChatStatus } from "@/features/support";
import { BASE_URL } from "@/shared/config";
import { useAuthModalStore } from "@/shared/model";
import { GlobalModal } from "@/shared/ui";

// Mounted only on business routes, so docs do not subscribe to authenticated
// chat queries, connect sockets, or render a previously opened app modal.
export function BusinessRuntime() {
  const token = useUser((state) => state.token);
  const isLoggedIn = useUser((state) => state.isLoggedIn);
  const setSocket = useSocketStore((state) => state.setSocket);
  const closeModal = useAuthModalStore((state) => state.closeModal);
  const queryClient = useQueryClient();

  useSyncChatStatus(isLoggedIn);

  useEffect(() => {
    if (!token) {
      setSocket(null);
      return;
    }

    const socket = io(BASE_URL, { auth: { token } });
    setSocket(socket);

    const refreshAccess = () => {
      void queryClient.invalidateQueries({ queryKey: accessKeys.me() });
    };
    socket.on("connect", refreshAccess);
    socket.on("disconnect", refreshAccess);
    socket.on("connect_error", refreshAccess);

    return () => {
      socket.off("connect", refreshAccess);
      socket.off("disconnect", refreshAccess);
      socket.off("connect_error", refreshAccess);
      socket.disconnect();
      if (useSocketStore.getState().socket === socket) {
        setSocket(null);
      }
    };
  }, [queryClient, setSocket, token]);

  useEffect(() => () => closeModal(), [closeModal]);

  return <GlobalModal />;
}
