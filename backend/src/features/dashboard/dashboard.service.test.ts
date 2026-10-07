import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../db";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { ordersTable } from "../../db/schema";
import dashboardService, {
  EXCLUDED_DASHBOARD_ORDER_STATUSES,
  getEligibleOrderFilters,
} from "./dashboard.service";

describe("DashboardService unit tests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("getEligibleOrderFilters", () => {
    it("defines excluded statuses as cancelled and awaiting_payment", () => {
      expect(EXCLUDED_DASHBOARD_ORDER_STATUSES).toEqual([
        "cancelled",
        "awaiting_payment",
      ]);
    });

    it("generates SQL condition excluding cancelled and awaiting_payment orders with date bounds", () => {
      const from = new Date("2026-08-01T00:00:00.000Z");
      const to = new Date("2026-08-15T23:59:59.999Z");

      const filter = getEligibleOrderFilters({ from, to });
      const query = db.select().from(ordersTable).where(filter).toSQL();

      expect(query.sql).toContain('"orders"."status" not in ($3, $4)');
      expect(query.params).toContain("cancelled");
      expect(query.params).toContain("awaiting_payment");
      expect(query.params).toContain(from.toISOString());
      expect(query.params).toContain(to.toISOString());
    });

    it("includes storeId filter when storeId is provided", () => {
      const from = new Date("2026-08-01T00:00:00.000Z");
      const to = new Date("2026-08-15T23:59:59.999Z");

      const filter = getEligibleOrderFilters({ from, to, storeId: 5 });
      const query = db.select().from(ordersTable).where(filter).toSQL();

      expect(query.sql).toContain('"orders"."store_id" = $5');
      expect(query.params).toContain(5);
      expect(query.params).toContain("cancelled");
      expect(query.params).toContain("awaiting_payment");
      expect(query.params).toContain(from.toISOString());
      expect(query.params).toContain(to.toISOString());
    });
  });

  it("uses saved payable totals for store and platform gross order value without subtracting promotions again", async () => {
    const select = vi.spyOn(db, "select").mockReturnValue({
      from: () => ({ where: vi.fn().mockResolvedValue([{ totalPaise: "28350" }]) }),
    } as never);
    expect(await dashboardService.getTotalRevenue({ storeId: 1 })).toBe(283.5);
    expect(await dashboardService.getTotalRevenue({})).toBe(283.5);
    for (const [fields] of select.mock.calls) {
      const query = new PgDialect().sqlToQuery((fields as { totalPaise: SQL }).totalPaise);
      expect(query.sql).toContain('SUM("orders"."grand_total_paise")');
      expect(query.sql).not.toContain("discount_paise");
      expect(query.sql).not.toContain("promotion");
    }
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
    it("returns all 5 metric cards with Gross Order Value when includeFinance is true", async () => {
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
        "Gross Order Value",
        "Active Users",
        "Total Orders",
        "Average Order Value",
        "Low Stock Items",
      ]);

      const govCard = metrics.find((m) => m.label === "Gross Order Value");
      expect(govCard).toBeDefined();
      expect(govCard?.data.icon).toEqual({
        name: "indian-rupee",
        color: "green",
      });

      const aovCard = metrics.find((m) => m.label === "Average Order Value");
      expect(aovCard).toBeDefined();
      expect(aovCard?.data.icon).toEqual({
        name: "credit-card",
        color: "teal",
      });

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

    it("handles zero total orders gracefully for AOV calculation without division by zero errors", async () => {
      vi.spyOn(dashboardService, "getTotalRevenue").mockResolvedValue(0);
      vi.spyOn(dashboardService, "getActiveUsers").mockResolvedValue(0);
      vi.spyOn(dashboardService, "getTotalOrders").mockResolvedValue(0);
      vi.spyOn(dashboardService, "getLowStockItemsCount").mockResolvedValue(0);

      const metrics = await dashboardService.getDashboardMetrics({
        from: "2026-08-01",
        to: "2026-08-15",
        includeFinance: true,
      });

      const aovCard = metrics.find((m) => m.label === "Average Order Value");
      expect(aovCard).toBeDefined();
      expect(aovCard?.data.current).toBe("₹0.00");
    });
  });
});
