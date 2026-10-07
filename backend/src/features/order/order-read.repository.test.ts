import { describe, expect, it } from "vitest";
import { db } from "../../db";
import { ORDER_SNAPSHOT_RELATIONS } from "./order-read.repository";

describe("order snapshot relational query", () => {
  it("loads allocations and bundle snapshots without joining current promotion/customization definitions", () => {
    const query = db.query.ordersTable.findMany({ with: ORDER_SNAPSHOT_RELATIONS, limit: 25 }).toSQL();
    expect(query.sql).toContain('"promotion_applications"');
    expect(query.sql).toContain('"promotion_discount_allocations"');
    expect(query.sql).toContain('"order_item_bundle_components"');
    expect(query.sql).not.toContain('"promotions"');
    expect(query.sql).not.toContain('"customization_options"');
    expect(query.params).toContain(25);
  });
});
