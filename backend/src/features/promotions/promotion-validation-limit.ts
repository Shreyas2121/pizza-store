import type { RequestHandler } from "express";

export const COUPON_VALIDATION_WINDOW_MS = 60_000;
export const COUPON_VALIDATION_MAX_ATTEMPTS = 30;
export const COUPON_VALIDATION_MAX_PRINCIPALS = 10_000;

export class CouponValidationLimiter {
  private readonly windows = new Map<
    string,
    { expiresAt: number; attempts: number }
  >();
  constructor(private readonly clock: () => number = Date.now) {}
  attempt(key: string): { allowed: boolean; retryAfterSeconds: number } {
    const now = this.clock();
    for (const [id, window] of this.windows)
      if (window.expiresAt <= now) this.windows.delete(id);
    let window = this.windows.get(key);
    if (!window) {
      if (this.windows.size >= COUPON_VALIDATION_MAX_PRINCIPALS)
        return {
          allowed: false,
          retryAfterSeconds: COUPON_VALIDATION_WINDOW_MS / 1_000,
        };
      window = { expiresAt: now + COUPON_VALIDATION_WINDOW_MS, attempts: 0 };
      this.windows.set(key, window);
    }
    window.attempts = Math.min(
      window.attempts + 1,
      COUPON_VALIDATION_MAX_ATTEMPTS + 1,
    );
    return {
      allowed: window.attempts <= COUPON_VALIDATION_MAX_ATTEMPTS,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((window.expiresAt - now) / 1_000),
      ),
    };
  }
}
// One shared process-local quota across /validate and coupon-bearing /checkout/quote.
// Multi-process deployments need a shared limiter; no coupon value is retained.
const limiter = new CouponValidationLimiter();
export const limitCouponValidation: RequestHandler = (req, res, next) => {
  const key = req.principal
    ? `user:${req.principal.userId}`
    : `ip:${req.ip ?? req.socket.remoteAddress ?? "unknown"}`;
  const result = limiter.attempt(key);
  if (result.allowed) return next();
  res.setHeader("Retry-After", result.retryAfterSeconds);
  res
    .status(429)
    .json({
      code: "PROMOTION_VALIDATION_RATE_LIMITED",
      message: "Too many coupon validation attempts",
    });
};
