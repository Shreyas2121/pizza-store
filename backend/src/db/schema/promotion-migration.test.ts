import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../../migrations/0029_promotion_application_bundle_foundation.sql", import.meta.url),
  "utf8"
);
const snapshot = JSON.parse(
  readFileSync(
    new URL("../../../migrations/meta/0029_snapshot.json", import.meta.url),
    "utf8"
  )
) as { tables: Record<string, unknown> };
const journal = JSON.parse(
  readFileSync(new URL("../../../migrations/meta/_journal.json", import.meta.url), "utf8")
) as { entries: Array<{ idx: number; tag: string }> };

describe("promotion foundation migration", () => {
  it("checks in matching SQL and Drizzle metadata", () => {
    expect(journal.entries.at(-1)).toMatchObject({
      idx: 29,
      tag: "0029_promotion_application_bundle_foundation",
    });
    expect(Object.keys(snapshot.tables)).toEqual(
      expect.arrayContaining([
        "public.promotions",
        "public.promotion_rules",
        "public.store_promotion_settings",
        "public.promotion_applications",
        "public.promotion_discount_allocations",
        "public.bundle_components",
        "public.order_item_bundle_components",
      ])
    );
  });

  it("emits additive defaults, explicit foreign-key policies, and partial indexes", () => {
    expect(migration).toContain(
      'ALTER TABLE "orders" ADD COLUMN "discount_mode" text DEFAULT \'none\' NOT NULL'
    );
    expect(migration).toContain(
      'REFERENCES "public"."promotions"("id") ON DELETE no action ON UPDATE no action'
    );
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "promotions_normalized_code_unique"'
    );
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "promotion_applications_active_coupon_order_unique"'
    );
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "promotion_discount_allocations_item_unit_unique"'
    );
  });

  it("preserves overnight windows and omits mutable usage caches", () => {
    expect(migration).toContain(
      '"promotions"."active_start_time" <> "promotions"."active_end_time"'
    );
    expect(migration).not.toContain('"redemption_count"');
    expect(migration).not.toContain('"total_discount_spent_paise"');
    expect(migration).toContain('"per_user_redemption_limit" integer');
    expect(migration).toContain('"total_discount_budget_paise" integer');
  });
});
