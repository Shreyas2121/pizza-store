import { create } from "zustand";
import type { ChatStatus } from "./support.types";

interface SupportState {
  activeChat: boolean;
  setActiveChat: (activeChat: boolean) => void;
  chatSession: ChatStatus | null;
  setChatSession: (chatSession: ChatStatus | null) => void;
}

export const useSupportStore = create<SupportState>((set) => ({
  activeChat: false,
  setActiveChat: (activeChat: boolean) => set({ activeChat }),
  chatSession: null,
  setChatSession: (chatSession) => set({ chatSession }),
}));
