import { Button } from "@mantine/core";
import { ArrowRight } from "lucide-react";
import { formatPrice } from "@/shared/lib";

type CartSummaryProps = {
  subtotal: number;
  itemCount: number;
  loading?: boolean;
  disabled?: boolean;
  onCheckout: () => void;
};

export const CartSummary = ({
  subtotal,
  itemCount,
  loading,
  disabled,
  onCheckout,
}: CartSummaryProps) => {
  return (
    <>
      <aside
        className="sticky top-32 hidden rounded-card border border-border bg-surface p-5 shadow-subtle lg:block"
        aria-labelledby="cart-summary-title"
      >
        <h2 id="cart-summary-title" className="text-card-title-scale">
          Order summary
        </h2>
        <dl className="mt-5 space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-muted">Items subtotal</dt>
            <dd className="font-medium tabular-nums text-ink">
              {formatPrice(subtotal)}
            </dd>
          </div>
          <div className="flex justify-between border-t border-border pt-4 text-base font-bold">
            <dt>Subtotal</dt>
            <dd className="text-xl tabular-nums text-brand">
              {formatPrice(subtotal)}
            </dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-ink-muted">
          Delivery fee, discounts, and included taxes are calculated at checkout.
        </p>
        <Button
          fullWidth
          size="md"
          mt="lg"
          onClick={onCheckout}
          loading={loading}
          disabled={disabled}
          rightSection={<ArrowRight size={18} />}
        >
          Continue to checkout
        </Button>
        <p className="mt-3 text-center text-xs text-ink-muted">
          You can review delivery and payment before placing the order.
        </p>
      </aside>

      {itemCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(32,26,23,0.1)] backdrop-blur-md lg:hidden">
          <div className="mx-auto flex max-w-storefront items-center justify-between gap-4">
            <div>
              <p className="text-xs text-ink-muted">
                {itemCount} {itemCount === 1 ? "item" : "items"}
              </p>
              <p className="text-lg font-bold tabular-nums text-ink">
                {formatPrice(subtotal)}
              </p>
            </div>
            <Button
              size="md"
              onClick={onCheckout}
              loading={loading}
              disabled={disabled}
              rightSection={<ArrowRight size={17} />}
            >
              Checkout
            </Button>
          </div>
        </div>
      )}
    </>
  );
};

export default CartSummary;
