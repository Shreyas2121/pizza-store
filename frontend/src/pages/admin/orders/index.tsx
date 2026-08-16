import { orderColumnsAdmin } from "@/components/admin";
import { PageHeader, OrderStatus as StatusPill } from "@/components/common";
import { DataTable } from "@/shared/ui";

import { ORDER_API_HOOKS } from "@/hooks";
import { formatPrice, orderStatus, OrderStatus } from "@/lib";
import { Button, Select, Skeleton } from "@mantine/core";
import { ArrowRight, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

const OrdersA = () => {
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus>("pending");
  const { data: orders, isLoading, isError } = ORDER_API_HOOKS.useGetAdminOrders(selectedStatus);
  const filter = <div className="flex w-full items-end gap-2 sm:w-auto"><Select label="Status" aria-label="Filter orders by status" data={orderStatus} value={selectedStatus} onChange={(value) => setSelectedStatus((value as OrderStatus) || "pending")} className="min-w-44 flex-1" /><Button variant="default" px="sm" aria-label="Clear order filters" disabled={selectedStatus === "pending"} onClick={() => setSelectedStatus("pending")}><RotateCcw size={16} /></Button></div>;

  return (
    <div>
      <PageHeader eyebrow="Operations" title="Orders" description="Find orders by customer, monitor fulfilment state, and open the next required action." />
      {isLoading ? <Skeleton h={420} radius="lg" /> : isError ? <div className="surface-card p-8 text-center text-danger">Orders could not be loaded.</div> : (
        <DataTable columns={orderColumnsAdmin} data={orders ?? []} keyName="userFullName" text="customers" searchLabel="Search customers" Component={filter} emptyTitle={`No ${selectedStatus === "delievered" ? "delivered" : selectedStatus} orders`} renderMobileCard={(order) => (
          <div>
            <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">Order #{order.id}</p><p className="text-sm text-ink-muted">{order.user.fname} {order.user.lname}</p></div><StatusPill status={order.status} /></div>
            <div className="mt-3 flex items-center justify-between border-t border-border pt-3"><div><p className="font-semibold tabular-nums">{formatPrice(order.totalPrice)}</p><p className="text-xs text-ink-muted">{order.orderDate ? new Date(order.orderDate).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "Date unavailable"}</p></div><Button component={Link} to={`/admin/order/${order.id}`} variant="subtle" rightSection={<ArrowRight size={15} />}>View order</Button></div>
          </div>
        )} />
      )}
    </div>
  );
};

export default OrdersA;
