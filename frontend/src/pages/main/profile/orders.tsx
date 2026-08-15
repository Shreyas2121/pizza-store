
import { columns } from "@/components/main";
import { DataTable } from "@/components/table";
import { ORDER_API_HOOKS } from "@/hooks";
import { Loader } from "@mantine/core";

const Orders = () => {
  const { data, isLoading } = ORDER_API_HOOKS.useGetOrders("pending");

  return (
    <div>
      {isLoading ? <Loader /> : <DataTable columns={columns} data={data!} />}
    </div>
  );
};

export default Orders;
