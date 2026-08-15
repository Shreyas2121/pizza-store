import OrderStatus from "@/components/common/order-status";
import { OrdersAdmin } from "@/lib/types";
import { formatPrice } from "@/lib/utils";
import { Button } from "@mantine/core";
import { ColumnDef } from "@tanstack/react-table";
import { Link } from "react-router";

export const orderColumnsAdmin: ColumnDef<OrdersAdmin>[] = [
  {
    header: "Order ID",
    accessorKey: "id",
  },
  {
    header: "Username",
    accessorKey: "user.id",
    cell: ({ row }) => {
      const fname = row.original.user.fname;
      const lname = row.original.user.lname;
      return `${fname} ${lname}`;
    },
  },
  {
    header: "Order Date",
    accessorKey: "orderDate",
    cell: ({ row }) => {
      const date = row.original.orderDate!;
      return new Date(date).toDateString();
    },
  },
  {
    header: "Total Amount",
    accessorKey: "totalAmount",
    cell: ({ row }) => `${formatPrice(row.original.totalPrice)}`,
  },
  {
    header: "Status",
    accessorKey: "status",
    cell: ({ row }) => <OrderStatus status={row.original.status} />,
  },
  {
    header: "Actions",
    accessorKey: "id",
    cell: ({ row }) => {
      return (
        <Link to={`/admin/order/${row.original.id}`}>
          <Button>View Details</Button>
        </Link>
      );
    },
  },
];
