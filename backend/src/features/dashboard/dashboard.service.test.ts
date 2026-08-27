import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../db";
import dashboardService from "./dashboard.service";

describe("DashboardService unit tests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("getLowStockItemsCount", () => {
    it("counts tracked, active store products whose available quantity is at or below threshold", async () => {
      vi.spyOn(db, "select").mockImplementation(((fields: any) => ({
        from: () => ({
          where: () => ({
            groupBy: () => ({
              as: () => ({}),
            }),
          }),
          innerJoin: () => ({
            leftJoin: () => ({
              where: vi.fn().mockResolvedValue([{ total: 3 }]),
            }),
          }),
        }),
      })) as any);

      const count = await dashboardService.getLowStockItemsCount({ storeId: 1 });
      expect(count).toBe(3);
    });

    it("works globally when no storeId is provided", async () => {
      vi.spyOn(db, "select").mockImplementation(((fields: any) => ({
        from: () => ({
          where: () => ({
            groupBy: () => ({
              as: () => ({}),
            }),
          }),
          innerJoin: () => ({
            leftJoin: () => ({
              where: vi.fn().mockResolvedValue([{ total: 5 }]),
            }),
          }),
        }),
      })) as any);

      const count = await dashboardService.getLowStockItemsCount();
      expect(count).toBe(5);
    });
  });

  describe("getDashboardMetrics", () => {
    it("returns all 5 metric cards including finance metrics when includeFinance is true", async () => {
      vi.spyOn(dashboardService, "getTotalRevenue").mockResolvedValue(50000);
      vi.spyOn(dashboardService, "getActiveUsers").mockResolvedValue(120);
      vi.spyOn(dashboardService, "getTotalOrders").mockResolvedValue(80);
      vi.spyOn(dashboardService, "getLowStockItemsCount").mockResolvedValue(4);

      const metrics = await dashboardService.getDashboardMetrics({
        from: "2026-08-01",
        to: "2026-08-15",
        storeId: 1,
        includeFinance: true,
      });

      expect(metrics).toHaveLength(5);
      expect(metrics.map((m) => m.label)).toEqual([
        "Revenue",
        "Active Users",
        "Total Orders",
        "Average Order Value",
        "Low Stock Items",
      ]);

      const lowStockCard = metrics.find((m) => m.label === "Low Stock Items");
      expect(lowStockCard).toBeDefined();
      expect(lowStockCard?.data).toMatchObject({
        current: "4",
        previous: "Real-time",
        isLow: true,
        percentage: "N/A",
        icon: {
          name: "alert-triangle",
          color: "red",
        },
      });
    });

    it("omits financial fields server-side when includeFinance is false", async () => {
      const getRevenueSpy = vi
        .spyOn(dashboardService, "getTotalRevenue")
        .mockResolvedValue(50000);
      vi.spyOn(dashboardService, "getActiveUsers").mockResolvedValue(120);
      vi.spyOn(dashboardService, "getTotalOrders").mockResolvedValue(80);
      vi.spyOn(dashboardService, "getLowStockItemsCount").mockResolvedValue(4);

      const metrics = await dashboardService.getDashboardMetrics({
        from: "2026-08-01",
        to: "2026-08-15",
        storeId: 1,
        includeFinance: false,
      });

      expect(metrics).toHaveLength(3);
      expect(metrics.map((m) => m.label)).toEqual([
        "Active Users",
        "Total Orders",
        "Low Stock Items",
      ]);
      expect(getRevenueSpy).not.toHaveBeenCalled();
    });

    it("applies storeId to current and previous comparison ranges", async () => {
      const getActiveUsersSpy = vi
        .spyOn(dashboardService, "getActiveUsers")
        .mockResolvedValue(50);
      const getTotalOrdersSpy = vi
        .spyOn(dashboardService, "getTotalOrders")
        .mockResolvedValue(30);
      vi.spyOn(dashboardService, "getLowStockItemsCount").mockResolvedValue(2);

      await dashboardService.getDashboardMetrics({
        from: "2026-08-01",
        to: "2026-08-15",
        storeId: 3,
        includeFinance: false,
      });

      expect(getActiveUsersSpy).toHaveBeenCalledWith(
        expect.objectContaining({ storeId: 3 })
      );
      expect(getTotalOrdersSpy).toHaveBeenCalledWith(
        expect.objectContaining({ storeId: 3 })
      );
    });
  });
});
