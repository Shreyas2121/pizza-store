import { ColumnDef } from "@tanstack/react-table";
import { Order } from "../../lib/types";
import { formatPrice } from "../../lib/utils";
import { Button } from "@mantine/core";
import { Link } from "react-router";
import OrderStatus from "../order-status";

export const columns: ColumnDef<Order>[] = [
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
    cell: ({ row }) => <><OrderStatus status={row.original.status}/></>,
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
