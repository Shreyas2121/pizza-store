export type GroupT = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

export interface DashCard {
  label: string;
  data: {
    current: string;
    previous: string;
    percentage: string;
    isLow: boolean;
    icon: {
      name: string;
      color: string;
    };
  };
}
