import { describe, expect, it } from "vitest";
import { isMaterialVariance, signedMovementAmount } from "./cash.policy";

describe("cash policy", () => {
  it("maps movement inputs to their expected-cash direction", () => {
    expect(signedMovementAmount("cash_in", 1_000)).toBe(1_000);
    expect(signedMovementAmount("cash_out", 1_000)).toBe(-1_000);
    expect(signedMovementAmount("deposit", 1_000)).toBe(-1_000);
    expect(signedMovementAmount("adjustment", 1_000, "out")).toBe(-1_000);
  });

  it("treats positive and negative ₹500 variances as material", () => {
    expect(isMaterialVariance(49_999)).toBe(false);
    expect(isMaterialVariance(50_000)).toBe(true);
    expect(isMaterialVariance(-50_000)).toBe(true);
  });
});
