import {
  and,
  asc,
  count,
  eq,
  gt,
  gte,
  isNotNull,
  lte,
  sql,
} from "drizzle-orm";
import { db } from "../../db";
import {
  inventoryReservationsTable,
  ordersTable,
  productsTable,
  storeProductsTable,
} from "../../db/schema";
import { differenceInCalendarDays, subDays } from "date-fns";
import { GroupT } from "../../utils/types";
import { AppError } from "../../utils/error";
import { groupToTrunc } from "../../constants";
import { formatNumber, formatPrice } from "../../utils";

interface Props {
  from?: Date;
  to?: Date;
  storeId?: number;
}

interface ChartsProp extends Props {
  group: GroupT;
}

const getOrderFilters = ({ from, to, storeId }: Props) =>
  and(
    lte(ordersTable.orderDate, to ?? new Date()),
    gte(ordersTable.orderDate, from ?? subDays(new Date(), 15)),
    storeId === undefined ? undefined : eq(ordersTable.storeId, storeId)
  );

class DashboardService {
  async getTotalRevenue({ from, to, storeId }: Props) {
    return (
      await db
        .select({
          total: sql`COALESCE(SUM(total_price), 0) as total_revenue`,
        })
        .from(ordersTable)
        .where(getOrderFilters({ from, to, storeId }))
    )[0].total as number;
  }

  async getActiveUsers({ from, to, storeId }: Props) {
    return (
      await db
        .selectDistinct({
          userId: ordersTable.userId,
        })
        .from(ordersTable)
        .where(getOrderFilters({ from, to, storeId }))
    ).length;
  }

  async getTotalOrders({ from, to, storeId }: Props) {
    return (
      await db
        .select({
          totalOrders: count(ordersTable.id),
        })
        .from(ordersTable)
        .where(getOrderFilters({ from, to, storeId }))
    )[0].totalOrders;
  }

  async getLowStockItemsCount({ storeId }: { storeId?: number } = {}) {
    const now = new Date();
    const activeReservations = db
      .select({
        storeProductId: inventoryReservationsTable.storeProductId,
        reservedQuantity:
          sql<number>`COALESCE(SUM(${inventoryReservationsTable.quantity}), 0)`
            .mapWith(Number)
            .as("reserved_quantity"),
      })
      .from(inventoryReservationsTable)
      .where(
        and(
          eq(inventoryReservationsTable.status, "reserved"),
          gt(inventoryReservationsTable.expiresAt, now)
        )
      )
      .groupBy(inventoryReservationsTable.storeProductId)
      .as("active_reservations");

    const availableQuantity = sql<number>`GREATEST(0, ${storeProductsTable.onHandQuantity} - COALESCE(${activeReservations.reservedQuantity}, 0))`;

    const conditions = [
      isNotNull(storeProductsTable.onHandQuantity),
      eq(storeProductsTable.isAvailable, true),
      eq(productsTable.isAvailable, true),
      lte(availableQuantity, storeProductsTable.lowStockThreshold),
    ];

    if (storeId !== undefined) {
      conditions.push(eq(storeProductsTable.storeId, storeId));
    }

    const [{ total }] = await db
      .select({ total: count() })
      .from(storeProductsTable)
      .innerJoin(
        productsTable,
        eq(storeProductsTable.productId, productsTable.id)
      )
      .leftJoin(
        activeReservations,
        eq(storeProductsTable.id, activeReservations.storeProductId)
      )
      .where(and(...conditions));

    return Number(total);
  }

  async getRevenueOverTime({ group, from, to, storeId }: ChartsProp) {
    const truncUnit = groupToTrunc[group];
    if (!truncUnit) {
      throw new AppError(`Invalid group: ${group}`);
    }

    return await db
      .select({
        period: sql<string>`date_trunc(${sql.raw(`'${truncUnit}'`)}, ${
          ordersTable.orderDate
        })`,
        revenue: sql<number>`sum(${ordersTable.totalPrice})`,
      })
      .from(ordersTable)
      .where(getOrderFilters({ from, to, storeId }))
      .groupBy(
        sql`date_trunc(${sql.raw(`'${truncUnit}'`)}, ${ordersTable.orderDate})`
      )
      .orderBy(
        asc(
          sql`date_trunc(${sql.raw(`'${truncUnit}'`)}, ${
            ordersTable.orderDate
          })`
        )
      );
  }

  async getOrdersOverTime({ group, from, to, storeId }: ChartsProp) {
    const truncUnit = groupToTrunc[group];
    if (!truncUnit) {
      throw new AppError(`Invalid group: ${group}`);
    }

    return await db
      .select({
        period: sql<string>`date_trunc(${sql.raw(`'${truncUnit}'`)}, ${
          ordersTable.orderDate
        })`,
        orders: count(ordersTable.id),
      })
      .from(ordersTable)
      .where(getOrderFilters({ from, to, storeId }))
      .groupBy(
        sql`date_trunc(${sql.raw(`'${truncUnit}'`)}, ${ordersTable.orderDate})`
      )
      .orderBy(
        asc(
          sql`date_trunc(${sql.raw(`'${truncUnit}'`)}, ${
            ordersTable.orderDate
          })`
        )
      );
  }

  async getDashboardMetrics(from: string, to: string, storeId?: number) {
    const fromDate = new Date(from);
    const toDate = new Date(to);

    const daysDiff = differenceInCalendarDays(toDate, fromDate) + 1;
    const prevFrom = subDays(fromDate, daysDiff);
    const prevTo = subDays(toDate, daysDiff);

    const currentParam = { from: fromDate, to: toDate, storeId };
    const prevParam = { from: prevFrom, to: prevTo, storeId };

    const currentRevenue = await this.getTotalRevenue(currentParam);
    const activeUsers = await this.getActiveUsers(currentParam);
    const currentTotalOrders = await this.getTotalOrders(currentParam);
    const currentAOV =
      currentTotalOrders === 0 ? 0 : currentRevenue / currentTotalOrders;

    const previousRevenue = await this.getTotalRevenue(prevParam);
    const prevActiveUsers = await this.getActiveUsers(prevParam);
    const previousTotalOrders = await this.getTotalOrders(prevParam);
    const previousAOV =
      previousTotalOrders === 0 ? 0 : previousRevenue / previousTotalOrders;

    const lowStockItems = await this.getLowStockItemsCount({ storeId });

    const renderRes = (
      type: "price" | "number",
      curr: number,
      prev: number,
      icon: { name: string; color: string }
    ) => {
      const percentageChange = prev === 0 ? 0 : ((curr - prev) / prev) * 100;
      return {
        current: type === "price" ? formatPrice(curr) : formatNumber(curr),
        previous: type === "price" ? formatPrice(prev) : formatNumber(prev),
        isLow: curr < prev,
        percentage:
          prev === 0 ? "N/A" : `${Math.abs(percentageChange).toFixed(1)}%`,
        icon,
      };
    };

    return [
      {
        label: "Revenue",
        data: renderRes("price", currentRevenue, previousRevenue, {
          name: "indian-rupee",
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
      {
        label: "Low Stock Items",
        data: {
          current: formatNumber(lowStockItems),
          previous: "Real-time",
          isLow: lowStockItems > 0,
          percentage: "N/A",
          icon: {
            name: "alert-triangle",
            color: lowStockItems > 0 ? "red" : "gray",
          },
        },
      },
    ];
  }
}

export default new DashboardService();
