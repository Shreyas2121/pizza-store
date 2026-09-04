import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { orderItemsTable } from "./order.schema";
import { productCostVersionsTable } from "./product-cost.schema";

describe("product cost database schema", () => {
  it("enforces valid exact cost ranges and store scope", () => {
    const config = getTableConfig(productCostVersionsTable);
    expect(config.checks.map((item) => item.name)).toEqual(expect.arrayContaining([
      "product_cost_versions_amount_nonnegative",
      "product_cost_versions_range_valid",
    ]));
    expect(config.foreignKeys.map((item) => item.getName())).toContain(
      "product_cost_versions_store_product_store_fk"
    );
  });

  it("requires a complete order-item cost snapshot", () => {
    expect(orderItemsTable.costVersionId).toBeDefined();
    expect(getTableConfig(orderItemsTable).checks.map((item) => item.name)).toContain(
      "order_items_cost_snapshot_complete"
    );
  });
});
