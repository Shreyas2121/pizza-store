import type { DataTableColumnDef } from "@/shared/ui";
import { Button } from "@mantine/core";
import { Link } from "react-router";
import { Order } from "../../model/order.types";
import { formatDate, formatPaise } from "@/shared/lib";
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
    cell: ({ row }) => formatPaise(row.original.grandTotalPaise),
  },
  {
    header: "Checkout savings",
    accessorKey: "totalDisplayedSavingsPaise",
    cell: ({ row }) => <span>{formatPaise(row.original.totalDisplayedSavingsPaise)}<span className="block text-xs text-ink-muted">{row.original.discountMode === "coupon" ? "Manual coupon" : row.original.discountMode === "automatic_deals" ? "Automatic deals" : "No promotion"}</span></span>,
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
