import { Router } from "express";
import { AppError, asyncHandler } from "../../utils/error";
import dashboardService from "./dashboard.service";
import type { AuthenticatedRequest, GroupT } from "../../utils/types";
import { formatPeriod } from "../../utils";
import { authenticateUser } from "../../middleware/authenticateUser";
import { parseIntegerParam } from "../../utils/request";
import authorizationService, { authenticationRequired } from "../access/access.service";

export const dashRoutes = Router();

dashRoutes.get(
  "/",
  authenticateUser,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.principal) throw authenticationRequired();

    const query = req.query;
    const from = query.from as string;
    const to = query.to as string;
    const isPlatformAdmin = req.principal.platformRole === "admin";

    let storeId: number | undefined;
    if (query.storeId !== undefined) {
      if (typeof query.storeId !== "string") {
        throw new AppError("Store ID must be a positive integer", 400);
      }
      storeId = parseIntegerParam(query.storeId, "Store ID");
    }

    let hasFinanceAccess = true;

    if (!isPlatformAdmin) {
      if (storeId === undefined) {
        throw new AppError(
          "Store ID is required for staff dashboard access",
          400,
          "STORE_ID_REQUIRED"
        );
      }
      await authorizationService.requireStorePermission({
        principal: req.principal,
        storeId,
        permission: "dashboard.operations.read",
      });

      hasFinanceAccess = await authorizationService.hasStorePermission(
        req.principal,
        storeId,
        "dashboard.finance.read"
      );
    }

    const data = await dashboardService.getDashboardMetrics({
      from,
      to,
      storeId,
      includeFinance: hasFinanceAccess,
    });

    res.json({ data });
  })
);

dashRoutes.get(
  "/charts",
  authenticateUser,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.principal) throw authenticationRequired();

    const query = req.query;

    const from = query.from as string;
    const to = query.to as string;
    const group = query.group as GroupT;
    const isPlatformAdmin = req.principal.platformRole === "admin";

    let storeId: number | undefined;
    if (query.storeId !== undefined) {
      if (typeof query.storeId !== "string") {
        throw new AppError("Store ID must be a positive integer", 400);
      }
      storeId = parseIntegerParam(query.storeId, "Store ID");
    }

    let hasFinanceAccess = true;

    if (!isPlatformAdmin) {
      if (storeId === undefined) {
        throw new AppError(
          "Store ID is required for staff dashboard access",
          400,
          "STORE_ID_REQUIRED"
        );
      }
      await authorizationService.requireStorePermission({
        principal: req.principal,
        storeId,
        permission: "dashboard.operations.read",
      });

      hasFinanceAccess = await authorizationService.hasStorePermission(
        req.principal,
        storeId,
        "dashboard.finance.read"
      );
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);

    const currentParam = {
      from: fromDate,
      to: toDate,
      group,
      storeId,
    };

    const ordersOverTime = await dashboardService.getOrdersOverTime(
      currentParam
    );

    const formattedOrders = ordersOverTime.map((o) => ({
      period: formatPeriod(o.period, group),
      orders: o.orders,
    }));

    if (!hasFinanceAccess) {
      return res.json({
        data: {
          ordersOverTime: formattedOrders,
        },
      });
    }

    const revenueOverTime = await dashboardService.getRevenueOverTime(
      currentParam
    );

    const formattedRevenue = revenueOverTime.map((r) => ({
      period: formatPeriod(r.period, group),
      revenue: r.revenue,
    }));

    res.json({
      data: {
        revenueOverTime: formattedRevenue,
        ordersOverTime: formattedOrders,
      },
    });
  })
);
