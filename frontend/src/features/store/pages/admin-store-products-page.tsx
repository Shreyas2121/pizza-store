import { useState } from "react";
import { Button, Drawer } from "@mantine/core";
import { ArrowLeft, PackagePlus } from "lucide-react";
import { Link, useParams } from "react-router";
import { hasStorePermission, useAccessMe } from "@/features/access";
import { PageHeader, TableSkeleton } from "@/shared/ui";
import { AddStoreProducts } from "../components/admin/add-store-products";
import { StoreProductRow } from "../components/admin/store-product-row";
import { useStoreDetail, useStoreProductCatalog, useStoreProducts } from "../api/store.queries";

export function AdminStoreProductsPage() {
  const storeId = Number(useParams().id);
  const [drawerOpened, setDrawerOpened] = useState(false);
  const { data: access } = useAccessMe();
  const canMapProducts = hasStorePermission(access, storeId, "store.products.mapping.manage");
  const canUpdatePrice = hasStorePermission(access, storeId, "store.products.price.update");
  const canUpdateAvailability = hasStorePermission(access, storeId, "store.products.availability.update");
  const store = useStoreDetail(storeId);
  const mappings = useStoreProducts(storeId);
  const catalog = useStoreProductCatalog(storeId, canMapProducts);
  const mappedIds = new Set(mappings.data?.map((mapping) => mapping.productId));
  const unmapped = catalog.data?.filter((product) => !mappedIds.has(product.id)) ?? [];
  const isLoading = store.isLoading || mappings.isLoading || (canMapProducts && catalog.isLoading);
  const isError = !Number.isInteger(storeId) || store.isError || mappings.isError || (canMapProducts && catalog.isError);

  return (
    <section>
      <PageHeader eyebrow="Store catalogue" title={store.data?.name ?? "Store products"} description="Set store-specific pricing and control which products customers can order." action={<div className="flex gap-2"><Button component={Link} to="/admin/stores" variant="default" leftSection={<ArrowLeft size={16} />}>Stores</Button>{canMapProducts && <Button leftSection={<PackagePlus size={16} />} disabled={!unmapped.length} onClick={() => setDrawerOpened(true)}>Add products</Button>}</div>} />
      {isLoading ? <TableSkeleton /> : isError ? (
        <div className="empty-state m-0"><h2 className="text-section-title-scale">Store products unavailable</h2><p className="mt-2 text-supporting-scale">Check the store and refresh the page.</p></div>
      ) : !mappings.data?.length ? (
        <div className="empty-state m-0"><PackagePlus size={34} className="text-brand" /><h2 className="mt-3 text-section-title-scale">No products mapped</h2><p className="mt-2 text-supporting-scale">{canMapProducts ? "Add products from the global catalogue to make this store’s menu available." : "No products are currently mapped to this store."}</p>{canMapProducts && <Button mt="lg" leftSection={<PackagePlus size={16} />} onClick={() => setDrawerOpened(true)}>Add products</Button>}</div>
      ) : (
        <div className="overflow-hidden rounded-card border border-border bg-surface shadow-subtle">
          <div className="hidden grid-cols-[minmax(240px,1fr)_150px_150px_auto] gap-4 border-b border-border bg-surface-muted px-4 py-3 text-xs font-bold uppercase tracking-wide text-ink-muted md:grid"><span>Product</span><span>Price</span><span>Status</span><span>Actions</span></div>
          {mappings.data.map((mapping) => <StoreProductRow key={mapping.id} mapping={mapping} canUpdatePrice={canUpdatePrice} canUpdateAvailability={canUpdateAvailability} canRemove={canMapProducts} />)}
        </div>
      )}
      {canMapProducts && <Drawer opened={drawerOpened} onClose={() => setDrawerOpened(false)} position="right" size="100%" padding="lg" title="Add products to store" overlayProps={{ backgroundOpacity: 0.4, blur: 2 }} classNames={{ content: "md:max-w-[680px]", body: "h-[calc(100dvh-68px)]" }}>
        <AddStoreProducts storeId={storeId} products={unmapped} onSaved={() => setDrawerOpened(false)} />
      </Drawer>}
    </section>
  );
}

export default AdminStoreProductsPage;
