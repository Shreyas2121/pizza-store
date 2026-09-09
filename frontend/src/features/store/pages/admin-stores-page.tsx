import { useState } from "react";
import { Badge, Button, Drawer } from "@mantine/core";
import { modals } from "@mantine/modals";
import { Boxes, Clock3, MapPinned, Pencil, Plus, Power, Store as StoreIcon } from "lucide-react";
import { Link } from "react-router";
import { hasStorePermission, isPlatformAdmin, useAccessMe } from "@/features/access";
import { PageHeader, TableSkeleton } from "@/shared/ui";
import { error, formatStoreHours, success } from "@/shared/lib";
import { StoreForm } from "../components/admin/store-form";
import { useAdminStores, useDeactivateStore, useUpdateStore } from "../api/store.queries";
import type { Store } from "../model/store.types";

export function AdminStoresPage() {
  const { data: stores, isLoading, isError } = useAdminStores();
  const updateStore = useUpdateStore();
  const deactivateStore = useDeactivateStore();
  const { data: access } = useAccessMe();
  const platformAdmin = isPlatformAdmin(access);
  const [drawerOpened, setDrawerOpened] = useState(false);
  const [editing, setEditing] = useState<Store | null>(null);

  const openForm = (store?: Store) => {
    setEditing(store ?? null);
    setDrawerOpened(true);
  };
  const closeForm = () => {
    setDrawerOpened(false);
    setEditing(null);
  };

  const toggleActive = (store: Store) => {
    if (store.isActive) {
      modals.openConfirmModal({
        title: `Deactivate ${store.name}?`,
        children: <p className="text-sm text-ink-muted">Customers will no longer be assigned to this store. Its products and delivery zones will be preserved.</p>,
        labels: { confirm: "Deactivate store", cancel: "Cancel" },
        confirmProps: { color: "red" },
        centered: true,
        onConfirm: () => deactivateStore.mutate(store.id, {
          onSuccess: () => success("Store deactivated successfully."),
          onError: () => error("Store could not be deactivated."),
        }),
      });
      return;
    }

    updateStore.mutate({ id: store.id, data: { isActive: true } }, {
      onSuccess: () => success("Store activated successfully."),
      onError: () => error("Store could not be activated."),
    });
  };

  return (
    <section>
      <PageHeader eyebrow="Operations" title="Stores" description="Manage store details, operating hours, catalogue pricing, and delivery coverage." action={platformAdmin ? <Button leftSection={<Plus size={17} />} onClick={() => openForm()}>Create store</Button> : undefined} />

      {isLoading ? <TableSkeleton /> : isError ? (
        <div className="empty-state m-0"><StoreIcon size={34} className="text-brand" /><h2 className="mt-3 text-section-title-scale">Stores unavailable</h2><p className="mt-2 text-supporting-scale">Refresh the page to try again.</p></div>
      ) : !stores?.length ? (
        <div className="empty-state m-0"><StoreIcon size={34} className="text-brand" /><h2 className="mt-3 text-section-title-scale">No stores available</h2>{platformAdmin && <Button mt="lg" leftSection={<Plus size={17} />} onClick={() => openForm()}>Create your first store</Button>}</div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {stores.map((store) => {
            const canUpdateProfile = hasStorePermission(access, store.id, "store.profile.update");
            const canReadProducts = hasStorePermission(access, store.id, "store.products.read");
            const canReadDeliveryZones = hasStorePermission(access, store.id, "store.delivery_zones.read");
            return <article key={store.id} className="rounded-card border border-border bg-surface p-5 shadow-subtle">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0"><h2 className="truncate text-lg font-bold text-ink">{store.name}</h2><p className="mt-1 text-sm text-ink-muted">{store.city}, {store.state} · {store.pincode}</p></div>
                <Badge color={store.isActive ? "basil" : "gray"} variant="light">{store.isActive ? "Active" : "Inactive"}</Badge>
              </div>
              <p className="mt-4 text-sm leading-6 text-ink-muted">{store.address}</p>
              <div className="mt-3 flex items-center gap-2 text-sm text-ink-muted"><Clock3 size={16} /><span>{formatStoreHours(store.opensAt, store.closesAt)} IST</span></div>
              <div className="mt-5 grid grid-cols-2 gap-2 border-t border-border pt-4 sm:flex sm:flex-wrap">
                {canReadProducts && <Button component={Link} to={`/admin/stores/${store.id}/products`} variant="light" size="sm" leftSection={<Boxes size={15} />}>Products</Button>}
                {canReadDeliveryZones && <Button component={Link} to={`/admin/stores/${store.id}/delivery-zones`} variant="light" size="sm" leftSection={<MapPinned size={15} />}>Delivery zones</Button>}
                {canUpdateProfile && <Button variant="default" size="sm" leftSection={<Pencil size={15} />} onClick={() => openForm(store)}>Edit</Button>}
                {platformAdmin && <Button variant="subtle" color={store.isActive ? "red" : "basil"} size="sm" leftSection={<Power size={15} />} loading={(deactivateStore.isPending && deactivateStore.variables === store.id) || (updateStore.isPending && updateStore.variables?.id === store.id)} onClick={() => toggleActive(store)}>{store.isActive ? "Deactivate" : "Activate"}</Button>}
              </div>
            </article>
          })}
        </div>
      )}

      <Drawer opened={drawerOpened} onClose={closeForm} position="right" size="100%" padding="lg" title={editing ? "Edit store" : "Create store"} overlayProps={{ backgroundOpacity: 0.4, blur: 2 }} classNames={{ content: "md:max-w-[680px]" }}>
        <StoreForm key={editing?.id ?? "new"} store={editing} platformAdmin={platformAdmin} onSaved={closeForm} />
      </Drawer>
    </section>
  );
}

export default AdminStoresPage;
