import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../db";
import dashboardService from "./dashboard.service";

describe("DashboardService - Low Stock Metric", () => {
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
    it("includes the Low Stock Items metric card in returned metrics", async () => {
      vi.spyOn(dashboardService, "getTotalRevenue").mockResolvedValue(50000);
      vi.spyOn(dashboardService, "getActiveUsers").mockResolvedValue(120);
      vi.spyOn(dashboardService, "getTotalOrders").mockResolvedValue(80);
      vi.spyOn(dashboardService, "getLowStockItemsCount").mockResolvedValue(4);

      const metrics = await dashboardService.getDashboardMetrics(
        "2026-08-01",
        "2026-08-15",
        1
      );

      expect(metrics).toHaveLength(5);
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
  });
});
