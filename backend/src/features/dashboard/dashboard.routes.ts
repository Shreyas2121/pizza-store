import { Router } from "express";
import { AppError, asyncHandler } from "../../utils/error";
import dashboardService from "./dashboard.service";
import { GroupT } from "../../utils/types";
import { formatPeriod } from "../../utils";
import { authenticateAdmin } from "../../middleware/authenticateUser";
import { parseIntegerParam } from "../../utils/request";

export const dashRoutes = Router();

dashRoutes.get(
  "/",
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const query = req.query;
    const from = query.from as string;
    const to = query.to as string;
    let storeId: number | undefined;
    if (query.storeId !== undefined) {
      if (typeof query.storeId !== "string") {
        throw new AppError("Store ID must be a positive integer", 400);
      }
      storeId = parseIntegerParam(query.storeId, "Store ID");
    }

    const data = await dashboardService.getDashboardMetrics(from, to, storeId);

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
    let storeId: number | undefined;
    if (query.storeId !== undefined) {
      if (typeof query.storeId !== "string") {
        throw new AppError("Store ID must be a positive integer", 400);
      }
      storeId = parseIntegerParam(query.storeId, "Store ID");
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);

    const currentParam = {
      from: fromDate,
      to: toDate,
      group,
      storeId,
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
