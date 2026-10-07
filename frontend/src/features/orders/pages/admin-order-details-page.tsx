import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { Badge, Button, Card, Select, Text } from "@mantine/core";
import { ArrowLeft, Clock3, Save } from "lucide-react";
import { useGetOrder, useOrderUpdateStatus } from "../api/order.queries";
import { OrderStatus as OT, orderStatus } from "../model/order.types";
import { formatDateTime, formatPrice, success } from "@/shared/lib";
import { DetailsPageSkeleton, PageHeader } from "@/shared/ui";
import { OrderAddress } from "../components/order-address";
import { OrderPromotions } from "../components/order-promotions";
import { OrderItems } from "../components/order-items";
import { OrderStatus } from "../components/order-status";


const nextAction: Record<string, string> = {
  awaiting_payment: "Wait for a captured online payment. This order is not actionable yet.",
  pending: "Confirm the kitchen can begin this order.",
  preparing: "Mark out for delivery once food is packed and dispatched with the rider.",
  out_for_delivery: "Confirm rider handoff to mark delivered.",
  delivered: "No fulfilment action required.",
  cancelled: "This order is closed and cannot progress.",
};

export const AdminOrderDetailsPage = () => {
  const { id } = useParams();
  const orderId = Number(id);
  const { data: order, isLoading, isError } = useGetOrder(orderId);
  const updateOrder = useOrderUpdateStatus();
  const [newStatus, setNewStatus] = useState<OT>("pending");
  useEffect(() => { if (order) setNewStatus(order.status); }, [order]);


  if (isLoading) return <DetailsPageSkeleton admin />;
  if (isError || !order) return <div className="surface-card p-10 text-center"><p className="font-semibold text-danger">Order details could not be loaded.</p><Button component={Link} to="/admin/orders" variant="default" mt="md">Back to orders</Button></div>;

  const isClosed = ["delivered", "cancelled"].includes(order.status);
  const statusUpdateDisabled = isClosed || order.status === "awaiting_payment";
  const orderDate = order.orderDate ? formatDateTime(order.orderDate) : "Date unavailable";
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader eyebrow="Order detail" title={`Order #${order.id}`} description={`Placed ${orderDate}`} action={<Button component={Link} to="/admin/orders" variant="default" leftSection={<ArrowLeft size={16} />}>Back to orders</Button>} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card withBorder><Text size="xs" c="dimmed" tt="uppercase" fw={700}>Order status</Text><div className="mt-2"><OrderStatus status={order.status} /></div></Card>
        <Card withBorder><Text size="xs" c="dimmed" tt="uppercase" fw={700}>Payment</Text><Badge mt="sm" color={order.payment?.status === "completed" ? "basil" : order.payment?.status === "failed" ? "red" : "yellow"} variant="light">{order.payment?.status ?? "Unknown"}</Badge>{order.payment?.providerStatus && <Text size="xs" c="dimmed" mt={4}>Provider: {order.payment.providerStatus}</Text>}</Card>
        <Card withBorder><Text size="xs" c="dimmed" tt="uppercase" fw={700}>Payment type</Text><Text mt="xs" fw={700}>{order.paymentType === "cash" ? "Cash on delivery" : "Razorpay online"}</Text></Card>
        <Card withBorder><Text size="xs" c="dimmed" tt="uppercase" fw={700}>Order total</Text><Text mt="xs" fw={800} size="xl" className="tabular-nums">{formatPrice(order.totalPrice)}</Text></Card>
      </div>

      <Card withBorder radius="lg" padding="lg">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-end">
          <div className="flex gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><Clock3 size={18} /></div><div><Text fw={700}>Next action</Text><Text size="sm" c="dimmed">{nextAction[order.status]}</Text><Text size="xs" c="dimmed" mt={4}>Last updated {formatDateTime(order.updatedAt)}</Text></div></div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end"><Select className="flex-1" label="Update fulfilment status" data={orderStatus} value={newStatus} disabled={statusUpdateDisabled} onChange={(value) => value && setNewStatus(value as OT)} /><Button color="brand" leftSection={<Save size={16} />} disabled={statusUpdateDisabled || newStatus === order.status} loading={updateOrder.isPending} onClick={() => updateOrder.mutate({ orderId: order.id, status: newStatus }, { onSuccess: (response) => success(response.message) })}>Save status</Button></div>
        </div>
      </Card>

      <OrderItems items={order.items} />
      <div className="grid gap-5 lg:grid-cols-2"><OrderAddress address={order.address} /><OrderPromotions promotions={order.promotions} /></div>
    </div>
  );
};

export default AdminOrderDetailsPage;
