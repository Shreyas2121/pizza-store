import { Button, Badge, Skeleton } from "@mantine/core";
import { Plus } from "lucide-react";
import { Link } from "react-router";
import { ProductsCol } from "../components/admin/product-columns";
import { useGetProductsA } from "../api/product.queries";
import { BASE_URL } from "@/shared/config";
import { formatPrice } from "@/shared/lib";
import { PageHeader } from "@/components/common";
import { DataTable } from "@/shared/ui";


export const AdminProductsPage = () => {
  const { data, isLoading, isError } = useGetProductsA();

  return (
    <div>
      <PageHeader eyebrow="Catalogue" title="Products" description="Review customer-facing products, dietary marks, availability, and customization coverage." action={<Button component={Link} to="/admin/product/new" color="brand" leftSection={<Plus size={16} />}>Create product</Button>} />
      {isLoading ? <Skeleton h={420} radius="lg" /> : isError ? (
        <div className="surface-card p-8 text-center text-danger">Products could not be loaded.</div>
      ) : (
        <DataTable
          columns={ProductsCol}
          data={data ?? []}
          keyName="name"
          text="products"
          searchLabel="Search products"
          emptyTitle="No matching products"
          renderMobileCard={(product) => (
            <div className="flex gap-3">
              <img src={`${BASE_URL}${product.image}`} alt="" className="h-16 w-16 rounded-xl border border-border object-cover" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3"><p className="font-semibold text-ink">{product.name}</p><p className="shrink-0 font-semibold tabular-nums">{formatPrice(product.price)}</p></div>
                <p className="mt-0.5 text-sm text-ink-muted">{product.category.name} · {product.veg ? "Veg" : "Non-veg"}</p>
                <div className="mt-2 flex flex-wrap gap-2"><Badge size="sm" color={product.isAvailable ? "basil" : "gray"} variant="light">{product.isAvailable ? "Available" : "Unavailable"}</Badge>{product.hasCustomization && <Badge size="sm" color="brand" variant="outline">Customizable</Badge>}</div>
              </div>
            </div>
          )}
        />
      )}
    </div>
  );
};

export default AdminProductsPage;
