import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { User } from "../lib/types";

type Store = {
  user: User | null;
  isLoggedIn: boolean;
  token: string;
  login: ({ data, token }: { data: User; token: string }) => void;
  logout: () => void;
};

export const useUser = create<Store>()(
  persist(
    (set) => ({
      user: null,
      isLoggedIn: false,
      token: "",
      login: ({ data, token }) => {
        set({
          user: data,
          isLoggedIn: true,
          token,
        });
      },
      logout: () => {
        set({
          user: null,
          isLoggedIn: false,
          token: "",
        });
      },
    }),
    {
      name: "user-storage",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
