import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import {
  promotionApplicationsRelations,
  promotionDiscountAllocationsRelations,
  promotionRulesRelations,
  promotionsRelations,
  storePromotionSettingsRelations,
} from "./_relations";
import { promotionApplicationsTable } from "./promotion-application.schema";
import { promotionDiscountAllocationsTable } from "./promotion-discount-allocation.schema";
import { promotionRulesTable } from "./promotion-rule.schema";
import { promotionsTable } from "./promotion.schema";
import { storePromotionSettingsTable } from "./store-promotion-setting.schema";

const names = (items: Array<{ name?: string }>) =>
  items.map((item) => item.name).filter(Boolean);

describe("promotion database schema", () => {
  it("enforces definition discriminators, normalized codes, limits, windows, and media", () => {
    const config = getTableConfig(promotionsTable);

    expect(names(config.checks)).toEqual(
      expect.arrayContaining([
        "promotions_kind_code_consistency",
        "promotions_kind_type_scope_valid",
        "promotions_discount_value_matches_type",
        "promotions_max_discount_valid",
        "promotions_customization_value_valid",
        "promotions_eligibility_amounts_valid",
        "promotions_limits_valid",
        "promotions_definition_version_positive",
        "promotions_validity_range_valid",
        "promotions_time_window_valid",
        "promotions_active_days_valid",
        "promotions_media_consistency",
        "promotions_homepage_placement_valid",
      ])
    );
    expect(config.indexes.map((item) => item.config.name)).toEqual(
      expect.arrayContaining([
        "promotions_normalized_code_unique",
        "promotions_active_discovery_idx",
        "promotions_capacity_budget_idx",
      ])
    );
    expect(promotionsTable.perUserRedemptionLimit.notNull).toBe(false);
    expect(promotionsTable.maxRedemptions.notNull).toBe(false);
    expect(promotionsTable.totalDiscountBudgetPaise.notNull).toBe(false);
    expect("redemptionCount" in promotionsTable).toBe(false);
    expect("totalDiscountSpentPaise" in promotionsTable).toBe(false);
    expect("storeId" in promotionsTable).toBe(false);
  });

  it("uses a mandatory nullability matrix for every rule shape", () => {
    const config = getTableConfig(promotionRulesTable);

    expect(names(config.checks)).toEqual(
      expect.arrayContaining([
        "promotion_rules_type_valid",
        "promotion_rules_shape_valid",
      ])
    );
    expect(config.indexes.map((item) => item.config.name)).toEqual(
      expect.arrayContaining([
        "promotion_rules_promotion_type_idx",
        "promotion_rules_product_target_unique",
        "promotion_rules_category_target_unique",
        "promotion_rules_tier_threshold_unique",
      ])
    );
    expect(config.foreignKeys.find((key) => key.reference().foreignTable === promotionsTable)?.onDelete)
      .toBe("cascade");
  });

  it("models absent store settings as enabled and validates explicit records", () => {
    const config = getTableConfig(storePromotionSettingsTable);

    expect(storePromotionSettingsTable.isEnabled.default).toBe(true);
    expect(storePromotionSettingsTable.updatedByUserId.notNull).toBe(true);
    expect(names(config.uniqueConstraints)).toContain(
      "store_promotion_settings_promotion_store_unique"
    );
    expect(names(config.checks)).toContain(
      "store_promotion_settings_reason_valid"
    );
    expect(config.indexes.map((item) => item.config.name)).toContain(
      "store_promotion_settings_store_enabled_idx"
    );
  });

  it("keeps immutable application snapshots as capacity and budget truth", () => {
    const config = getTableConfig(promotionApplicationsTable);

    expect(names(config.uniqueConstraints)).toContain(
      "promotion_applications_order_promotion_unique"
    );
    expect(config.indexes.map((item) => item.config.name)).toEqual(
      expect.arrayContaining([
        "promotion_applications_active_coupon_order_unique",
        "promotion_applications_capacity_idx",
        "promotion_applications_user_usage_idx",
        "promotion_applications_budget_usage_idx",
        "promotion_applications_store_analytics_idx",
      ])
    );
    expect(names(config.checks)).toEqual(
      expect.arrayContaining([
        "promotion_applications_snapshot_identity_valid",
        "promotion_applications_status_valid",
        "promotion_applications_status_timestamps_valid",
        "promotion_applications_amounts_valid",
      ])
    );
    expect(promotionApplicationsTable.standardDeliveryFeePaise.notNull).toBe(true);
    expect(promotionApplicationsTable.chargedDeliveryFeePaise.notNull).toBe(true);
  });

  it("requires positive, unit-addressed item or singleton delivery allocations", () => {
    const config = getTableConfig(promotionDiscountAllocationsTable);

    expect(names(config.checks)).toEqual(
      expect.arrayContaining([
        "promotion_discount_allocations_shape_valid",
        "promotion_discount_allocations_amount_positive",
      ])
    );
    expect(config.indexes.map((item) => item.config.name)).toEqual(
      expect.arrayContaining([
        "promotion_discount_allocations_item_unit_unique",
        "promotion_discount_allocations_delivery_unique",
        "promotion_discount_allocations_order_item_idx",
      ])
    );
  });

  it("exports compile-safe relations for every new promotion table", () => {
    expect([
      promotionsRelations,
      promotionRulesRelations,
      storePromotionSettingsRelations,
      promotionApplicationsRelations,
      promotionDiscountAllocationsRelations,
    ]).toHaveLength(5);
  });
});
