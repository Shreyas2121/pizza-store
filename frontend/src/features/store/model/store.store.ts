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
  isPincodeModalOpen: boolean;
  setPincode: (pincode: string) => Promise<Store | null>;
  previewPincode: (pincode: string) => Promise<Store | null>;
  setResolvedStore: (store: Store, pincode?: string) => void;
  openPincodeModal: () => void;
  closePincodeModal: () => void;
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

const fetchStore = async (pincode: string) => {
  const response = await API.post<ResolveStoreResponse>("/stores/resolve", { pincode });
  return response.data.data;
};

export const useStoreStore = create<StoreState>()(
  persist(
    (set) => ({
      resolvedStore: null,
      userPincode: null,
      isStoreResolved: false,
      isLoading: false,
      resolutionError: null,
      isPincodeModalOpen: false,
      setPincode: async (value) => {
        const pincode = value.trim();
        if (!/^\d{6}$/.test(pincode)) {
          set({ resolutionError: "Enter a valid 6-digit pincode." });
          return null;
        }

        const resolution = ++latestResolution;
        set({ userPincode: pincode, isLoading: true, resolutionError: null });

        try {
          const store = await fetchStore(pincode);
          if (resolution !== latestResolution) return null;

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
      previewPincode: async (value) => {
        const pincode = value.trim();
        if (!/^\d{6}$/.test(pincode)) {
          set({ resolutionError: "Enter a valid 6-digit pincode." });
          return null;
        }

        const resolution = ++latestResolution;
        set({ isLoading: true, resolutionError: null });
        try {
          const store = await fetchStore(pincode);
          if (resolution !== latestResolution) return null;
          set({ isLoading: false, resolutionError: null });
          return store;
        } catch (cause) {
          if (resolution !== latestResolution) return null;
          set({ isLoading: false, resolutionError: getResolutionError(cause) });
          return null;
        }
      },
      setResolvedStore: (store, pincode) => set({
        resolvedStore: store,
        ...(pincode ? { userPincode: pincode } : {}),
        isStoreResolved: true,
        isLoading: false,
        resolutionError: null,
      }),
      openPincodeModal: () => set({ isPincodeModalOpen: true, resolutionError: null }),
      closePincodeModal: () => set({ isPincodeModalOpen: false }),
      clearStore: () => {
        latestResolution += 1;
        set({
          resolvedStore: null,
          userPincode: null,
          isStoreResolved: false,
          isLoading: false,
          resolutionError: null,
          isPincodeModalOpen: true,
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
