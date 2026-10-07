import { Tag } from "lucide-react";
import { formatPaise } from "@/shared/lib";
import type { OrderPromotion } from "../model/order.types";

export const OrderPromotions = ({ promotions }: { promotions: OrderPromotion[] }) => {
  if (promotions.length === 0) return null;
  return (
    <section className="rounded-card border border-basil/20 bg-basil-soft p-4" aria-labelledby="order-promotions-title">
      <h2 id="order-promotions-title" className="flex items-center gap-2 font-semibold"><Tag size={18} aria-hidden />Checkout promotions</h2>
      <ul className="mt-3 space-y-3">
        {promotions.map((promotion) => (
          <li key={promotion.applicationId}>
            <p className="font-medium">{promotion.name}{promotion.code && <code className="ml-2">{promotion.code}</code>}</p>
            <p className="text-sm">{formatPaise(promotion.totalSavingsPaise)} saved at checkout · {promotion.kind} · {promotion.status}</p>
          </li>
        ))}
      </ul>
    </section>
  );
};
