import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import {
  REFUND_ALLOCATION_KINDS,
  REFUND_STATUSES,
} from "../../utils/types";
import { refundAllocationsTable, refundsTable } from "./refund.schema";

const names = (items: Array<{ name?: string }>) =>
  items.map((item) => item.name).filter(Boolean);

describe("refund database schema", () => {
  it("defines the complete refund lifecycle and allocation kinds", () => {
    expect(REFUND_STATUSES).toEqual([
      "requested",
      "approved",
      "rejected",
      "cancelled",
      "submitted",
      "processing",
      "processed",
      "failed",
    ]);
    expect(REFUND_ALLOCATION_KINDS).toEqual(["item", "delivery_fee"]);
  });

  it("enforces store-scoped attempt identity and lifecycle evidence", () => {
    const config = getTableConfig(refundsTable);

    expect(refundsTable.storeId.notNull).toBe(true);
    expect(refundsTable.clientRequestId.notNull).toBe(true);
    expect(config.foreignKeys.map((foreignKey) => foreignKey.getName())).toContain(
      "refunds_payment_attempt_order_store_fk"
    );
    expect(names(config.checks)).toEqual(
      expect.arrayContaining([
        "refunds_amount_paise_positive",
        "refunds_currency_inr",
        "refunds_status_valid",
        "refunds_actor_timestamp_pairs",
        "refunds_status_evidence",
        "refunds_timestamps_ordered",
      ])
    );
    expect(names(config.uniqueConstraints)).toEqual(
      expect.arrayContaining(["refunds_allocation_scope_unique"])
    );
  });

  it("keeps item allocations on the refund order and reconciles inclusive tax", () => {
    const config = getTableConfig(refundAllocationsTable);

    expect(refundAllocationsTable.orderId.notNull).toBe(true);
    expect(config.foreignKeys.map((foreignKey) => foreignKey.getName())).toEqual(
      expect.arrayContaining([
        "refund_allocations_refund_order_fk",
        "refund_allocations_item_order_fk",
      ])
    );
    expect(names(config.checks)).toEqual(
      expect.arrayContaining([
        "refund_allocations_kind_valid",
        "refund_allocations_target_valid",
        "refund_allocations_amounts_valid",
      ])
    );
    expect(config.indexes.map((index) => index.config.name)).toEqual(
      expect.arrayContaining([
        "refund_allocations_item_unique",
        "refund_allocations_delivery_fee_unique",
      ])
    );
  });
});
