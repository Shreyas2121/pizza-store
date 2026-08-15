import { and, asc, count, gte, lte, sql, sum } from "drizzle-orm";
import { db } from "../../db";
import { ordersTable } from "../../db/schema";
import { subDays } from "date-fns";
import { GroupT } from "../../utils/types";
import { AppError } from "../../utils/error";
import { groupToTrunc } from "../../constants";

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
}

export default new DashboardService();
