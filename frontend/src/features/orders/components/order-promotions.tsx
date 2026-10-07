import { Tag } from "lucide-react";
import { formatPaise } from "@/shared/lib";
import type { OrderPromotion, OrderItemRes } from "../model/order.types";

export const OrderPromotions = ({ promotions, items = [] }: { promotions: OrderPromotion[]; items?: OrderItemRes[] }) => {
  if (promotions.length === 0) return null;
  return (
    <section className="rounded-card border border-basil/20 bg-basil-soft p-4" aria-labelledby="order-promotions-title">
      <h2 id="order-promotions-title" className="flex items-center gap-2 font-semibold"><Tag size={18} aria-hidden />Saved checkout promotions</h2>
      <p className="mt-2 text-sm">Names and savings were captured when this order was created.</p>
      <ul className="mt-3 space-y-3">
        {promotions.map((promotion) => (
          <li key={promotion.applicationId}>
            <p className="font-medium">{promotion.name}{promotion.code && <code className="ml-2">{promotion.code}</code>}</p>
            <p className="text-sm">{promotion.kind === "offer" ? "Automatic offer" : "Manual coupon"} · {promotion.discountType.replace(/_/g, " ")} · {promotion.status}</p>
            <p className="text-sm">Item savings {formatPaise(promotion.itemDiscountPaise)} · Delivery savings {formatPaise(promotion.deliveryDiscountPaise)} · Total {formatPaise(promotion.totalSavingsPaise)}</p>
            {promotion.allocations.length > 0 && <details className="mt-2 text-sm"><summary className="cursor-pointer">Savings allocation</summary><ul>{promotion.allocations.map((allocation, index) => {
              const item = items.find((item) => item.id === allocation.orderItemId);
              return <li key={index}>{allocation.component === "delivery" ? "Delivery" : item ? <a className="underline" href={`#order-line-${item.id}`}>{item.productName}{allocation.unitIndex !== null ? `, unit ${allocation.unitIndex + 1}` : ""}</a> : "Saved item"}: {formatPaise(allocation.amountPaise)}</li>;
            })}</ul></details>}
          </li>
        ))}
      </ul>
    </section>
  );
};
