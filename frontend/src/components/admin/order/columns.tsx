import OrderStatus from "@/components/common/order-status";
import { formatPrice, OrdersAdmin } from "@/lib";
import { ActionIcon, Tooltip } from "@mantine/core";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router";

export const orderColumnsAdmin: ColumnDef<OrdersAdmin>[] = [
  { header: "Order", accessorKey: "id", cell: ({ row }) => <span className="font-semibold tabular-nums">#{row.original.id}</span> },
  { id: "userFullName", header: "Customer", accessorFn: (row) => `${row.user.fname} ${row.user.lname}`, cell: ({ row }) => <div><p className="font-medium">{row.original.user.fname} {row.original.user.lname}</p><p className="text-xs text-ink-muted">{row.original.user.email}</p></div> },
  { header: "Placed", accessorKey: "orderDate", cell: ({ row }) => <span className="whitespace-nowrap text-ink-muted">{row.original.orderDate ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(row.original.orderDate)) : "—"}</span> },
  { header: "Total", accessorKey: "totalPrice", cell: ({ row }) => <span className="font-semibold tabular-nums">{formatPrice(row.original.totalPrice)}</span> },
  { header: "Status", accessorKey: "status", cell: ({ row }) => <OrderStatus status={row.original.status} /> },
  { id: "actions", header: "", enableSorting: false, cell: ({ row }) => <Tooltip label="View order"><ActionIcon component={Link} to={`/admin/order/${row.original.id}`} variant="subtle" color="brand" size={40} aria-label={`View order ${row.original.id}`}><ArrowRight size={17} /></ActionIcon></Tooltip> },
];
