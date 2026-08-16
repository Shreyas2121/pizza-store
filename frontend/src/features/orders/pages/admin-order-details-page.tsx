import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { Badge, Button, Card, Select, Skeleton, Text } from "@mantine/core";
import dayjs from "dayjs";
import { ArrowLeft, Clock3, Save } from "lucide-react";
import { useGetOrder, useOrderUpdateStatus } from "../api/order.queries";
import { OrderStatus as OT, orderStatus } from "../model/order.types";
import { formatPrice, success } from "@/shared/lib";
import { OrderAddress, OrderCoupon, OrderItems, OrderStatus, PageHeader } from "@/components/common";

const nextAction: Record<string, string> = { pending: "Confirm the kitchen can begin this order.", preparing: "Mark delivered after handoff is complete.", delivered: "No fulfilment action required.", delievered: "No fulfilment action required.", cancelled: "This order is closed and cannot progress." };

export const AdminOrderDetailsPage = () => {
  const { id } = useParams();
  const orderId = Number(id);
  const { data: order, isLoading, isError } = useGetOrder(orderId);
  const updateOrder = useOrderUpdateStatus();
  const [newStatus, setNewStatus] = useState<OT>("pending");
  useEffect(() => { if (order) setNewStatus(order.status); }, [order?.status]);

  if (isLoading) return <div className="mx-auto max-w-5xl space-y-4"><Skeleton h={90} radius="lg" /><Skeleton h={220} radius="lg" /><Skeleton h={320} radius="lg" /></div>;
  if (isError || !order) return <div className="surface-card p-10 text-center"><p className="font-semibold text-danger">Order details could not be loaded.</p><Button component={Link} to="/admin/orders" variant="default" mt="md">Back to orders</Button></div>;

  const isClosed = ["delivered", "delievered", "cancelled"].includes(order.status);
  const orderDate = order.orderDate ? dayjs(order.orderDate).format("D MMM YYYY, h:mm A") : "Date unavailable";
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader eyebrow="Order detail" title={`Order #${order.id}`} description={`Placed ${orderDate}`} action={<Button component={Link} to="/admin/orders" variant="default" leftSection={<ArrowLeft size={16} />}>Back to orders</Button>} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card withBorder><Text size="xs" c="dimmed" tt="uppercase" fw={700}>Order status</Text><div className="mt-2"><OrderStatus status={order.status} /></div></Card>
        <Card withBorder><Text size="xs" c="dimmed" tt="uppercase" fw={700}>Payment</Text><Badge mt="sm" color={order.payment?.status === "completed" ? "basil" : "yellow"} variant="light">{order.payment?.status ?? "Unknown"}</Badge></Card>
        <Card withBorder><Text size="xs" c="dimmed" tt="uppercase" fw={700}>Payment type</Text><Text mt="xs" fw={700}>{order.paymentType === "cash" ? "Cash on delivery" : order.paymentType}</Text></Card>
        <Card withBorder><Text size="xs" c="dimmed" tt="uppercase" fw={700}>Order total</Text><Text mt="xs" fw={800} size="xl" className="tabular-nums">{formatPrice(order.totalPrice)}</Text></Card>
      </div>

      <Card withBorder radius="lg" padding="lg">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-end">
          <div className="flex gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><Clock3 size={18} /></div><div><Text fw={700}>Next action</Text><Text size="sm" c="dimmed">{nextAction[order.status]}</Text><Text size="xs" c="dimmed" mt={4}>Last updated {dayjs(order.updatedAt).format("D MMM YYYY, h:mm A")}</Text></div></div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end"><Select className="flex-1" label="Update fulfilment status" data={orderStatus} value={newStatus} disabled={isClosed} onChange={(value) => value && setNewStatus(value as OT)} /><Button color="brand" leftSection={<Save size={16} />} disabled={isClosed || newStatus === order.status} loading={updateOrder.isPending} onClick={() => updateOrder.mutate({ orderId: order.id, status: newStatus }, { onSuccess: (response) => success(response.message) })}>Save status</Button></div>
        </div>
      </Card>

      <OrderItems items={order.items} />
      <div className="grid gap-5 lg:grid-cols-2"><OrderAddress address={order.address} />{order.coupon && <OrderCoupon coupon={order.coupon} />}</div>
    </div>
  );
};

export default AdminOrderDetailsPage;
