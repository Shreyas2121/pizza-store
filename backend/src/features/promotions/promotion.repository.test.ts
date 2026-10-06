import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  PromotionRepository,
  promotionStatusSql,
} from "./promotion.repository";
import {
  HOMEPAGE_FEATURED_OFFER_LIMIT,
  PROMOTION_LIST_MAX_PAGE_SIZE,
} from "./promotion.constants";

describe("promotion discovery query privacy", () => {
  it("filters offer kind and default-enabled selected store before returning a bounded priority-ordered list", () => {
    const query = new PromotionRepository()
      .discoveryQuery(17, new Date("2026-10-06T00:00:00Z"), false)
      .toSQL();
    expect(query.params).toContain("offer");
    expect(query.params).toContain(17);
    expect(query.params).toContain(PROMOTION_LIST_MAX_PAGE_SIZE);
    expect(query.sql).toContain(
      'coalesce("store_promotion_settings"."is_enabled", true)',
    );
    expect(query.sql).toContain('"store_promotion_settings"."store_id" =');
    expect(query.sql).toContain(
      'order by "promotions"."display_priority" desc, "promotions"."id" asc',
    );
    expect(query.sql).not.toContain(
      '"promotion_applications"."promotion_code"',
    );
  });
  it("requires homepage placement and limits featured offers", () => {
    const query = new PromotionRepository()
      .discoveryQuery(17, new Date(), true)
      .toSQL();
    expect(query.params).toContain(true);
    expect(query.params.at(-1)).toBe(HOMEPAGE_FEATURED_OFFER_LIMIT);
    expect(query.sql).toContain('"promotions"."show_on_homepage" =');
  });
  it("uses reserved plus consumed applications for exhaustion and half-open validity", () => {
    const query = new PgDialect().sqlToQuery(
      promotionStatusSql(new Date("2026-10-06T00:00:00Z")),
    );
    expect(query.sql).toContain("a.status in ('reserved', 'consumed')");
    expect(query.sql).toContain("a.total_savings_paise::bigint");
    expect(query.sql).toContain('"promotions"."ends_at" <=');
    expect(query.sql).not.toContain("redemption_count");
  });
});
