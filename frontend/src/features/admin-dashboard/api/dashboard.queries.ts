import { createQuery } from "@/shared/api";
import { DashCard, GroupT } from "../model/dashboard.types";
import { keepPreviousData } from "@tanstack/react-query";

export const dashboardKeys = {
  all: ["dashboard"] as const,
  cards: (from: Date | null, to: Date | null, storeId?: number | null) =>
    ["dash-home-cards", from, to, storeId] as const,
  charts: (
    from: Date | null,
    to: Date | null,
    group: GroupT,
    storeId?: number | null
  ) => ["dash-home-charts", from, to, group, storeId] as const,
};

export const useGetDashboardCardsData = (
  from: Date | null,
  to: Date | null,
  storeId?: number | null
) => {
  return createQuery<DashCard[]>(
    dashboardKeys.cards(from, to, storeId),
    "/dashboard",
    "data",
    {
      from,
      to,
      ...(storeId ? { storeId } : {}),
    },
    { placeholderData: keepPreviousData }
  );
};

export const useGetDashboardChartsData = (
  from: Date | null,
  to: Date | null,
  group: GroupT,
  storeId?: number | null
) => {
  return createQuery<{
    revenueOverTime?: {
      period: string;
      revenue: number;
    }[];
    ordersOverTime: {
      period: string;
      orders: number;
    }[];
  }>(
    dashboardKeys.charts(from, to, group, storeId),
    "/dashboard/charts",
    "data",
    {
      from,
      to,
      group,
      ...(storeId ? { storeId } : {}),
    },
    { placeholderData: keepPreviousData }
  );
};
