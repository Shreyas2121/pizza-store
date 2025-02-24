import React from "react";
import { useGetOrders } from "../../hooks/order";
import { DataTable } from "../../components/table/data-table";
import { columns } from "../../components/orders/columns";
import { Loader } from "@mantine/core";

const Orders = () => {
  const { data, isLoading } = useGetOrders("pending");

  return (
    <div>
      {isLoading ? <Loader /> : <DataTable columns={columns} data={data!} />}
    </div>
  );
};

export default Orders;
