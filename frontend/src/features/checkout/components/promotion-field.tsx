import { Button, TextInput } from "@mantine/core";
import { Link } from "react-router";
import { useEffect, useRef } from "react";
import { formatPaise } from "@/shared/lib";
import { PROMOTION_CODE_MAX_LENGTH } from "@/features/promotions";
import type { PricingQuote } from "../model/checkout.types";

export type PromotionFieldProps = {
  code: string;
  appliedCouponCode: string | null;
  quote: PricingQuote | null;
  loading?: boolean;
  disabled?: boolean;
  error?: string | null;
  message?: string | null;
  onCodeChange: (code: string) => void;
  onApply: () => void;
  onRemove: () => void;
};

export function PromotionField({ code, appliedCouponCode, quote, loading, disabled, error, message, onCodeChange, onApply, onRemove }: PromotionFieldProps) {
  const errorRef = useRef<HTMLSpanElement>(null);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  const eligible = quote?.couponEligibility.eligible === true;
  const reason = quote?.couponEligibility.reasonCode;
  const conflicts = quote?.items.filter((item) => quote.couponEligibility.conflictingLineIds.includes(item.lineId)) ?? [];
  const coupon = quote?.discountMode === "coupon" ? quote.promotions.find((p) => p.kind === "coupon") : undefined;
  const offers = quote?.discountMode === "automatic_deals" ? quote.promotions.filter((p) => p.kind === "offer") : [];
  return <section className="mt-4" aria-labelledby="checkout-promotions-title">
    <h3 id="checkout-promotions-title" className="font-semibold">Offers and coupon</h3>
    {offers.length > 0 && <div className="my-3 rounded-control bg-basil-soft p-3"><p className="text-sm font-semibold">Automatic offers</p><ul>{offers.map((offer) => <li className="text-sm" key={offer.id}>{offer.name} — Item saving {formatPaise(offer.itemDiscountPaise)}, delivery saving {formatPaise(offer.deliveryDiscountPaise)}</li>)}</ul></div>}
    {!!conflicts.length && <ul className="mb-3 text-sm" aria-label="Items blocking coupons">{conflicts.map((item) => <li key={item.lineId}><a className="underline" href={`#checkout-line-${item.lineId}`}>{item.productName}</a></li>)}</ul>}
    <div className="flex items-end gap-2">
      <TextInput id="coupon-code" label="Coupon code"
        description={reason === "OFFER_APPLIED" ? "Automatic offers apply to this order, so a coupon cannot be combined with them." : reason === "DEAL_BUNDLE_PRESENT" ? "A deal combo is in this cart, so a coupon cannot be combined with it." : !quote ? "Waiting for a current quote before checking coupon eligibility." : "Enter one coupon manually. Checkout confirms the final saving."}
        descriptionProps={{ id: "coupon-eligibility" }}
        error={error ? <span ref={errorRef} tabIndex={-1} role="alert">{error}</span> : undefined}
        errorProps={{ id: "coupon-validation-error" }}
        value={code} disabled={!eligible || !!appliedCouponCode || disabled || loading} maxLength={PROMOTION_CODE_MAX_LENGTH} placeholder="Enter code" onChange={(event) => onCodeChange(event.currentTarget.value.toUpperCase())} className="min-w-0 flex-1" />
      <Button onClick={appliedCouponCode ? onRemove : onApply} loading={loading} disabled={disabled || (!appliedCouponCode && (!eligible || !code.trim()))}>{appliedCouponCode ? "Remove coupon" : "Apply coupon"}</Button>
    </div>
    {coupon && <p className="mt-2 text-sm text-basil" role="status">{coupon.name} · {coupon.code} applied</p>}
    {message && !coupon && <p role="status" className="mt-2 text-sm">{message}</p>}
    <p className="mt-3 text-xs text-ink-muted">Changing your cart or delivery address clears the coupon. Enter it again to revalidate.</p>
    <Link to="/offers" className="tertiary-button mt-2">View offers</Link>
  </section>;
}
