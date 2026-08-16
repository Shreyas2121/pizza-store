import { createQuery } from "@/shared/api";
import { DashCard, GroupT } from "../model/dashboard.types";
import { keepPreviousData } from "@tanstack/react-query";

export const dashboardKeys = {
  all: ["dashboard"] as const,
  cards: (from: Date | null, to: Date | null) => ["dash-home-cards", from, to] as const,
  charts: (from: Date | null, to: Date | null, group: GroupT) =>
    ["dash-home-charts", from, to, group] as const,
};

export const useGetDashboardCardsData = (from: Date | null, to: Date | null) => {
  return createQuery<DashCard[]>(
    dashboardKeys.cards(from, to),
    "/dashboard",
    "data",
    { from, to },
    { placeholderData: keepPreviousData }
  );
};

export const useGetDashboardChartsData = (
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
    dashboardKeys.charts(from, to, group),
    "/dashboard/charts",
    "data",
    {
      from,
      to,
      group,
    },
    { placeholderData: keepPreviousData }
  );
};
