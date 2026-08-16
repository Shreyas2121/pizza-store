import { create } from "zustand";
import { Socket } from "socket.io-client";
import { ChatStatus } from "./support.types";

interface SocketState {
  socket: Socket | null;
  setSocket: (socket: Socket) => void;
  activeChat: boolean;
  setActiveChat: (activeChat: boolean) => void;
  chatSession: ChatStatus | null;
  setChatSession: (chatSession: ChatStatus | null) => void;
}

export const useSocketStore = create<SocketState>((set) => ({
  socket: null,
  setSocket: (socket: Socket) => set({ socket }),
  activeChat: false,
  setActiveChat: (activeChat: boolean) => set({ activeChat }),
  chatSession: null,
  setChatSession: (chatSession) => set({ chatSession }),
}));
