import { API } from "@/lib/axios";
import { QUERY_KEYS } from "@/lib/constants";
import { DashCard, GroupT } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";

export const useGetDashboardCardsData = (
  from: Date | null,
  to: Date | null
) => {
  return useQuery({
    queryKey: [QUERY_KEYS.dashboard.homeCards, from, to],
    queryFn: async () => {
      const data = await API.get("/dashboard", {
        params: {
          from,
          to,
        },
      });

      return data.data.data as DashCard[];
    },
  });
};

export const useGetDashboardChartsData = (
  from: Date | null,
  to: Date | null,
  group: GroupT
) => {
  return useQuery({
    queryKey: [QUERY_KEYS.dashboard.homeCharts, from, to, group],
    queryFn: async () => {
      const { data } = await API.get("/dashboard/charts", {
        params: {
          from,
          to,
          group,
        },
      });

      return data.data as {
        revenueOverTime: {
          period: string;
          revenue: number;
        }[];
        ordersOverTime: {
          period: string;
          orders: number;
        }[];
      };
    },
  });
};
