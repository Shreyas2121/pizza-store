import { ReactNode } from "react";
import { create } from "zustand";

interface AuthModalState {
  opened: boolean;
  content: ReactNode | null;
  openModal: (content: ReactNode) => void;
  closeModal: () => void;
}

export const useAuthModalStore = create<AuthModalState>((set) => ({
  opened: false,
  content: null,
  openModal: (content) => set({ opened: true, content }),
  closeModal: () => set({ opened: false, content: null }),
}));
