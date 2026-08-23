import type { DataTableColumnDef } from "@/shared/ui";
import { Button } from "@mantine/core";
import { Link } from "react-router";
import { Order } from "../../model/order.types";
import { formatDate, formatPrice } from "@/shared/lib";
import { OrderStatus } from "../order-status";


export const customerOrderColumns: DataTableColumnDef<Order>[] = [
  {
    header: "Order ID",
    accessorKey: "id",
  },
  {
    header: "Order Date",
    accessorKey: "orderDate",
    cell: ({ row }) => {
      return row.original.orderDate ? formatDate(row.original.orderDate) : "Date unavailable";
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
