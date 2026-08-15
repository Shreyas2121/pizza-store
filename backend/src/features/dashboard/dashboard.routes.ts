import { Router } from "express";
import { asyncHandler } from "../../utils/error";
import dashboardService from "./dashboard.service";
import { differenceInCalendarDays, subDays } from "date-fns";
import { GroupT } from "../../utils/types";
import { formatNumber, formatPeriod, formatPrice } from "../../utils";
import { authenticateAdmin } from "../../middleware/authenticeUser";

export const dashRoutes = Router();

dashRoutes.get(
  "/",
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const query = req.query;

    const from = query.from as string;
    const to = query.to as string;
    const group = query.group as GroupT;

    const fromDate = new Date(from);
    const toDate = new Date(to);

    // Then:
    const daysDiff = differenceInCalendarDays(toDate, fromDate) + 1;

    const prevFrom = subDays(fromDate, daysDiff);
    const prevTo = subDays(toDate, daysDiff);

    const currentParam = {
      from: fromDate,
      to: toDate,
    };

    const prevParam = {
      from: prevFrom,
      to: prevTo,
    };

    const currentRevenue = await dashboardService.getTotalRevenue(currentParam);

    const activeUsers = await dashboardService.getActiveUsers(currentParam);

    const currentTotalOrders = await dashboardService.getTotalOrders(
      currentParam
    );

    const currentAOV =
      currentTotalOrders === 0 ? 0 : currentRevenue / currentTotalOrders;

    const previousRevenue = await dashboardService.getTotalRevenue(prevParam);

    const prevActiveUsers = await dashboardService.getActiveUsers(prevParam);

    const previousTotalOrders = await dashboardService.getTotalOrders(
      prevParam
    );

    const previousAOV =
      previousTotalOrders === 0 ? 0 : previousRevenue / previousTotalOrders;

    function renderRes(
      type: "price" | "number",
      curr: number,
      prev: number,
      icon: {
        name: string;
        color: string;
      }
    ) {
      const percentageChange = prev === 0 ? 0 : ((curr - prev) / prev) * 100;
      return {
        current: type === "price" ? formatPrice(curr) : formatNumber(curr),
        previous: type === "price" ? formatPrice(prev) : formatNumber(prev),
        isLow: curr < prev,
        percentage:
          prev === 0 ? "N/A" : `${Math.abs(percentageChange).toFixed(1)}%`,
        icon,
      };
    }

    res.json({
      data: [
        {
          label: "Revenue",
          data: renderRes("price", currentRevenue, previousRevenue, {
            name: "dollar-sign",
            color: "green",
          }),
        },
        {
          label: "Active Users",
          data: renderRes("number", activeUsers, prevActiveUsers, {
            name: "users",
            color: "blue",
          }),
        },
        {
          label: "Total Orders",
          data: renderRes("number", currentTotalOrders, previousTotalOrders, {
            name: "shopping-cart",
            color: "orange",
          }),
        },
        {
          label: "Average Order Value",
          data: renderRes("price", currentAOV, previousAOV, {
            name: "credit-card",
            color: "teal",
          }),
        },
      ],
    });
  })
);

dashRoutes.get(
  "/charts",
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const query = req.query;

    const from = query.from as string;
    const to = query.to as string;
    const group = query.group as GroupT;

    const fromDate = new Date(from);
    const toDate = new Date(to);

    const currentParam = {
      from: fromDate,
      to: toDate,
      group,
    };

    const revenueOverTime = await dashboardService.getRevenueOverTime(
      currentParam
    );

    const ordersOverTime = await dashboardService.getOrdersOverTime(
      currentParam
    );

    res.json({
      data: {
        revenueOverTime: revenueOverTime.map((r) => ({
          period: formatPeriod(r.period, group),
          revenue: r.revenue,
        })),
        ordersOverTime : ordersOverTime.map((o) => ({
          period : formatPeriod(o.period,group),
          orders : o.orders
        }))
      },
    });
  })
);
