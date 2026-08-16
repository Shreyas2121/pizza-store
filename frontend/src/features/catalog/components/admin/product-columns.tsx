import type { DataTableColumnDef } from "@/shared/ui";
import { Badge } from "@mantine/core";
import { ProductWithCategory } from "../../model/catalog.types";
import { BASE_URL } from "@/shared/config";
import { cap, formatPrice } from "@/shared/lib";

export const ProductsCol: DataTableColumnDef<ProductWithCategory>[] = [
  {
    header: "Product",
    accessorKey: "name",
    cell: ({ row }) => (
      <div className="flex min-w-60 items-center gap-3">
        <img src={`${BASE_URL}${row.original.image}`} alt="" className="h-11 w-11 rounded-lg border border-border object-cover" />
        <div><p className="font-semibold text-ink">{row.original.name}</p><p className="text-xs text-ink-muted">#{row.original.id}</p></div>
      </div>
    ),
  },
  {
    header: "Category",
    accessorKey: "category.name",
    cell: (info) => <span className="text-ink-muted">{cap(info.getValue() as string)}</span>,
  },
  {
    header: "Diet",
    accessorKey: "veg",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-2 text-sm">
        <span className={`grid h-4 w-4 place-items-center border ${row.original.veg ? "border-basil" : "border-danger"}`} aria-hidden="true"><span className={`h-2 w-2 rounded-full ${row.original.veg ? "bg-basil" : "bg-danger"}`} /></span>
        {row.original.veg ? "Veg" : "Non-veg"}
      </span>
    ),
  },
  {
    header: "Price",
    accessorKey: "price",
    cell: ({ row }) => <span className="font-semibold tabular-nums">{formatPrice(row.original.price)}</span>,
  },
  {
    header: "Availability",
    accessorKey: "isAvailable",
    cell: ({ row }) => <Badge color={row.original.isAvailable ? "basil" : "gray"} variant="light">{row.original.isAvailable ? "Available" : "Unavailable"}</Badge>,
  },
  {
    header: "Options",
    accessorKey: "hasCustomization",
    cell: ({ row }) => <Badge color={row.original.hasCustomization ? "brand" : "gray"} variant="outline">{row.original.hasCustomization ? "Customizable" : "Standard"}</Badge>,
  },
];
