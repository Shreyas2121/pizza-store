import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db";
import { BASIS_POINTS_SCALE } from "./promotion.constants";
import type { PromotionAnalyticsQuery } from "./promotion.schemas";

const aggregate = z.string().regex(/^\d+$/);
export const promotionAnalyticsTotalsSchema = z.object({
  reservedApplications: aggregate,
  consumedApplications: aggregate,
  releasedApplications: aggregate,
  uniqueUsers: aggregate,
  itemDiscountPaise: aggregate,
  deliveryDiscountPaise: aggregate,
  totalSavingsPaise: aggregate,
  influencedOrderValuePaise: aggregate,
  netRevenueReductionPaise: aggregate,
});
const analyticsRowSchema = promotionAnalyticsTotalsSchema.extend({
  storeId: z.number().int().positive().nullable(),
  storeName: z.string().nullable(),
});
export type PromotionAnalyticsRow = z.infer<typeof analyticsRowSchema>;

export class PromotionAnalyticsRepository {
  async aggregate(
    promotionId: number,
    query: PromotionAnalyticsQuery,
  ): Promise<PromotionAnalyticsRow[]> {
    // Aggregate before joining application metrics, so unit allocations cannot
    // multiply order values or counts. Apportion each line's tax-exclusive
    // reduction across ALL of its applications before selecting this promotion.
    const result = await db.execute(sql`
      with selected as (
        select a.*, o.grand_total_paise, s.name as store_name
        from promotion_applications a join orders o on o.id = a.order_id join stores s on s.id = a.store_id
        where a.promotion_id = ${promotionId}
          and o.pricing_business_date >= ${query.fromBusinessDate} and o.pricing_business_date <= ${query.toBusinessDate}
          ${query.storeId === undefined ? sql`` : sql`and a.store_id = ${query.storeId}`}
      ), selected_items as (
        select distinct d.order_item_id from promotion_discount_allocations d join selected a on a.id = d.promotion_application_id
        where d.component = 'item' and a.status = 'consumed'
      ), shares as (
        select d.order_item_id, d.promotion_application_id, sum(d.amount_paise::numeric) as weight,
          round(i.line_subtotal_paise::numeric * ${BASIS_POINTS_SCALE} / (${BASIS_POINTS_SCALE} + i.tax_rate_bps)) - i.taxable_amount_paise as reduction
        from promotion_discount_allocations d join selected_items si on si.order_item_id = d.order_item_id
        join order_items i on i.id = d.order_item_id
        group by d.order_item_id, d.promotion_application_id, i.id
      ), weighted as (
        select *, sum(weight) over (partition by order_item_id) as total_weight from shares
      ), bases as (
        select *, floor(reduction * weight / total_weight) as base,
          mod(reduction * weight, total_weight) as remainder from weighted
      ), apportioned as (
        select *, base + case when row_number() over (partition by order_item_id order by remainder desc, promotion_application_id asc)
          <= reduction - sum(base) over (partition by order_item_id) then 1 else 0 end as amount from bases
      ), reductions as (
        select promotion_application_id, sum(amount) as amount from apportioned group by promotion_application_id
      )
      select a.store_id as "storeId", max(a.store_name) as "storeName",
        count(*) filter (where a.status = 'reserved')::text as "reservedApplications",
        count(*) filter (where a.status = 'consumed')::text as "consumedApplications",
        count(*) filter (where a.status = 'released')::text as "releasedApplications",
        count(distinct a.user_id) filter (where a.status = 'consumed')::text as "uniqueUsers",
        coalesce(sum(a.item_discount_paise::bigint) filter (where a.status = 'consumed'), 0)::text as "itemDiscountPaise",
        coalesce(sum(a.delivery_discount_paise::bigint) filter (where a.status = 'consumed'), 0)::text as "deliveryDiscountPaise",
        coalesce(sum(a.total_savings_paise::bigint) filter (where a.status = 'consumed'), 0)::text as "totalSavingsPaise",
        coalesce(sum(a.grand_total_paise::bigint) filter (where a.status = 'consumed'), 0)::text as "influencedOrderValuePaise",
        coalesce(sum(r.amount) filter (where a.status = 'consumed'), 0)::text as "netRevenueReductionPaise"
      from selected a left join reductions r on r.promotion_application_id = a.id
      group by grouping sets ((a.store_id), ()) order by a.store_id nulls first
    `);
    // pg bigint/numeric aggregates remain strings; never coerce report money to Number.
    return z.array(analyticsRowSchema).parse(result.rows);
  }
}
export default new PromotionAnalyticsRepository();
