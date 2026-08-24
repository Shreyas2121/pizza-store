import { describe, expect, it } from "vitest";
import { AppError } from "../../utils/error";
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
    ["preparing", "delievered"],
    ["preparing", "cancelled"],
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
    ["delievered", "delievered"],
    ["cancelled", "cancelled"],
  ] as const)(
    "treats identical status transition as a no-op from %s to %s",
    (from: OrderStatus, to: OrderStatus) => {
      expect(isValidOrderTransition(from, to)).toBe(true);
      expect(() => assertValidOrderTransition(from, to)).not.toThrow();
    }
  );

  it.each([
    ["delievered", "pending"],
    ["delievered", "preparing"],
    ["delievered", "cancelled"],
    ["cancelled", "pending"],
    ["cancelled", "preparing"],
    ["cancelled", "delievered"],
    ["pending", "delievered"],
    ["awaiting_payment", "delievered"],
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
