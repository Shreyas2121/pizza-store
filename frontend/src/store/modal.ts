import { ReactNode } from "react";
import { create } from "zustand";

interface AuthModalState {
  opened: boolean;
  content: ReactNode | null;
  openModal: ({
    title,
    content,
  }: {
    title: string;
    content: ReactNode;
  }) => void;
  closeModal: () => void;
  title: string;
}

export const useAuthModalStore = create<AuthModalState>((set) => ({
  opened: false,
  content: null,
  title: "",
  openModal: ({ title, content }) => set({ opened: true, content, title }),
  closeModal: () => set({ opened: false, content: null }),
}));
