import axios from "axios";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { API } from "@/shared/api";
import type { Store } from "./store.types";

interface ResolveStoreResponse {
  data: Store;
}

interface StoreState {
  resolvedStore: Store | null;
  userPincode: string | null;
  isStoreResolved: boolean;
  isLoading: boolean;
  resolutionError: string | null;
  setPincode: (pincode: string) => Promise<Store | null>;
  setResolvedStore: (store: Store) => void;
  clearStore: () => void;
}

let latestResolution = 0;

const getResolutionError = (cause: unknown) => {
  if (axios.isAxiosError<{ message?: string; errors?: Array<{ message?: string }> }>(cause)) {
    return cause.response?.data.message
      ?? cause.response?.data.errors?.[0]?.message
      ?? "We couldn't find a store for that pincode.";
  }

  return "We couldn't find a store for that pincode.";
};

export const useStoreStore = create<StoreState>()(
  persist(
    (set) => ({
      resolvedStore: null,
      userPincode: null,
      isStoreResolved: false,
      isLoading: false,
      resolutionError: null,
      setPincode: async (value) => {
        const pincode = value.trim();
        if (!/^\d{6}$/.test(pincode)) {
          set({ resolutionError: "Enter a valid 6-digit pincode." });
          return null;
        }

        const resolution = ++latestResolution;
        set({ userPincode: pincode, isLoading: true, resolutionError: null });

        try {
          const response = await API.post<ResolveStoreResponse>("/stores/resolve", { pincode });
          if (resolution !== latestResolution) return null;

          const store = response.data.data;
          set({
            resolvedStore: store,
            userPincode: pincode,
            isStoreResolved: true,
            isLoading: false,
            resolutionError: null,
          });
          return store;
        } catch (cause) {
          if (resolution !== latestResolution) return null;

          set({
            resolvedStore: null,
            isStoreResolved: false,
            isLoading: false,
            resolutionError: getResolutionError(cause),
          });
          return null;
        }
      },
      setResolvedStore: (store) => set({
        resolvedStore: store,
        isStoreResolved: true,
        isLoading: false,
        resolutionError: null,
      }),
      clearStore: () => {
        latestResolution += 1;
        set({
          resolvedStore: null,
          userPincode: null,
          isStoreResolved: false,
          isLoading: false,
          resolutionError: null,
        });
      },
    }),
    {
      name: "store-context",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ resolvedStore, userPincode }) => ({ resolvedStore, userPincode }),
      onRehydrateStorage: () => (state) => {
        if (state?.resolvedStore) state.setResolvedStore(state.resolvedStore);
      },
    },
  ),
);
