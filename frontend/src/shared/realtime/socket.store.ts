import { create } from "zustand";
import type { RealtimeSocket } from "./realtime.types";

interface SocketState {
  socket: RealtimeSocket | null;
  setSocket: (socket: RealtimeSocket | null) => void;
}

export const useSocketStore = create<SocketState>((set) => ({
  socket: null,
  setSocket: (socket) => set({ socket }),
}));
