import { create } from "zustand";
import { persist } from "zustand/middleware";

interface StaffActiveStoreState {
  activeStoreId: number | null;
  setActiveStoreId: (storeId: number | null) => void;
  clearActiveStore: () => void;
}

export const useStaffActiveStore = create<StaffActiveStoreState>()(
  persist(
    (set) => ({
      activeStoreId: null,
      setActiveStoreId: (activeStoreId) => set({ activeStoreId }),
      clearActiveStore: () => set({ activeStoreId: null }),
    }),
    {
      name: "staff-active-store-storage",
    }
  )
);
