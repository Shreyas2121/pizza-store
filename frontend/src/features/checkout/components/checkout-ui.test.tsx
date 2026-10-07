import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PromotionField, type PromotionFieldProps } from "./promotion-field";
import { PricingBreakdown } from "./pricing-breakdown";
import { CheckoutSummary } from "./checkout-summary";
import { PendingPaymentCard } from "./pending-payment-card";
import { useInitiateRazorpayOrder, useRetryRazorpayOrder } from "../api/payment.mutations";
import { useCheckoutQuote, checkoutQuoteKeys } from "../api/quote.queries";
import { validateManualCoupon } from "../api/promotion.mutations";
import { API } from "@/shared/api";
import { cartFixture, couponQuote, quoteFixture, quoteLine, quotePromotion } from "../checkout.test-fixtures";

vi.mock("@/features/auth", () => ({ useUser: () => ({ user: { id: 1 }, isLoggedIn: true }) }));
vi.mock("@/shared/api", async (original) => ({ ...await original<typeof import("@/shared/api")>(), API: { get: vi.fn(), post: vi.fn() } }));
let client: QueryClient;
beforeEach(() => { vi.clearAllMocks(); client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }); });
afterEach(() => client.clear());
const render = (element: ReactElement) => renderToStaticMarkup(<QueryClientProvider client={client}><MantineProvider env="test"><MemoryRouter>{element}</MemoryRouter></MantineProvider></QueryClientProvider>);
const props = (): PromotionFieldProps => ({ code: "SAVE10", appliedCouponCode: null, quote: quoteFixture(), onCodeChange: () => {}, onApply: () => {}, onRemove: () => {} });
const summary = () => ({ cart: cartFixture(), itemCount: 1, code: "", appliedCouponCode: null, quote: quoteFixture(), paymentType: "cash" as const, canPlaceOrder: true, onCodeChange: () => {}, onApplyCoupon: () => {}, onRemoveCoupon: () => {}, onPlaceOrder: () => {}, onRefreshQuote: () => {} });
const renderHook = <T,>(hook: () => T): T => {
  let result: T | undefined;
  function Harness() { result = hook(); return null; }
  render(createElement(Harness));
  if (result === undefined) throw new Error("Hook did not render");
  return result;
};

describe("authoritative promotion presentation", () => {
  it("blocks coupon entry and links server conflicting lines for automatic offers", () => {
    const html = render(<PromotionField {...props()} />);
    expect(html).toContain("Saved offer 7"); expect(html).toContain("Automatic offers");
    expect(html).toContain('href="#checkout-line-41"'); expect(html).toMatch(/<input[^>]*disabled=""/);
    expect(html).toContain('href="/offers"'); expect(html).not.toContain("applied</p>");
  });
  it("explains a deal bundle even with no promotion applications", () => {
    const quote = quoteFixture(); quote.promotions = []; quote.couponEligibility.reasonCode = "DEAL_BUNDLE_PRESENT";
    expect(render(<PromotionField {...props()} quote={quote} />)).toContain("A deal combo is in this cart");
  });
  it("renders only a manually applied coupon in coupon mode", () => {
    const html = render(<PromotionField {...props()} quote={couponQuote()} appliedCouponCode="SAVE10" />);
    expect(html).toContain("Saved coupon"); expect(html).toContain("SAVE10 applied");
    expect(html).toContain("Remove coupon"); expect(html).not.toContain("Automatic offers");
  });
  it("waits for the server quote and announces validation errors with input association", () => {
    const html = render(<PromotionField {...props()} quote={null} error="Coupon is invalid" />);
    expect(html).toContain("Waiting for a current quote"); expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('id="coupon-validation-error"'); expect(html).toContain('role="alert"');
    expect(html).toContain('aria-describedby="coupon-validation-error coupon-eligibility"');
  });
  it("keeps current coupon entry enabled only when eligible", () => {
    const quote = quoteFixture(); quote.discountMode = "none"; quote.promotions = []; quote.couponEligibility = { eligible: true, reasonCode: null, conflictingLineIds: [] };
    expect(render(<PromotionField {...props()} quote={quote} />)).not.toMatch(/<input[^>]*disabled=""/);
  });
});

describe("payable reconciliation and stale state", () => {
  it("renders separate delivery and bundle savings without subtracting them from payable again", () => {
    const html = render(<PricingBreakdown amounts={{ itemsSubtotalPaise: 40_000, itemDiscountPaise: 3_000, chargedDeliveryFeePaise: 0, deliveryDiscountPaise: 5_000, bundleMarkdownPaise: 6_000, totalDisplayedSavingsPaise: 14_000, roundingAdjustmentPaise: 0, grandTotalPaise: 37_000, taxPaise: 1_762 }} />);
    expect(html).toMatch(/Total payable<\/dt><dd[^>]*>[^<]*370.00/);
    expect(html).toMatch(/Delivery savings<\/dt><dd[^>]*>[^<]*50.00/);
    expect(html).toMatch(/Combo markdown<\/dt><dd[^>]*>[^<]*60.00/);
    expect(html).toMatch(/Total displayed savings<\/dt><dd[^>]*>[^<]*140.00/);
    expect(html).toContain("already included");
  });
  it("does not display stale totals/promotions or enable payment while refreshing", () => {
    const html = render(<CheckoutSummary {...summary()} loadingQuote />);
    expect(html).toContain("Calculating current totals"); expect(html).not.toContain("Saved offer 7");
    expect(html).not.toContain("140.00");
    const paymentButton = html.match(/<button\b[^>]*>(?:(?!<\/button>)[\s\S])*Place cash(?:(?!<\/button>)[\s\S])*<\/button>/)?.[0];
    expect(paymentButton).toMatch(/^<button[^>]*disabled=""/);
  });
  it("blocks payment and provides retry when a refreshed quote fails", () => {
    const html = render(<CheckoutSummary {...summary()} quoteError="Pricing unavailable" />);
    expect(html).toContain('role="alert"'); expect(html).toContain("Refresh quote"); expect(html).not.toContain("Saved offer 7");
  });
  it("matches displayed line totals by server line ID rather than response array position", () => {
    const state = summary(); state.cart.items.push({ ...state.cart.items[0], id: 42, productId: 3, product: { ...state.cart.items[0].product, id: 3, name: "Second pizza" } });
    const quote = quoteFixture(); quote.items = [{ ...quoteLine(42), productId: 3, productName: "Second pizza", lineTotalPaise: 20_000 }, quoteLine(41)];
    const html = render(<CheckoutSummary {...state} quote={quote} />);
    expect(html).toMatch(/id="checkout-line-41"[\s\S]*?90.00[\s\S]*?<\/li>/);
    expect(html).toMatch(/id="checkout-line-42"[\s\S]*?200.00[\s\S]*?<\/li>/);
  });
  it("renders zero savings without a marketing savings panel", () => {
    const quote = quoteFixture(); quote.totalDisplayedSavingsPaise = 0;
    expect(render(<PricingBreakdown amounts={quote} />)).not.toContain("Your savings");
  });
});

describe("quote, validation and payment transport", () => {
  it("validates only the manual code and forwards cancellation", async () => {
    vi.mocked(API.post).mockResolvedValue({ data: { data: couponQuote() } });
    const controller = new AbortController(); await validateManualCoupon("SAVE10", controller.signal);
    expect(API.post).toHaveBeenCalledWith("/promotions/validate", { couponCode: "SAVE10" }, { signal: controller.signal });
  });
  it("quotes the owned cart with the address and a revision-scoped cache key", async () => {
    vi.mocked(API.post).mockResolvedValue({ data: { data: quoteFixture() } });
    const request = { storeId: 10, addressId: 2, couponCode: null };
    await renderHook(() => useCheckoutQuote(request, { cartRevision: "cart-a" })).refetch();
    expect(API.post).toHaveBeenCalledWith("/checkout/quote", request, { signal: expect.any(AbortSignal) });
    expect(client.getQueryData(checkoutQuoteKeys.quote(request, 1, "cart-a"))).toBeDefined();
    expect(client.getQueryData(checkoutQuoteKeys.quote(request, 1, "cart-b"))).toBeUndefined();
  });
  it("aborts an obsolete quote rather than letting it refresh another revision", async () => {
    let signal: AbortSignal | undefined;
    vi.mocked(API.post).mockImplementation((_url, _body, config) => { signal = config?.signal instanceof AbortSignal ? config.signal : undefined; return new Promise(() => {}); });
    const pending = renderHook(() => useCheckoutQuote({ storeId: 10 }, { cartRevision: "cart-a" })).refetch();
    await client.cancelQueries({ queryKey: checkoutQuoteKeys.all }); expect(signal?.aborted).toBe(true); await pending;
  });
  it("initiates payment with only an optional manual coupon and retries by saved order ID", async () => {
    vi.mocked(API.post).mockResolvedValue({ data: { data: { localOrderId: 9 } } });
    const request = { addressId: 2, couponCode: "SAVE10", clientRequestId: "request-1" };
    await renderHook(useInitiateRazorpayOrder).mutateAsync(request);
    expect(API.post).toHaveBeenCalledWith("/payments/razorpay/orders", request);
    await renderHook(useRetryRazorpayOrder).mutateAsync(9);
    expect(API.post).toHaveBeenLastCalledWith("/payments/razorpay/orders/9/retry");
  });
  it("explains immutable totals when retrying a saved payment", () => {
    client.setQueryData(["payment-methods"], { cash: true, razorpay: true, providerMode: "simulator" });
    const html = render(<PendingPaymentCard localOrderId={9} amountPaise={37_000} />);
    expect(html).toContain("370.00"); expect(html).toContain("captured prices and promotions");
  });
  it("shows multiple automatic offer names instead of a singular coupon display", () => {
    const quote = quoteFixture(); quote.promotions.push(quotePromotion(8));
    const html = render(<PromotionField {...props()} quote={quote} />);
    expect(html).toContain("Saved offer 7"); expect(html).toContain("Saved offer 8");
  });
});
