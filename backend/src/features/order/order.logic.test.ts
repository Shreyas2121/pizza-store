import { describe, expect, it } from "vitest";
import type { OrderStatus } from "../../utils/types";
import {
  assertValidOrderTransition,
  isValidOrderTransition,
} from "./order.logic";

describe("order transition validation", () => {
  it.each([
    ["awaiting_payment", "pending"],
    ["awaiting_payment", "cancelled"],
    ["pending", "preparing"],
    ["pending", "cancelled"],
    ["preparing", "out_for_delivery"],
    ["preparing", "cancelled"],
    ["out_for_delivery", "delivered"],
    ["out_for_delivery", "cancelled"],
  ] as const)(
    "allows valid transition from %s to %s",
    (from: OrderStatus, to: OrderStatus) => {
      expect(isValidOrderTransition(from, to)).toBe(true);
      expect(() => assertValidOrderTransition(from, to)).not.toThrow();
    }
  );

  it.each([
    ["awaiting_payment", "awaiting_payment"],
    ["pending", "pending"],
    ["preparing", "preparing"],
    ["out_for_delivery", "out_for_delivery"],
    ["delivered", "delivered"],
    ["cancelled", "cancelled"],
  ] as const)(
    "treats identical status transition as a no-op from %s to %s",
    (from: OrderStatus, to: OrderStatus) => {
      expect(isValidOrderTransition(from, to)).toBe(true);
      expect(() => assertValidOrderTransition(from, to)).not.toThrow();
    }
  );

  it.each([
    ["preparing", "delivered"],
    ["out_for_delivery", "pending"],
    ["out_for_delivery", "preparing"],
    ["delivered", "pending"],
    ["delivered", "preparing"],
    ["delivered", "out_for_delivery"],
    ["delivered", "cancelled"],
    ["cancelled", "pending"],
    ["cancelled", "preparing"],
    ["cancelled", "out_for_delivery"],
    ["cancelled", "delivered"],
    ["pending", "out_for_delivery"],
    ["pending", "delivered"],
    ["awaiting_payment", "preparing"],
    ["awaiting_payment", "out_for_delivery"],
    ["awaiting_payment", "delivered"],
  ] as const)(
    "rejects invalid transition from %s to %s",
    (from: OrderStatus, to: OrderStatus) => {
      expect(isValidOrderTransition(from, to)).toBe(false);
      expect(() => assertValidOrderTransition(from, to)).toThrowError(
        expect.objectContaining({
          code: "INVALID_ORDER_STATUS_TRANSITION",
          status: 409,
        })
      );
    }
  );
});
