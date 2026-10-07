import { ORDER_PAGE_SIZE, ORDER_MAX_PAGE } from "../model/order.constants";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";
import { Button, Select } from "@mantine/core";
import { ArrowRight, RotateCcw } from "lucide-react";
import { adminOrderColumns } from "../components/admin/admin-order-columns";
import { orderKeys, useGetAdminOrders } from "../api/order.queries";
import {
  OrderStatus as OrderStatusType,
  orderStatus,
} from "../model/order.types";
import { formatDate, formatPrice } from "@/shared/lib";
import { PageHeader, TableSkeleton } from "@/shared/ui";
import { OrderStatus as StatusPill } from "../components/order-status";
import { useStaffActiveStore } from "@/features/access";
import {
  RealtimeEvents,
  type OrderStatusChangedPayload,
  useSocketEvent,
} from "@/shared/realtime";
import { DataTable } from "@/shared/ui";

export const AdminOrdersPage = () => {
  const [selectedStatus, setSelectedStatus] = useState<OrderStatusType>("pending");
  const { activeStoreId } = useStaffActiveStore();
  const [pagination, setPagination] = useState({ storeId: activeStoreId, status: selectedStatus, page: 1 });
  const page = pagination.storeId === activeStoreId && pagination.status === selectedStatus ? pagination.page : 1;
  const queryClient = useQueryClient();
  const { data: orders, isLoading, isError, isFetching } = useGetAdminOrders(
    selectedStatus,
    activeStoreId,
    page
  );

  useSocketEvent(
    RealtimeEvents.orderStatusChanged,
    (event: OrderStatusChangedPayload) => {
      if (activeStoreId && event.storeId !== activeStoreId) return;

      void queryClient.invalidateQueries({ queryKey: orderKeys.adminAll(selectedStatus, activeStoreId) });
    }
  );

  const filter = (
    <div className="flex w-full items-end gap-2 sm:w-auto">
      <Select
        label="Status"
        aria-label="Filter orders by status"
        data={orderStatus}
        value={selectedStatus}
        onChange={(value) => setSelectedStatus((value as OrderStatusType) || "pending")}
        className="min-w-44 flex-1"
      />
      <Button
        variant="default"
        px="sm"
        aria-label="Clear order filters"
        disabled={selectedStatus === "pending"}
        onClick={() => setSelectedStatus("pending")}
      >
        <RotateCcw size={16} />
      </Button>
    </div>
  );

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Orders"
        description="Find orders by customer, monitor fulfilment state, and open the next required action."
      />
      {isLoading ? (
        <TableSkeleton />
      ) : isError ? (
        <div className="surface-card p-8 text-center text-danger">Orders could not be loaded.</div>
      ) : (
        <DataTable
          columns={adminOrderColumns}
          data={orders ?? []}
          keyName="userFullName"
          text="customers"
          searchLabel="Search customers"
          isRefreshing={isFetching && !isLoading}
          Component={filter}
          emptyTitle={`No ${selectedStatus.replace(/_/g, " ")} orders`}
          renderMobileCard={(order) => (
            <div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">Order #{order.id}</p>
                  <p className="text-sm text-ink-muted">{order.user.fname} {order.user.lname}</p>
                </div>
                <StatusPill status={order.status} />
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                <div>
                  <p className="font-semibold tabular-nums">{formatPrice(order.totalPrice)}</p>
                  <p className="text-xs text-ink-muted">{order.orderDate ? formatDate(order.orderDate) : "Date unavailable"}</p>
                </div>
                <Button component={Link} to={`/admin/order/${order.id}`} variant="subtle" rightSection={<ArrowRight size={15} />}>View order</Button>
              </div>
            </div>
          )}
        />
      )}
      {!isLoading && !isError && <nav aria-label="Staff order pages" className="mt-5 flex items-center justify-center gap-4"><Button variant="default" disabled={page === 1 || isFetching} onClick={() => setPagination({ storeId: activeStoreId, status: selectedStatus, page: page - 1 })}>Previous</Button><span>Page {page}</span><Button variant="default" disabled={isFetching || (orders?.length ?? 0) < ORDER_PAGE_SIZE || page >= ORDER_MAX_PAGE} onClick={() => setPagination({ storeId: activeStoreId, status: selectedStatus, page: page + 1 })}>Next</Button></nav>}
    </div>
  );
};

export default AdminOrdersPage;
