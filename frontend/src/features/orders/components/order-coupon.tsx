import { BadgePercent } from "lucide-react";
import { Coupon } from "@/features/checkout";
import { formatPrice } from "@/shared/lib";

export const OrderCoupon = ({ coupon }: { coupon: Coupon }) => (
  <section className="rounded-card border border-basil/20 bg-basil-soft p-4" aria-labelledby="coupon-title">
    <div className="flex items-center gap-2 text-basil">
      <BadgePercent size={18} aria-hidden="true" />
      <h2 id="coupon-title" className="font-semibold">Coupon applied</h2>
    </div>
    <div className="mt-3 flex items-center justify-between gap-3">
      <code className="rounded bg-surface px-2.5 py-1 text-sm font-bold text-ink">{coupon.code}</code>
      <span className="text-sm font-semibold text-basil">
        {coupon.discountType === "percentage" ? `${coupon.discountValue}% off` : `${formatPrice(coupon.discountValue)} off`}
      </span>
    </div>
  </section>
);

export default OrderCoupon;
