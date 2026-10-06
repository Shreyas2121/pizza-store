import { describe, expect, it } from "vitest";
import {
  CouponValidationLimiter,
  COUPON_VALIDATION_MAX_ATTEMPTS,
  COUPON_VALIDATION_WINDOW_MS,
  COUPON_VALIDATION_MAX_PRINCIPALS,
} from "./promotion-validation-limit";
describe("coupon validation attempt limit", () => {
  it("limits failed and successful attempts equally, isolates principals and resets at expiry", () => {
    let now = 0;
    const limiter = new CouponValidationLimiter(() => now);
    for (let i = 0; i < COUPON_VALIDATION_MAX_ATTEMPTS; i++)
      expect(limiter.attempt("user:1").allowed).toBe(true);
    expect(limiter.attempt("user:1")).toEqual({
      allowed: false,
      retryAfterSeconds: 60,
    });
    expect(limiter.attempt("user:2").allowed).toBe(true);
    now = COUPON_VALIDATION_WINDOW_MS - 1;
    expect(limiter.attempt("user:1")).toEqual({
      allowed: false,
      retryAfterSeconds: 1,
    });
    now += 1;
    expect(limiter.attempt("user:1").allowed).toBe(true);
  });
  it("bounds memory without evicting active quotas and admits principals after expiry", () => {
    let now = 0;
    const limiter = new CouponValidationLimiter(() => now);
    for (let i = 0; i < COUPON_VALIDATION_MAX_PRINCIPALS; i++)
      limiter.attempt(`ip:${i}`);
    expect(limiter.attempt("ip:new").allowed).toBe(false);
    now = COUPON_VALIDATION_WINDOW_MS;
    expect(limiter.attempt("ip:new").allowed).toBe(true);
  });
});
