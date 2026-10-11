import { Badge, Button } from "@mantine/core";
import { ChevronRight, LockKeyhole } from "lucide-react";
import type { CartRes } from "@/features/cart";
import { imageUrl } from "@/shared/config";
import { formatPaise } from "@/shared/lib";
import type { PaymentType, PricingQuote } from "../model/checkout.types";
import { PromotionField } from "./promotion-field";
import { PricingBreakdown } from "./pricing-breakdown";

type CheckoutSummaryProps = {
  cart: CartRes; itemCount: number; code: string; appliedCouponCode: string | null;
  quote: PricingQuote | null; loadingQuote?: boolean; quoteError?: string | null;
  validatingCoupon?: boolean; couponError?: string | null; couponMessage?: string | null;
  placingOrder?: boolean; paymentType: PaymentType; paymentStatusMessage?: string | null;
  canPlaceOrder: boolean; onCodeChange: (code: string) => void; onApplyCoupon: () => void;
  onRemoveCoupon: () => void; onPlaceOrder: () => void; onRefreshQuote: () => void;
};

export function CheckoutSummary(props: CheckoutSummaryProps) {
  const { cart, itemCount, code, appliedCouponCode, loadingQuote, quoteError, validatingCoupon,
    couponError, couponMessage, placingOrder, paymentType, paymentStatusMessage, canPlaceOrder,
    onCodeChange, onApplyCoupon, onRemoveCoupon, onPlaceOrder, onRefreshQuote } = props;
  const quote = !loadingQuote && !quoteError ? props.quote : null;
  return <aside className="rounded-card border border-border bg-surface p-5 shadow-subtle lg:sticky lg:top-32" aria-labelledby="checkout-summary-title" aria-busy={loadingQuote || validatingCoupon || placingOrder}>
    <div className="flex items-center justify-between gap-3">
      <h2 id="checkout-summary-title" className="text-card-title-scale">Order summary</h2>
      <Badge color="brand" variant="light">{itemCount} {itemCount === 1 ? "item" : "items"}</Badge>
    </div>
    <ul className="mt-4 max-h-72 space-y-3 overflow-y-auto border-y border-border py-4" aria-label="Checkout items">
      {cart.items.map((item) => {
        const line = quote?.items.find((line) => line.lineId === item.id);
        return <li id={`checkout-line-${item.id}`} key={item.id} className="scroll-mt-32">
          <div className="flex gap-3">
            <img src={imageUrl(item.product.image)} alt="" className="h-12 w-12 rounded-lg object-cover" />
            <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-ink">{line?.productName ?? item.product.name}</p><p className="text-xs text-ink-muted">Qty {item.quantity}</p></div>
            <p className="text-sm font-semibold tabular-nums">{line ? formatPaise(line.lineTotalPaise) : "Calculating…"}</p>
          </div>
          {line && line.itemDiscountPaise > 0 && <p className="mt-1 text-xs text-basil">Item saving: {formatPaise(line.itemDiscountPaise)}</p>}
          {line?.productType === "bundle" && <details className="mt-2 text-sm"><summary className="cursor-pointer">Saved combo contents</summary><ul>{line.bundleComponents.map((component) => <li key={component.productId}>{component.totalQuantity} × {component.name}</li>)}</ul><p>Regular price per combo: <s>{formatPaise(line.compareAtUnitPricePaise ?? line.unitPricePaise)}</s> · Combo markdown: {formatPaise(line.bundleMarkdownPaise)}</p></details>}
        </li>;
      })}
    </ul>
    <PromotionField code={code} appliedCouponCode={appliedCouponCode} quote={quote} loading={validatingCoupon} disabled={placingOrder || loadingQuote} error={couponError} message={couponMessage} onCodeChange={onCodeChange} onApply={onApplyCoupon} onRemove={onRemoveCoupon} />
    {quoteError && <p role="alert" className="mt-3 rounded-control bg-red-50 p-3 text-sm text-danger">{quoteError}</p>}
    {quote ? <PricingBreakdown amounts={quote} /> : <p role="status" className="mt-5">{quoteError ? "A current quote is required before ordering." : "Calculating current totals…"}</p>}
    {quote?.tax.disclaimer && <p className="mt-2 text-xs text-ink-muted">{quote.tax.disclaimer}</p>}
    <button className="tertiary-button mt-3" type="button" disabled={loadingQuote || placingOrder || validatingCoupon} onClick={onRefreshQuote}>Refresh quote</button>
    <Button fullWidth size="md" mt="lg" loading={placingOrder} disabled={!canPlaceOrder || !quote || loadingQuote || validatingCoupon || placingOrder} onClick={onPlaceOrder} rightSection={<ChevronRight size={18} />}>
      {paymentType === "cash" ? "Place cash-on-delivery order" : "Pay securely"}
    </Button>
    {paymentStatusMessage && <p className="mt-3 rounded-control bg-brand-soft p-3 text-center text-sm font-semibold" role="status">{paymentStatusMessage}</p>}
    <p className="mt-3 flex items-start justify-center gap-2 text-center text-xs leading-5 text-ink-muted"><LockKeyhole size={15} className="mt-0.5 shrink-0" aria-hidden="true" />{paymentType === "cash" ? "Your order details are securely linked to your account." : "Payment details are handled securely by Razorpay. We never receive your card or UPI credentials."}</p>
  </aside>;
}
export default CheckoutSummary;
