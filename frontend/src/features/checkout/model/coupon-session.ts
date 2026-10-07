import type { PricingQuote } from "./checkout.types";
import { checkoutErrorMessage } from "./checkout.helpers";

type CouponState = { code: string; appliedCode: string | null; pending: boolean; error: string | null; message: string | null };
type Validator = (code: string, signal: AbortSignal) => Promise<PricingQuote>;
const emptyState = (): CouponState => ({ code: "", appliedCode: null, pending: false, error: null, message: null });

// One session per account/cart/address context. Obsolete validation never updates a new session.
export class CouponSession {
  constructor(readonly contextKey: string) {}
  private state = emptyState();
  private listeners = new Set<() => void>();
  private request: AbortController | null = null;
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(state: CouponState) { this.state = state; this.listeners.forEach((listener) => listener()); }
  setCode = (code: string) => {
    if (this.state.pending || this.state.appliedCode) return;
    this.update({ ...this.state, code: code.toUpperCase(), error: null, message: null });
  };
  cancel = () => { this.request?.abort(); this.request = null; if (this.state.pending) this.update({ ...this.state, pending: false }); };
  remove = (message: string | null = null) => { this.cancel(); this.update({ ...emptyState(), message }); };
  showError = (message: string) => this.update({ ...this.state, error: message, message: null });
  async apply(eligible: boolean, validate: Validator) {
    if (this.state.pending || this.state.appliedCode || !eligible) return;
    const code = this.state.code.trim().toUpperCase();
    if (!code) { this.update({ ...this.state, error: "Enter a coupon code." }); return; }
    const request = new AbortController();
    this.request = request;
    this.update({ ...this.state, pending: true, error: null, message: null });
    try {
      const quote = await validate(code, request.signal);
      if (request.signal.aborted) return;
      const coupon = quote.discountMode === "coupon" && quote.couponEligibility.eligible && quote.promotions.find((p) => p.kind === "coupon" && p.code === code);
      if (!coupon || quote.promotions.some((p) => p.kind === "offer")) throw new Error("Coupon was not applied.");
      this.update({ code, appliedCode: code, pending: false, error: null, message: "Coupon validated. Confirming your delivery quote…" });
    } catch (cause) {
      if (request.signal.aborted) return;
      this.update({ ...this.state, pending: false, error: checkoutErrorMessage(cause, "The coupon could not be validated. Check the code and try again."), message: null });
    } finally {
      if (this.request === request) this.request = null;
    }
  }
}
