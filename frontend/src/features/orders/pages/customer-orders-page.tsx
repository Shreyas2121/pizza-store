import { Button } from "@mantine/core";
import { ArrowRight, Box, ReceiptText } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { useGetOrders } from "../api/order.queries";
import { OrderStatus as OrderStatusType } from "../model/order.types";
import { formatDate, formatPrice } from "@/shared/lib";
import { ListSkeleton, PageHeader, RefreshIndicator } from "@/shared/ui";
import { OrderStatus } from "../components/order-status";


type Filter = "all" | OrderStatusType;
const filters: { label: string; value: Filter }[] = [
  { label: "All", value: "all" },
  { label: "Awaiting payment", value: "awaiting_payment" },
  { label: "Pending", value: "pending" },
  { label: "Preparing", value: "preparing" },
  { label: "Delivered", value: "delievered" },
  { label: "Cancelled", value: "cancelled" },
];

export const CustomerOrdersPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("status") as Filter | null;
  const selected: Filter = filters.some((filter) => filter.value === requested) ? requested! : "all";
  const { data: orders, isLoading, isError, isFetching } = useGetOrders(selected === "all" ? undefined : selected);

  const setFilter = (filter: Filter) => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      if (filter === "all") next.delete("status"); else next.set("status", filter);
      return next;
    });
  };

  return (
    <section>
      <PageHeader eyebrow="Account" title="Order history" description="Review every order and follow its current status." />
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Filter orders by status">
        {filters.map((filter) => <button key={filter.value} type="button" aria-pressed={selected === filter.value} onClick={() => setFilter(filter.value)} className={`min-h-10 shrink-0 rounded-pill border px-4 text-sm font-semibold transition-colors ${selected === filter.value ? "border-brand bg-brand text-white" : "border-border bg-surface text-ink-muted hover:border-brand hover:text-ink"}`}>{filter.label}</button>)}
      </div>
      <RefreshIndicator active={isFetching && !isLoading} label="Refreshing orders" />

      {isLoading ? (
        <ListSkeleton rows={3} rowHeight={92} />
      ) : isError ? (
        <div className="empty-state m-0"><ReceiptText size={34} className="text-brand" /><h2 className="mt-3 text-section-title-scale">Orders unavailable</h2><p className="mt-2 text-supporting-scale">Refresh the page to try again.</p></div>
      ) : !orders?.length ? (
        <div className="empty-state m-0"><span className="grid h-16 w-16 place-items-center rounded-full bg-brand-soft text-brand"><Box size={30} /></span><h2 className="mt-4 text-section-title-scale">No {selected === "all" ? "orders" : filters.find((filter) => filter.value === selected)?.label.toLowerCase() + " orders"} yet</h2><p className="mt-2 text-supporting-scale">When an order matches this view, it will appear here.</p><Button component={Link} to="/#menu" mt="lg">Browse the menu</Button></div>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {orders.map((order) => (
              <Link key={order.id} to={`/order/${order.id}`} className="block rounded-card border border-border bg-surface p-4 shadow-subtle hover:border-brand">
                <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Order #{order.id}</p><p className="mt-1 text-sm text-ink-muted">{order.orderDate ? formatDate(order.orderDate) : "Date unavailable"}</p></div><OrderStatus status={order.status} /></div>
                <div className="mt-4 flex items-end justify-between border-t border-border pt-3"><div><p className="text-xs text-ink-muted">Total</p><p className="font-bold tabular-nums text-ink">{formatPrice(order.totalPrice)}</p></div><span className="inline-flex items-center gap-1 text-sm font-semibold text-brand">View order <ArrowRight size={16} /></span></div>
              </Link>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-card border border-border bg-surface shadow-subtle md:block">
            <table className="w-full">
              <thead className="bg-surface-muted text-left text-xs font-bold uppercase tracking-wide text-ink-muted"><tr><th className="px-5 py-3.5">Order</th><th className="px-5 py-3.5">Date</th><th className="px-5 py-3.5">Status</th><th className="px-5 py-3.5 text-right">Total</th><th className="px-5 py-3.5"><span className="sr-only">Action</span></th></tr></thead>
              <tbody className="divide-y divide-border">{orders.map((order) => <tr key={order.id} className="hover:bg-brand-soft/20"><td className="px-5 py-4 font-semibold text-ink">#{order.id}</td><td className="px-5 py-4 text-sm text-ink-muted">{order.orderDate ? formatDate(order.orderDate) : "Date unavailable"}</td><td className="px-5 py-4"><OrderStatus status={order.status} /></td><td className="px-5 py-4 text-right font-semibold tabular-nums text-ink">{formatPrice(order.totalPrice)}</td><td className="px-5 py-4 text-right"><Button component={Link} to={`/order/${order.id}`} variant="subtle" size="sm" rightSection={<ArrowRight size={15} />}>Details</Button></td></tr>)}</tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
};

export default CustomerOrdersPage;
