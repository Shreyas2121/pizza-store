import { afterEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { db } from "../../db";
import { PromotionAnalyticsRepository } from "./promotion-analytics.repository";

afterEach(() => vi.restoreAllMocks());

describe("promotion analytics query", () => {
  it("matches inclusive-tax rounding and apportions before selecting a promotion", async () => {
    const execute = vi.spyOn(db, "execute").mockResolvedValue({ rows: [] } as never);
    await new PromotionAnalyticsRepository().aggregate(7, {
      fromBusinessDate: "2026-07-01", toBusinessDate: "2026-08-31", storeId: 2,
    });
    const query = new PgDialect().sqlToQuery(execute.mock.calls[0][0]);
    // At 100% inclusive tax, 105 paise pays 53 tax and 52 taxable.
    // Rounding the taxable component directly would incorrectly return 53.
    expect(query.sql).toContain("i.line_subtotal_paise::numeric - round(i.line_subtotal_paise::numeric * i.tax_rate_bps /");
    expect(query.sql).toContain("join selected_items si on si.order_item_id = d.order_item_id");
    expect(query.sql).toContain("order by remainder desc, promotion_application_id asc");
    expect(query.sql).toContain("group by grouping sets ((a.store_id), ())");
    expect(query.sql).toContain("and a.store_id =");
    expect(query.params).toEqual([7, "2026-07-01", "2026-08-31", 2, 10_000]);
    expect(query.sql).not.toContain("join promotions ");
  });
});
