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
    expect(orderListQuerySchema.parse({})).toEqual({});
    expect(orderListQuerySchema.parse({ status: "out_for_delivery" })).toEqual({
      status: "out_for_delivery",
    });
    expect(() => orderListQuerySchema.parse({ status: "delievered" })).toThrow();
  });
});
