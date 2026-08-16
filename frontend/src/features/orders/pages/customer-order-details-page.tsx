import { Badge, Button, Skeleton } from "@mantine/core";
import { ArrowLeft, Check, ChefHat, Clock3, CreditCard, PackageCheck, ReceiptText } from "lucide-react";
import { Link, useParams } from "react-router";
import { useGetOrder } from "../api/order.queries";
import { formatPrice } from "@/shared/lib";
import { PageHeader } from "@/shared/ui";
import { OrderAddress } from "../components/order-address";
import { OrderCoupon } from "../components/order-coupon";
import { OrderItems } from "../components/order-items";
import { OrderStatus } from "../components/order-status";


export const CustomerOrderDetailsPage = () => {
  const { id } = useParams();
  const orderId = Number(id);
  const { data: order, isLoading, isError } = useGetOrder(orderId);

  if (isLoading) return <div className="space-y-5"><Skeleton height={90} radius="lg" /><Skeleton height={170} radius="lg" /><div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]"><Skeleton height={320} radius="lg" /><Skeleton height={320} radius="lg" /></div></div>;

  if (isError || !order) {
    return <div className="empty-state m-0"><ReceiptText size={36} className="text-brand" /><h2 className="mt-3 text-section-title-scale">Order unavailable</h2><p className="mt-2 text-supporting-scale">This order could not be found or does not belong to your account.</p><Button component={Link} to="/orders" mt="lg" variant="light" leftSection={<ArrowLeft size={17} />}>Back to orders</Button></div>;
  }

  const placedOn = order.orderDate ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(order.orderDate)) : "Date unavailable";
  const isDelivered = order.status === "delivered" || order.status === "delievered";
  const progress = order.status === "preparing" ? 1 : isDelivered ? 2 : 0;
  const subtotal = order.totalPrice + order.discountAmount;
  const timeline = [
    { label: "Order received", description: "We have your order", icon: Clock3 },
    { label: "Preparing", description: "Fresh in the kitchen", icon: ChefHat },
    { label: "Delivered", description: "Arrived at your door", icon: PackageCheck },
  ];

  return (
    <section>
      <PageHeader
        eyebrow={<Link to="/orders" className="inline-flex items-center gap-1.5 hover:text-brand-hover"><ArrowLeft size={14} /> Order history</Link>}
        title={`Order #${order.id}`}
        description={`Placed on ${placedOn}`}
        action={<OrderStatus status={order.status} />}
      />

      {order.status === "cancelled" ? (
        <div className="mb-5 rounded-card border border-red-200 bg-red-50 p-5"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-red-100 text-danger">×</span><div><h2 className="font-semibold text-danger">This order was cancelled</h2><p className="mt-1 text-sm text-red-800/75">The order will not move to preparation or delivery.</p></div></div></div>
      ) : (
        <section className="mb-5 rounded-card border border-border bg-surface p-5 shadow-subtle sm:p-6" aria-labelledby="order-progress-title">
          <h2 id="order-progress-title" className="text-card-title-scale">Order progress</h2>
          <ol className="mt-5 grid gap-0 sm:grid-cols-3">
            {timeline.map((step, index) => {
              const complete = index <= progress;
              const Icon = step.icon;
              return (
                <li key={step.label} className="relative flex gap-3 pb-5 last:pb-0 sm:block sm:pb-0 sm:text-center">
                  {index < timeline.length - 1 && <span className={`absolute left-5 top-10 h-[calc(100%-2rem)] w-0.5 sm:left-1/2 sm:top-5 sm:h-0.5 sm:w-full ${index < progress ? "bg-basil" : "bg-border"}`} aria-hidden="true" />}
                  <span className={`relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 sm:mx-auto ${complete ? "border-basil bg-basil text-white" : "border-border bg-surface text-ink-muted"}`}>{index < progress || isDelivered ? <Check size={18} /> : <Icon size={18} />}</span>
                  <div className="sm:mt-3"><p className={`font-semibold ${complete ? "text-ink" : "text-ink-muted"}`}>{step.label}</p><p className="mt-0.5 text-xs text-ink-muted">{step.description}</p></div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 rounded-card border border-border bg-surface p-4 shadow-subtle sm:grid-cols-4 sm:p-5">
        <div><p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Order status</p><div className="mt-2"><OrderStatus status={order.status} /></div></div>
        <div><p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Payment</p><Badge mt={8} color={order.payment?.status === "completed" ? "basil" : "yellow"} variant="light">{order.payment?.status ?? "Pending"}</Badge></div>
        <div><p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Method</p><p className="mt-2 text-sm font-semibold text-ink">{order.paymentType === "cash" ? "Cash on delivery" : order.paymentType}</p></div>
        <div><p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Total</p><p className="mt-1 text-xl font-bold tabular-nums text-brand">{formatPrice(order.totalPrice)}</p></div>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <OrderItems items={order.items} />
        <aside className="space-y-4">
          <OrderAddress address={order.address} />
          <section className="rounded-card border border-border bg-surface p-5 shadow-subtle" aria-labelledby="payment-title">
            <div className="flex items-center gap-2"><CreditCard size={19} className="text-brand" /><h2 id="payment-title" className="font-semibold text-ink">Payment details</h2></div>
            <dl className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-3"><dt className="text-ink-muted">Subtotal</dt><dd className="tabular-nums text-ink">{formatPrice(subtotal)}</dd></div>{order.discountAmount > 0 && <div className="flex justify-between gap-3 text-basil"><dt>Discount</dt><dd className="tabular-nums">−{formatPrice(order.discountAmount)}</dd></div>}<div className="flex justify-between gap-3 border-t border-border pt-3 text-base font-bold"><dt>Total</dt><dd className="tabular-nums text-brand">{formatPrice(order.totalPrice)}</dd></div></dl>
          </section>
          {order.coupon && <OrderCoupon coupon={order.coupon} />}
        </aside>
      </div>
    </section>
  );
};

export default CustomerOrderDetailsPage;
