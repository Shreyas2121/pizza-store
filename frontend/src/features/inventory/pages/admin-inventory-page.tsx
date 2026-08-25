import { Button, Select, TextInput } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { RotateCcw, Search, Warehouse } from "lucide-react";
import { useState } from "react";
import { useAdminStores } from "@/features/store";
import { PageHeader, TableSkeleton } from "@/shared/ui";
import { useInventoryList } from "../api/inventory.queries";
import { InventoryActionModal } from "../components/inventory-action-modal";
import { InventoryTable } from "../components/inventory-table";
import type {
  InventoryAction,
  InventoryItem,
  InventoryMutationTarget,
  InventoryStatusFilter,
} from "../model/inventory.types";

const statusOptions = [
  { value: "all", label: "All stock statuses" },
  { value: "low_stock", label: "Low stock" },
  { value: "out_of_stock", label: "Out of stock" },
];

const pageSizeOptions = ["10", "20", "50"];

export function AdminInventoryPage() {
  const stores = useAdminStores();
  const [storeId, setStoreId] = useState<number | null>(null);
  const [status, setStatus] = useState<InventoryStatusFilter>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search.trim(), 300);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [action, setAction] = useState<InventoryAction | null>(null);
  const [target, setTarget] = useState<InventoryMutationTarget | null>(null);

  const inventory = useInventoryList({
    storeId,
    status,
    search: debouncedSearch,
    page,
    limit,
  });

  const storeOptions =
    stores.data?.map((store) => ({
      value: String(store.id),
      label: `${store.name}${store.isActive ? "" : " (inactive)"}`,
    })) ?? [];

  const openAction = (item: InventoryItem, nextAction: InventoryAction) => {
    setTarget({
      productId: item.productId,
      productName: item.productName,
      onHandQuantity: item.onHandQuantity,
      reservedQuantity: item.reservedQuantity,
      lowStockThreshold: item.lowStockThreshold,
    });
    setAction(nextAction);
  };

  const closeAction = () => {
    setAction(null);
    setTarget(null);
  };

  const clearFilters = () => {
    setStatus("all");
    setSearch("");
    setPage(1);
  };

  const filtersChanged = status !== "all" || search.length > 0;

  return (
    <section>
      <PageHeader
        eyebrow="Operations"
        title="Inventory"
        description="Monitor store-level stock, account for active reservations, and record controlled quantity changes."
      />

      <div className="mb-4 grid gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm md:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_180px_110px_auto] md:items-end">
        <Select
          label="Store"
          placeholder={stores.isLoading ? "Loading stores…" : "Select a store"}
          data={storeOptions}
          value={storeId ? String(storeId) : null}
          onChange={(value) => {
            setStoreId(value ? Number(value) : null);
            setPage(1);
            closeAction();
          }}
          searchable
          clearable
          disabled={stores.isLoading || stores.isError || !storeOptions.length}
          error={stores.isError ? "Stores could not be loaded" : undefined}
        />
        <TextInput
          label="Search products"
          placeholder="Product name"
          leftSection={<Search size={16} />}
          value={search}
          onChange={(event) => {
            setSearch(event.currentTarget.value);
            setPage(1);
          }}
          disabled={storeId === null}
        />
        <Select
          label="Status"
          data={statusOptions}
          value={status}
          onChange={(value) => {
            setStatus((value as InventoryStatusFilter | null) ?? "all");
            setPage(1);
          }}
          allowDeselect={false}
          disabled={storeId === null}
        />
        <Select
          label="Rows"
          data={pageSizeOptions}
          value={String(limit)}
          onChange={(value) => {
            setLimit(Number(value ?? 20));
            setPage(1);
          }}
          allowDeselect={false}
          disabled={storeId === null}
        />
        <Button
          variant="default"
          px="sm"
          leftSection={<RotateCcw size={16} />}
          onClick={clearFilters}
          disabled={storeId === null || !filtersChanged}
        >
          Reset
        </Button>
      </div>

      {stores.isLoading ? (
        <TableSkeleton />
      ) : stores.isError ? (
        <div className="empty-state m-0">
          <Warehouse size={34} className="text-brand" />
          <h2 className="mt-3 text-section-title-scale">Stores unavailable</h2>
          <p className="mt-2 text-supporting-scale">Refresh the page to try again.</p>
        </div>
      ) : !stores.data?.length ? (
        <div className="empty-state m-0">
          <Warehouse size={34} className="text-brand" />
          <h2 className="mt-3 text-section-title-scale">No stores available</h2>
          <p className="mt-2 text-supporting-scale">
            Create a store before managing inventory.
          </p>
        </div>
      ) : storeId === null ? (
        <div className="empty-state m-0">
          <Warehouse size={34} className="text-brand" />
          <h2 className="mt-3 text-section-title-scale">Select a store</h2>
          <p className="mt-2 text-supporting-scale">
            Inventory quantities are maintained independently for every store.
          </p>
        </div>
      ) : inventory.isLoading ? (
        <TableSkeleton />
      ) : inventory.isError ? (
        <div className="empty-state m-0">
          <Warehouse size={34} className="text-brand" />
          <h2 className="mt-3 text-section-title-scale">Inventory unavailable</h2>
          <p className="mt-2 text-supporting-scale">
            Check the selected store and refresh the page.
          </p>
        </div>
      ) : !inventory.data?.data.length ? (
        <div className="empty-state m-0">
          <Warehouse size={34} className="text-brand" />
          <h2 className="mt-3 text-section-title-scale">No inventory products found</h2>
          <p className="mt-2 text-supporting-scale">
            {filtersChanged
              ? "Try changing the search or stock-status filters."
              : "Map products to this store to manage their stock."}
          </p>
          {filtersChanged && (
            <Button mt="lg" variant="default" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <InventoryTable
          items={inventory.data.data}
          meta={inventory.data.meta}
          isRefreshing={inventory.isFetching && !inventory.isLoading}
          onPageChange={setPage}
          onAction={openAction}
        />
      )}

      <InventoryActionModal
        action={action}
        target={target}
        storeId={storeId}
        onClose={closeAction}
      />
    </section>
  );
}

export default AdminInventoryPage;
