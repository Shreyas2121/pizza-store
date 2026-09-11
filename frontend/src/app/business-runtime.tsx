import { useEffect } from "react";
import { io } from "socket.io-client";
import * as msgpackParser from "socket.io-msgpack-parser";
import { useQueryClient } from "@tanstack/react-query";
import { accessKeys } from "@/features/access";
import { useUser } from "@/features/auth";
import { useSyncChatStatus } from "@/features/support";
import { BASE_URL } from "@/shared/config";
import { info } from "@/shared/lib";
import { useAuthModalStore } from "@/shared/model";
import { GlobalModal } from "@/shared/ui";
import {
  RealtimeEvents,
  type MembershipChangedPayload,
  type RealtimeSocket,
  useSocketEvent,
  useSocketStore,
} from "@/shared/realtime";

// Mounted only on business routes, so docs do not subscribe to authenticated
// chat queries, connect sockets, or render a previously opened app modal.
export function BusinessRuntime() {
  const token = useUser((state) => state.token);
  const isLoggedIn = useUser((state) => state.isLoggedIn);
  const setSocket = useSocketStore((state) => state.setSocket);
  const closeModal = useAuthModalStore((state) => state.closeModal);
  const queryClient = useQueryClient();

  useSyncChatStatus(isLoggedIn);
  useSocketEvent(
    RealtimeEvents.membershipChanged,
    (event: MembershipChangedPayload) => {
      info(event.message, "Access updated");
      void queryClient.invalidateQueries({ queryKey: accessKeys.me() });
    }
  );

  useEffect(() => {
    if (!token) {
      setSocket(null);
      return;
    }

    const socket = io(BASE_URL, {
      auth: { token },
      parser: msgpackParser,
    }) as RealtimeSocket;
    setSocket(socket);

    let hasConnected = false;

    const refreshAccess = () => {
      void queryClient.invalidateQueries({ queryKey: accessKeys.me() });
    };
    const handleConnect = () => {
      refreshAccess();
      if (hasConnected) {
        // Socket.IO does not replay every event missed while disconnected.
        // Refresh active screens once transport connectivity is restored.
        void queryClient.invalidateQueries({ refetchType: "active" });
      }
      hasConnected = true;
    };
    const handleDisconnect = (reason: string) => {
      refreshAccess();
      if (reason === "io server disconnect") {
        socket.connect();
      }
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", refreshAccess);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
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
