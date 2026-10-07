import { BASE_URL } from "@/shared/config";
import { formatPaise } from "@/shared/lib";

import { OrderItemRes } from "../model/order.types";

export const OrderItems = ({ items }: { items: OrderItemRes[] }) => (
  <section className="overflow-hidden rounded-card border border-border bg-surface shadow-subtle" aria-labelledby="order-items-title">
    <div className="border-b border-border px-5 py-4 sm:px-6">
      <h2 id="order-items-title" className="text-card-title-scale">Order items</h2>
      <p className="mt-1 text-sm text-ink-muted">{items.length} {items.length === 1 ? "item" : "items"} in this order</p>
    </div>
    {items.length === 0 ? (
      <p className="px-5 py-8 text-center text-sm text-ink-muted">No items were found for this order.</p>
    ) : (
      <ul className="divide-y divide-border">
        {items.map((item) => (
          <li id={`order-line-${item.id}`} key={item.id} className="flex scroll-mt-32 gap-4 px-5 py-5 sm:px-6">
            {item.product.image && <img src={`${BASE_URL}${item.product.image}`} alt="" className="h-16 w-16 shrink-0 rounded-control bg-surface-muted object-cover sm:h-20 sm:w-20" />}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-ink">{item.productName}</h3>
                  <p className="mt-1 text-sm text-ink-muted">Quantity: {item.quantity}</p>
                </div>
                <div className="shrink-0 text-right"><p className="text-xs text-ink-muted">Line total after discount</p><p className="font-bold tabular-nums text-ink">{formatPaise(item.lineTotalPaise)}</p></div>
              </div>
              <p className="mt-2 text-xs text-ink-muted">Unit price {formatPaise(item.unitPricePaise)} · Item discount {formatPaise(item.discountAllocationPaise)} · Included tax {formatPaise(item.taxPaise)}</p>
              {item.options && item.options.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Customizations">
                  {item.options.map((option) => (
                    <li key={option.id} className="rounded-pill bg-surface-muted px-2.5 py-1 text-xs text-ink-muted">
                      {option.name}
                    </li>
                  ))}
                </ul>
              )}
              {item.productType === "bundle" && (
                <div className="mt-3 text-sm text-ink-muted">
                  {item.compareAtUnitPricePaise !== null && <p>Saved regular price per combo: <s>{formatPaise(item.compareAtUnitPricePaise)}</s> · Combo markdown for this line: {formatPaise(item.bundleMarkdownPaise)}</p>}
                  <details><summary className="cursor-pointer">Saved combo contents</summary><ul aria-label="Bundle contents">{item.bundleComponents.map((component) => <li key={component.componentProductId}>{component.totalQuantity} × {component.name} ({component.quantityPerBundle} per combo)</li>)}</ul></details>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    )}
  </section>
);

export default OrderItems;
