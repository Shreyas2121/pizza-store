import { Badge, Button } from "@mantine/core";
import { ChevronRight, LockKeyhole } from "lucide-react";
import { CartRes } from "@/features/cart";
import { BASE_URL } from "@/shared/config";
import { formatPaise } from "@/shared/lib";
import { PaymentType, PricingQuote } from "../model/checkout.types";
import CouponField from "./coupon-field";

type CheckoutSummaryProps = {
  cart: CartRes;
  itemCount: number;
  code: string;
  appliedCouponCode: string | null;
  quote: PricingQuote | null;
  loadingQuote?: boolean;
  quoteError?: string | null;
  validatingCoupon?: boolean;
  placingOrder?: boolean;
  paymentType: PaymentType;
  paymentStatusMessage?: string | null;
  canPlaceOrder: boolean;
  onCodeChange: (code: string) => void;
  onApplyCoupon: () => void;
  onRemoveCoupon: () => void;
  onPlaceOrder: () => void;
};

export const CheckoutSummary = ({
  cart,
  itemCount,
  code,
  appliedCouponCode,
  quote,
  loadingQuote,
  quoteError,
  validatingCoupon,
  placingOrder,
  paymentType,
  paymentStatusMessage,
  canPlaceOrder,
  onCodeChange,
  onApplyCoupon,
  onRemoveCoupon,
  onPlaceOrder,
}: CheckoutSummaryProps) => {
  const subtotalFormatted = quote ? formatPaise(quote.itemsSubtotalPaise) : "Calculating…";

  const discountPaise = quote?.itemDiscountPaise ?? 0;
  const deliveryFeePaise = quote?.chargedDeliveryFeePaise ?? 0;
  const isFreeDelivery =
    (quote !== null && deliveryFeePaise === 0);

  const grandTotalFormatted = quote ? formatPaise(quote.grandTotalPaise) : "Calculating…";

  return (
    <aside
      className="rounded-card border border-border bg-surface p-5 shadow-subtle lg:sticky lg:top-32"
      aria-labelledby="checkout-summary-title"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="checkout-summary-title" className="text-card-title-scale">
          Order summary
        </h2>
        <Badge color="brand" variant="light">
          {itemCount} {itemCount === 1 ? "item" : "items"}
        </Badge>
      </div>

      <ul className="mt-4 max-h-52 space-y-3 overflow-y-auto border-y border-border py-4">
        {cart.items.map((item, index) => (
          <li key={item.id} className="flex gap-3">
            <img
              src={`${BASE_URL}${item.product.image}`}
              alt=""
              className="h-12 w-12 rounded-lg object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">
                {item.product.name}
              </p>
              <p className="text-xs text-ink-muted">Qty {item.quantity}</p>
            </div>
            <p className="text-sm font-semibold tabular-nums text-ink">
              {quote ? formatPaise(quote.items[index]?.lineSubtotalPaise ?? 0) : "Calculating…"}
            </p>
          </li>
        ))}
      </ul>

      <CouponField
        code={code}
        appliedCouponCode={appliedCouponCode}
        loading={validatingCoupon || loadingQuote}
        onCodeChange={onCodeChange}
        onApply={onApplyCoupon}
        onRemove={onRemoveCoupon}
      />

      {quoteError && (
        <p className="mt-3 rounded-control bg-red-50 px-3 py-2 text-xs font-medium text-danger">
          {quoteError}
        </p>
      )}

      <dl className="mt-5 space-y-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-ink-muted">Subtotal</dt>
          <dd className="tabular-nums text-ink">{subtotalFormatted}</dd>
        </div>

        <div className="flex justify-between">
          <dt className="text-ink-muted">Delivery fee</dt>
          <dd className="tabular-nums text-ink">
            {quote ? (
              isFreeDelivery ? (
                <span className="font-semibold text-basil">FREE</span>
              ) : (
                formatPaise(deliveryFeePaise)
              )
            ) : (
              <span className="text-ink-muted">Calculating…</span>
            )}
          </dd>
        </div>

        {discountPaise > 0 && (
          <div className="flex justify-between">
            <dt className="text-ink-muted">Discount</dt>
            <dd className="tabular-nums text-basil">
              −{formatPaise(discountPaise)}
            </dd>
          </div>
        )}

        {quote && quote.taxPaise > 0 && (
          <div className="flex justify-between text-xs text-ink-muted">
            <dt>Included tax (demo)</dt>
            <dd className="tabular-nums">{formatPaise(quote.taxPaise)}</dd>
          </div>
        )}

        <div className="flex items-baseline justify-between border-t border-border pt-4 text-base font-bold">
          <dt>Total</dt>
          <dd className="text-2xl tabular-nums text-brand">
            {grandTotalFormatted}
          </dd>
        </div>
      </dl>

      {quote?.tax.disclaimer && (
        <p className="mt-2 text-right text-[11px] text-ink-muted">
          {quote.tax.disclaimer}
        </p>
      )}

      <Button
        fullWidth
        size="md"
        mt="lg"
        loading={placingOrder || loadingQuote}
        disabled={!canPlaceOrder}
        onClick={onPlaceOrder}
        rightSection={<ChevronRight size={18} />}
      >
        {paymentType === "cash" ? "Place cash-on-delivery order" : "Pay securely"}
      </Button>

      {paymentStatusMessage && (
        <p className="mt-3 rounded-control bg-brand-soft px-3 py-2 text-center text-sm font-semibold text-ink" role="status">
          {paymentStatusMessage}
        </p>
      )}

      <p className="mt-3 flex items-start justify-center gap-2 text-center text-xs leading-5 text-ink-muted">
        <LockKeyhole size={15} className="mt-0.5 shrink-0" />
        {paymentType === "cash"
          ? "Your order details are securely linked to your account."
          : "Payment details are handled securely by Razorpay. We never receive your card or UPI credentials."}
      </p>
    </aside>
  );
};

export default CheckoutSummary;
