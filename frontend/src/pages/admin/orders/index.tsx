import { orderColumnsAdmin } from "@/components/admin";
import { DataTable } from "@/components/table";
import { ORDER_API_HOOKS } from "@/hooks";
import { orderStatus, OrderStatus } from "@/lib";
import { Select } from "@mantine/core";
import { useState } from "react";

const OrdersA = () => {
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus>("pending");

  const { data: orders, isLoading } = ORDER_API_HOOKS.useGetAdminOrders(selectedStatus);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Orders</h1>

      <div className="mb-4 max-w-xs">
        <Select
          label="Order Status"
          placeholder="Select status"
          value={selectedStatus}
          onChange={(value) => setSelectedStatus(value as OrderStatus)}
          data={orderStatus}
          variant="filled"
          radius="md"
          size="md"
        />
      </div>

      {/* You might show a loading indicator if desired */}
      {isLoading ? (
        <div>Loading orders...</div>
      ) : (
        <DataTable columns={orderColumnsAdmin} data={orders!} />
      )}
    </div>
  );
};

export default OrdersA;
