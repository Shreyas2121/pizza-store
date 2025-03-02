import { GroupT } from "@/lib/types";
import { create } from "zustand";

interface DatePickerState {
  dates: [Date | null, Date | null];
  setDates: (dates: [Date | null, Date | null]) => void;
  group: GroupT;
  setGroup: (group: GroupT) => void;
}

export const useDatePicker = create<DatePickerState>((set) => {
  const to = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - 1);

  return {
    dates: [from, to],
    setDates: (dates: [Date | null, Date | null]) => set({ dates }),
    group: "daily",
    setGroup: (group: GroupT) => set({ group }),
  };
});
