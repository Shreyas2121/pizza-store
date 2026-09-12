import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import {
  bundleComponentsRelations,
  orderItemBundleComponentsRelations,
} from "./_relations";
import { bundleComponentsTable } from "./bundle-component.schema";
import { productsTable } from "./catalog.schema";
import {
  orderItemBundleComponentsTable,
  orderItemsTable,
  ordersTable,
} from "./order.schema";
import { storeProductsTable } from "./store.schema";

const names = (items: Array<{ name?: string }>) =>
  items.map((item) => item.name).filter(Boolean);

describe("bundle database schema", () => {
  it("requires distinct unique components with positive quantities", () => {
    const config = getTableConfig(bundleComponentsTable);

    expect(names(config.uniqueConstraints)).toContain(
      "bundle_components_bundle_product_unique"
    );
    expect(names(config.checks)).toEqual(
      expect.arrayContaining([
        "bundle_components_quantity_positive",
        "bundle_components_distinct_products",
      ])
    );
    expect(config.indexes.map((item) => item.config.name)).toContain(
      "bundle_components_component_product_idx"
    );
  });

  it("adds catalogue and store price discriminators without breaking existing rows", () => {
    expect(productsTable.productType.default).toBe("single");
    expect(storeProductsTable.compareAtPricePaise.notNull).toBe(false);
    expect(names(getTableConfig(productsTable).checks)).toContain(
      "products_product_type_valid"
    );
    expect(names(getTableConfig(storeProductsTable).checks)).toContain(
      "store_products_compare_at_price_valid"
    );
  });

  it("adds coherent immutable bundle snapshots to order items", () => {
    expect(ordersTable.discountMode.default).toBe("none");
    expect(orderItemsTable.productType.default).toBe("single");
    expect(orderItemsTable.bundleMarkdownPaise.default).toBe(0);
    expect(names(getTableConfig(ordersTable).checks)).toContain(
      "orders_discount_mode_valid"
    );
    expect(names(getTableConfig(orderItemsTable).checks)).toEqual(
      expect.arrayContaining([
        "order_items_product_type_valid",
        "order_items_bundle_snapshot_valid",
      ])
    );
    expect(names(getTableConfig(orderItemBundleComponentsTable).checks)).toEqual(
      expect.arrayContaining([
        "order_item_bundle_components_name_present",
        "order_item_bundle_components_quantities_positive",
      ])
    );
    expect(names(getTableConfig(orderItemBundleComponentsTable).uniqueConstraints)).toContain(
      "order_item_bundle_components_item_product_unique"
    );
  });

  it("exports both bundle relation sets", () => {
    expect([bundleComponentsRelations, orderItemBundleComponentsRelations]).toHaveLength(2);
  });
});
