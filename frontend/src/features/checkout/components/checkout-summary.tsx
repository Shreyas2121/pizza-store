import { Badge, Button } from "@mantine/core";
import { ChevronRight, LockKeyhole } from "lucide-react";
import { CartRes } from "@/features/cart";
import { BASE_URL } from "@/shared/config";
import { formatPrice } from "@/shared/lib";
import { Coupon } from "../model/checkout.types";
import CouponField from "./coupon-field";

type CheckoutSummaryProps = {
  cart: CartRes;
  itemCount: number;
  code: string;
  coupon: Coupon | null;
  discountAmount: number;
  total: number;
  validatingCoupon?: boolean;
  placingOrder?: boolean;
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
  coupon,
  discountAmount,
  total,
  validatingCoupon,
  placingOrder,
  canPlaceOrder,
  onCodeChange,
  onApplyCoupon,
  onRemoveCoupon,
  onPlaceOrder,
}: CheckoutSummaryProps) => {
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
        {cart.items.map((item) => (
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
              {formatPrice(
                (item.price +
                  item.customizations.reduce((sum, option) => sum + option.price, 0)) *
                  item.quantity
              )}
            </p>
          </li>
        ))}
      </ul>

      <CouponField
        code={code}
        coupon={coupon}
        loading={validatingCoupon}
        onCodeChange={onCodeChange}
        onApply={onApplyCoupon}
        onRemove={onRemoveCoupon}
      />

      <dl className="mt-5 space-y-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-ink-muted">Subtotal</dt>
          <dd className="tabular-nums text-ink">{formatPrice(cart.totalPrice)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-muted">Delivery fee</dt>
          <dd className="tabular-nums text-ink">{formatPrice(0)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-muted">Discount</dt>
          <dd
            className={
              discountAmount > 0 ? "tabular-nums text-basil" : "tabular-nums text-ink"
            }
          >
            {discountAmount > 0 ? "−" : ""}
            {formatPrice(discountAmount)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between border-t border-border pt-4 text-base font-bold">
          <dt>Total</dt>
          <dd className="text-2xl tabular-nums text-brand">{formatPrice(total)}</dd>
        </div>
      </dl>

      <Button
        fullWidth
        size="md"
        mt="lg"
        loading={placingOrder}
        disabled={!canPlaceOrder}
        onClick={onPlaceOrder}
        rightSection={<ChevronRight size={18} />}
      >
        Place cash-on-delivery order
      </Button>

      <p className="mt-3 flex items-start justify-center gap-2 text-center text-xs leading-5 text-ink-muted">
        <LockKeyhole size={15} className="mt-0.5 shrink-0" /> Your order details are
        securely linked to your account.
      </p>
    </aside>
  );
};

export default CheckoutSummary;
