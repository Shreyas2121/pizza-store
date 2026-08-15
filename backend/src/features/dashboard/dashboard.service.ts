import { and, asc, count, gte, lte, sql, sum } from "drizzle-orm";
import { db } from "../../db";
import { ordersTable } from "../../db/schema";
import { differenceInCalendarDays, subDays } from "date-fns";
import { GroupT } from "../../utils/types";
import { AppError } from "../../utils/error";
import { groupToTrunc } from "../../constants";
import { formatNumber, formatPrice } from "../../utils";

interface Props {
  from?: Date;
  to?: Date;
}

interface ChartsProp extends Props {
  group: GroupT;
}

class DashboardService {
  async getTotalRevenue({ from, to }: Props) {
    const defaultFrom = subDays(new Date(), 15);
    const defaultTo = new Date();
    return (
      await db
        .select({
          total: sql`SUM(total_price) - SUM(discount_amount) as total_revenue`,
        })
        .from(ordersTable)
        .where(
          and(
            lte(ordersTable.orderDate, to ?? defaultTo),
            gte(ordersTable.orderDate, from ?? defaultFrom)
          )
        )
    )[0].total as number;
  }

  async getActiveUsers({ from, to }: Props) {
    return (
      await db
        .selectDistinct({
          userId: ordersTable.userId,
        })
        .from(ordersTable)
        .where(
          and(
            lte(ordersTable.orderDate, to ?? new Date()),
            gte(ordersTable.orderDate, from ?? subDays(new Date(), 15))
          )
        )
    ).length;
  }

  async getTotalOrders({ from, to }: Props) {
    return (
      await db
        .select({
          totalOrders: count(ordersTable.id),
        })
        .from(ordersTable)
        .where(
          and(
            lte(ordersTable.orderDate, to ?? new Date()),
            gte(ordersTable.orderDate, from ?? subDays(new Date(), 15))
          )
        )
    )[0].totalOrders;
  }

  async getRevenueOverTime({ group, from, to }: ChartsProp) {
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
      .where(
        and(
          lte(ordersTable.orderDate, to ?? new Date()),
          gte(ordersTable.orderDate, from ?? subDays(new Date(), 15))
        )
      )
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

  async getOrdersOverTime({ group, from, to }: ChartsProp) {
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
      .where(
        and(
          lte(ordersTable.orderDate, to ?? new Date()),
          gte(ordersTable.orderDate, from ?? subDays(new Date(), 15))
        )
      )
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

  async getDashboardMetrics(from: string, to: string) {
    const fromDate = new Date(from);
    const toDate = new Date(to);

    const daysDiff = differenceInCalendarDays(toDate, fromDate) + 1;
    const prevFrom = subDays(fromDate, daysDiff);
    const prevTo = subDays(toDate, daysDiff);

    const currentParam = { from: fromDate, to: toDate };
    const prevParam = { from: prevFrom, to: prevTo };

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
    ];
  }
}

export default new DashboardService();
