
import { DashCard, GroupT, QUERY_KEYS } from "@/lib";
import { createQuery } from "./useApi";

const useGetDashboardCardsData = (from: Date | null, to: Date | null) => {
  return createQuery<DashCard[]>(
    [QUERY_KEYS.dashboard.homeCards, from, to],
    "/dashboard",
    "data",
    { from, to }
  );
};

const useGetDashboardChartsData = (
  from: Date | null,
  to: Date | null,
  group: GroupT
) => {
  return createQuery<{
    revenueOverTime: {
      period: string;
      revenue: number;
    }[];
    ordersOverTime: {
      period: string;
      orders: number;
    }[];
  }>(
    [QUERY_KEYS.dashboard.homeCharts, from, to, group],
    "/dashboard/charts",
    "data",
    {
      from,
      to,
      group,
    }
  );
};

export const DASHBOARD_API_HOOKS = {
  useGetDashboardCardsData,
  useGetDashboardChartsData,
};
