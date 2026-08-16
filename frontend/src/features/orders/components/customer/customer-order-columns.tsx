import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@mantine/core";
import { Link } from "react-router";
import { Order } from "../../model/order.types";
import { formatPrice } from "@/shared/lib";
import { OrderStatus } from "@/components/common";

export const customerOrderColumns: ColumnDef<Order>[] = [
  {
    header: "Order ID",
    accessorKey: "id",
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
        <Link to={`/order/${row.original.id}`}>
          <Button>View Details</Button>
        </Link>
      );
    },
  },
];
