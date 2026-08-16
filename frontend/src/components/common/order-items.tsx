import { BASE_URL, formatPrice, OrderItemRes } from "@/lib";

const OrderItems = ({ items }: { items: OrderItemRes[] }) => (
  <section className="overflow-hidden rounded-card border border-border bg-surface shadow-subtle" aria-labelledby="order-items-title">
    <div className="border-b border-border px-5 py-4 sm:px-6"><h2 id="order-items-title" className="text-card-title-scale">Order items</h2><p className="mt-1 text-sm text-ink-muted">{items.length} {items.length === 1 ? "item" : "items"} in this order</p></div>
    {items.length === 0 ? <p className="px-5 py-8 text-center text-sm text-ink-muted">No items were found for this order.</p> : (
      <ul className="divide-y divide-border">
        {items.map((item) => (
          <li key={item.id} className="flex gap-4 px-5 py-5 sm:px-6">
            <img src={`${BASE_URL}${item.product.image}`} alt="" className="h-16 w-16 shrink-0 rounded-control bg-surface-muted object-cover sm:h-20 sm:w-20" />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-ink">{item.product.name}</h3><p className="mt-1 text-sm text-ink-muted">Quantity: {item.quantity}</p></div><p className="shrink-0 font-bold tabular-nums text-ink">{formatPrice(item.price)}</p></div>
              {item.options?.length > 0 && <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Customizations">{item.options.map((option) => <li key={option.id} className="rounded-pill bg-surface-muted px-2.5 py-1 text-xs text-ink-muted">{option.name}</li>)}</ul>}
            </div>
          </li>
        ))}
      </ul>
    )}
  </section>
);

export default OrderItems;
