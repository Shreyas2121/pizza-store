import { Router } from "express";
import { asyncHandler } from "../../utils/error";
import dashboardService from "./dashboard.service";
import { differenceInCalendarDays, subDays } from "date-fns";
import { GroupT } from "../../utils/types";
import { formatNumber, formatPeriod, formatPrice } from "../../utils";
import { authenticateAdmin } from "../../middleware/authenticateUser";

export const dashRoutes = Router();

dashRoutes.get(
  "/",
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const query = req.query;
    const from = query.from as string;
    const to = query.to as string;

    const data = await dashboardService.getDashboardMetrics(from, to);

    res.json({ data });
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
