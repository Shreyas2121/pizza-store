import {
  and,
  asc,
  count,
  eq,
  gt,
  gte,
  isNotNull,
  lte,
  notInArray,
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
import { GroupT, OrderStatus } from "../../utils/types";
import { AppError } from "../../utils/error";
import { groupToTrunc } from "../../constants";
import { formatNumber, formatPrice } from "../../utils";
import { parseAggregatePaise } from "../../utils/money";

interface Props {
  from?: Date;
  to?: Date;
  storeId?: number;
}

interface ChartsProp extends Props {
  group: GroupT;
}

export const EXCLUDED_DASHBOARD_ORDER_STATUSES: OrderStatus[] = [
  "cancelled",
  "awaiting_payment",
];

export const getEligibleOrderFilters = ({ from, to, storeId }: Props) =>
  and(
    lte(ordersTable.orderDate, to ?? new Date()),
    gte(ordersTable.orderDate, from ?? subDays(new Date(), 15)),
    notInArray(ordersTable.status, EXCLUDED_DASHBOARD_ORDER_STATUSES),
    storeId === undefined ? undefined : eq(ordersTable.storeId, storeId)
  );

class DashboardService {
  async getTotalRevenue({ from, to, storeId }: Props) {
    const [result] = await db
      .select({
        totalPaise: sql<string>`COALESCE(SUM(${ordersTable.grandTotalPaise}), 0)::text`,
      })
      .from(ordersTable)
      .where(getEligibleOrderFilters({ from, to, storeId }));
    return this.aggregatePaiseToRupees(result.totalPaise);
  }

  async getActiveUsers({ from, to, storeId }: Props) {
    return (
      await db
        .selectDistinct({
          userId: ordersTable.userId,
        })
        .from(ordersTable)
        .where(getEligibleOrderFilters({ from, to, storeId }))
    ).length;
  }

  async getTotalOrders({ from, to, storeId }: Props) {
    return (
      await db
        .select({
          totalOrders: count(ordersTable.id),
        })
        .from(ordersTable)
        .where(getEligibleOrderFilters({ from, to, storeId }))
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

    const rows = await db
      .select({
        period: sql<string>`date_trunc(${sql.raw(`'${truncUnit}'`)}, ${
          ordersTable.orderDate
        })`,
        revenuePaise: sql<string>`COALESCE(sum(${ordersTable.grandTotalPaise}), 0)::text`,
      })
      .from(ordersTable)
      .where(getEligibleOrderFilters({ from, to, storeId }))
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
    return rows.map(({ period, revenuePaise }) => ({
      period,
      revenue: this.aggregatePaiseToRupees(revenuePaise),
    }));
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
      .where(getEligibleOrderFilters({ from, to, storeId }))
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

  private aggregatePaiseToRupees(value: string | number | bigint) {
    const paise = parseAggregatePaise(value);
    const numericPaise = Number(paise);
    if (!Number.isSafeInteger(numericPaise)) {
      throw new AppError(
        "Dashboard total exceeds the safe compatibility response range",
        500,
        "DASHBOARD_TOTAL_OUT_OF_RANGE"
      );
    }
    return numericPaise / 100;
  }

  async getDashboardMetrics(
    fromOrOptions:
      | string
      | {
          from: string;
          to: string;
          storeId?: number;
          includeFinance?: boolean;
        },
    toParam?: string,
    storeIdParam?: number,
    includeFinanceParam = true
  ) {
    let from: string;
    let to: string;
    let storeId: number | undefined;
    let includeFinance = true;

    if (typeof fromOrOptions === "object") {
      from = fromOrOptions.from;
      to = fromOrOptions.to;
      storeId = fromOrOptions.storeId;
      includeFinance = fromOrOptions.includeFinance ?? true;
    } else {
      from = fromOrOptions;
      to = toParam!;
      storeId = storeIdParam;
      includeFinance = includeFinanceParam;
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);

    const daysDiff = differenceInCalendarDays(toDate, fromDate) + 1;
    const prevFrom = subDays(fromDate, daysDiff);
    const prevTo = subDays(toDate, daysDiff);

    const currentParam = { from: fromDate, to: toDate, storeId };
    const prevParam = { from: prevFrom, to: prevTo, storeId };

    const activeUsers = await this.getActiveUsers(currentParam);
    const prevActiveUsers = await this.getActiveUsers(prevParam);

    const currentTotalOrders = await this.getTotalOrders(currentParam);
    const previousTotalOrders = await this.getTotalOrders(prevParam);

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

    const activeUsersCard = {
      label: "Active Users",
      data: renderRes("number", activeUsers, prevActiveUsers, {
        name: "users",
        color: "blue",
      }),
    };

    const totalOrdersCard = {
      label: "Total Orders",
      data: renderRes("number", currentTotalOrders, previousTotalOrders, {
        name: "shopping-cart",
        color: "orange",
      }),
    };

    const lowStockCard = {
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
    };

    if (!includeFinance) {
      return [activeUsersCard, totalOrdersCard, lowStockCard];
    }

    const currentRevenue = await this.getTotalRevenue(currentParam);
    const previousRevenue = await this.getTotalRevenue(prevParam);

    const currentAOV =
      currentTotalOrders === 0 ? 0 : currentRevenue / currentTotalOrders;
    const previousAOV =
      previousTotalOrders === 0 ? 0 : previousRevenue / previousTotalOrders;

    const grossOrderValueCard = {
      label: "Gross Order Value",
      data: renderRes("price", currentRevenue, previousRevenue, {
        name: "indian-rupee",
        color: "green",
      }),
    };

    const aovCard = {
      label: "Average Order Value",
      data: renderRes("price", currentAOV, previousAOV, {
        name: "credit-card",
        color: "teal",
      }),
    };

    return [
      grossOrderValueCard,
      activeUsersCard,
      totalOrdersCard,
      aovCard,
      lowStockCard,
    ];
  }
}

export default new DashboardService();
