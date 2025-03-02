import { BASE_URL } from "@/lib/constants";
import { ProductWithCategory } from "@/lib/types";
import { cap } from "@/lib/utils";
import { ColumnDef } from "@tanstack/react-table";
import ProductActions from "./product-actions";

export const ProductsCol: ColumnDef<ProductWithCategory>[] = [
  {
    header: "ID",
    accessorKey: "id",
    cell: (info) => info.getValue(),
    enableSorting: true,
  },
  {
    header: "Image",
    accessorKey: "image",
    cell: (info) => (
      <img
        src={`${BASE_URL}${info.getValue() as string}`}
        alt="product"
        className="w-10 h-10 object-cover rounded"
      />
    ),
    enableSorting: false,
  },
  {
    header: "Name",
    accessorKey: "name",
    cell: (info) => info.getValue(),
    enableSorting: true,
  },
  {
    header: "Price",
    accessorKey: "price",
    cell: (info) => `₹${Number(info.getValue()).toFixed(2)}`,
    enableSorting: true,
  },
  {
    header: "Category",
    accessorKey: "category.name",
    cell: (info) => cap(info.getValue() as string),
    enableSorting: true,
  },
  {
    header: "Veg",
    accessorKey: "veg",
    cell: (info) => (info.getValue() ? "Veg" : "Non-Veg"),
    enableSorting: false,
  },
  {
    header: "Customizable",
    accessorKey: "hasCustomization",
    cell: (info) => (info.getValue() ? "Yes" : "No"),
    enableSorting: false,
  },
  {
    header: "Actions",
    accessorKey: "id",
    cell: ({ row }) => {
      return <ProductActions id={row.original.id} />;
    },
  },
];
