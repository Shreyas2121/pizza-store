import { describe, expect, it } from "vitest";
import {
  orderListQuerySchema,
  orderStatusSchema,
  updateOrderStatusSchema,
} from "./order.schemas";
import { ORDER_STATUSES } from "../../utils/types";

describe("order schemas", () => {
  it.each(ORDER_STATUSES)("accepts canonical status '%s'", (status) => {
    expect(orderStatusSchema.parse(status)).toBe(status);
    expect(updateOrderStatusSchema.parse({ status })).toEqual({ status });
  });

  it("rejects legacy misspelled status 'delievered'", () => {
    expect(() => orderStatusSchema.parse("delievered")).toThrow();
    expect(() => updateOrderStatusSchema.parse({ status: "delievered" })).toThrow();
  });

  it("rejects arbitrary invalid status strings", () => {
    expect(() => orderStatusSchema.parse("shipped")).toThrow();
    expect(() => updateOrderStatusSchema.parse({ status: "unknown" })).toThrow();
    expect(() => updateOrderStatusSchema.parse({})).toThrow();
  });

  it("parses optional status query parameter", () => {
    expect(orderListQuerySchema.parse({})).toEqual({ page: 1, limit: 25 });
    expect(orderListQuerySchema.parse({ status: "out_for_delivery" })).toEqual({
      status: "out_for_delivery",
      page: 1, limit: 25,
    });
    expect(() => orderListQuerySchema.parse({ status: "delievered" })).toThrow();
  });
  it("bounds pagination and accepts validated query strings", () => {
    expect(orderListQuerySchema.parse({ page: "2", limit: "100" })).toEqual({ page: 2, limit: 100 });
    for (const query of [{ limit: 101 }, { page: 0 }, { page: 10_001 }, { limit: "x" }]) {
      expect(orderListQuerySchema.safeParse(query).success).toBe(false);
    }
  });
});
