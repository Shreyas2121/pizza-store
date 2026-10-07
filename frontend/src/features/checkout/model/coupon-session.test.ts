import { describe, expect, it, vi } from "vitest";
import { CouponSession } from "./coupon-session";
import { cartFixture, couponQuote, quoteFixture } from "../checkout.test-fixtures";
import { checkoutContextKey, checkoutErrorMessage, couponNeedsRemoval, quoteMatchesCart, retryCheckoutQuery } from "./checkout.helpers";

describe("manual coupon lifecycle", () => {
  it("validates only explicit manual input and uses the server coupon result", async () => {
    const session = new CouponSession("cart-a");
    const validate = vi.fn().mockResolvedValue(couponQuote());
    await session.apply(true, validate);
    expect(validate).not.toHaveBeenCalled();
    expect(session.getSnapshot().error).toContain("Enter a coupon");
    session.setCode(" save10 ");
    await session.apply(true, validate);
    expect(validate).toHaveBeenCalledWith("SAVE10", expect.any(AbortSignal));
    expect(session.getSnapshot().appliedCode).toBe("SAVE10");
  });
  it("does not validate when the authoritative quote blocks coupons", async () => {
    const session = new CouponSession("cart-a"); session.setCode("SAVE10");
    const validate = vi.fn(); await session.apply(false, validate);
    expect(validate).not.toHaveBeenCalled(); expect(session.getSnapshot().appliedCode).toBeNull();
  });
  it("rejects an offer response and a different coupon code", async () => {
    const session = new CouponSession("cart-a"); session.setCode("SAVE10");
    await session.apply(true, async () => quoteFixture());
    expect(session.getSnapshot().appliedCode).toBeNull();
    const wrong = couponQuote(); wrong.promotions[0].code = "OTHER";
    await session.apply(true, async () => wrong);
    expect(session.getSnapshot().error).toBeTruthy();
  });
  it("prevents repeated requests while validation is pending", async () => {
    const session = new CouponSession("cart-a"); session.setCode("SAVE10");
    let complete: ((quote: ReturnType<typeof couponQuote>) => void) | undefined;
    const validate = vi.fn(() => new Promise<ReturnType<typeof couponQuote>>((resolve) => { complete = resolve; }));
    const pending = session.apply(true, validate); await session.apply(true, validate);
    expect(session.getSnapshot().pending).toBe(true); expect(validate).toHaveBeenCalledTimes(1);
    complete?.(couponQuote()); await pending; expect(session.getSnapshot().pending).toBe(false);
  });
  it("aborts validation and ignores a late response after removal/context disposal", async () => {
    const session = new CouponSession("cart-a"); session.setCode("SAVE10");
    let complete: ((quote: ReturnType<typeof couponQuote>) => void) | undefined;
    let signal: AbortSignal | undefined;
    const pending = session.apply(true, (_code, requestSignal) => { signal = requestSignal; return new Promise((resolve) => { complete = resolve; }); });
    session.remove(); expect(signal?.aborted).toBe(true);
    const next = new CouponSession("cart-b");
    complete?.(couponQuote()); await pending;
    expect(session.getSnapshot().appliedCode).toBeNull(); expect(next.getSnapshot().code).toBe("");
  });
  it("retains validation errors and allows an explicit retry", async () => {
    const session = new CouponSession("cart-a"); session.setCode("SAVE10");
    await session.apply(true, async () => { throw new Error("offline"); });
    expect(session.getSnapshot().error).toBeTruthy(); expect(session.getSnapshot().pending).toBe(false);
    await session.apply(true, async () => couponQuote()); expect(session.getSnapshot().error).toBeNull();
    session.remove("Cart changed; revalidate."); expect(session.getSnapshot().message).toContain("revalidate");
  });
});
describe("quote context and errors", () => {
  it("changes context for quantity, customization, account, store and address changes", () => {
    const cart = cartFixture(); const original = checkoutContextKey(1, 10, 2, cart);
    expect(checkoutContextKey(2, 10, 2, cart)).not.toBe(original);
    expect(checkoutContextKey(1, 20, 2, cart)).not.toBe(original);
    expect(checkoutContextKey(1, 10, 3, cart)).not.toBe(original);
    cart.items[0].quantity = 2; expect(checkoutContextKey(1, 10, 2, cart)).not.toBe(original);
    cart.items[0].quantity = 1; cart.items[0].customizations = [{ optionId: 3, name: "Cheese", pricePaise: 100 }];
    expect(checkoutContextKey(1, 10, 2, cart)).not.toBe(original);
  });
  it("requires quote lines to match cart identity and quantities without checking prices locally", () => {
    const quote = quoteFixture(); const cart = cartFixture();
    expect(quoteMatchesCart(quote, cart)).toBe(true);
    quote.items[0].unitPricePaise = 500; expect(quoteMatchesCart(quote, cart)).toBe(true);
    quote.items[0].quantity = 2; expect(quoteMatchesCart(quote, cart)).toBe(false);
    quote.items[0].quantity = 1; quote.items[0].lineId = 100; expect(quoteMatchesCart(quote, cart)).toBe(false);
  });
  it("maps exclusivity by stable code and does not interpret message text", () => {
    const cause = { isAxiosError: true, response: { status: 400, data: { code: "COUPON_NOT_COMBINABLE_WITH_OFFERS", message: "opaque server text" } } };
    expect(couponNeedsRemoval(cause)).toBe(true); expect(checkoutErrorMessage(cause, "fallback")).toContain("automatic offers");
    expect(couponNeedsRemoval({ isAxiosError: true, response: { data: { message: "COUPON_NOT_COMBINABLE_WITH_OFFERS" } } })).toBe(false);
    expect(retryCheckoutQuery(0, cause)).toBe(false); expect(retryCheckoutQuery(0, new Error("offline"))).toBe(true); expect(retryCheckoutQuery(1, new Error("offline"))).toBe(false);
  });
});
