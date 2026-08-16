import { ReactNode } from "react";
import type { ModalProps } from "@mantine/core";
import { create } from "zustand";

export type ModalOptions = Pick<
  ModalProps,
  "size" | "centered" | "closeOnClickOutside" | "fullScreen" | "padding" | "radius"
>;

interface AuthModalState {
  opened: boolean;
  content: ReactNode | null;
  openModal: ({
    title,
    content,
    options,
  }: {
    title: string;
    content: ReactNode;
    options?: ModalOptions;
  }) => void;
  closeModal: () => void;
  title: string;
  options?: ModalOptions;
}

export const useAuthModalStore = create<AuthModalState>((set) => ({
  opened: false,
  content: null,
  title: "",
  options: undefined,
  openModal: ({ title, content, options }) => set({ opened: true, content, title, options }),
  closeModal: () => set({ opened: false, content: null, title: "", options: undefined }),
}));
