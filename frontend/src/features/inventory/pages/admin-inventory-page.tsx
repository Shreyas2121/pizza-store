import { Button, Select, TextInput } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { PackagePlus, RotateCcw, Search, Warehouse } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { useAdminStores } from "@/features/store";
import { PageHeader, TableSkeleton } from "@/shared/ui";
import { useInventoryList } from "../api/inventory.queries";
import { InventoryActionModal } from "../components/inventory-action-modal";
import { BulkRestockModal } from "../components/bulk-restock-modal";
import { InventoryTable } from "../components/inventory-table";
import { MovementHistoryDrawer } from "../components/movement-history-drawer";
import type {
  InventoryAction,
  InventoryItem,
  InventoryMutationTarget,
  InventoryStatusFilter,
} from "../model/inventory.types";

import { useStaffActiveStore } from "@/features/access";

const statusOptions = [
  { value: "all", label: "All stock statuses" },
  { value: "low_stock", label: "Low stock" },
  { value: "out_of_stock", label: "Out of stock" },
];

const pageSizeOptions = ["10", "20", "50"];

export function AdminInventoryPage() {
  const stores = useAdminStores();
  const { activeStoreId } = useStaffActiveStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStatusParam = searchParams.get("status");
  const initialStatus: InventoryStatusFilter =
    initialStatusParam === "low_stock" || initialStatusParam === "out_of_stock"
      ? initialStatusParam
      : "all";

  const [storeId, setStoreId] = useState<number | null>(activeStoreId);
  const [status, setStatus] = useState<InventoryStatusFilter>(initialStatus);

  useEffect(() => {
    if (activeStoreId) {
      setStoreId(activeStoreId);
    }
  }, [activeStoreId]);

  useEffect(() => {
    const param = searchParams.get("status");
    if (param === "low_stock" || param === "out_of_stock" || param === "all") {
      setStatus(param as InventoryStatusFilter);
    }
  }, [searchParams]);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search.trim(), 300);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [action, setAction] = useState<InventoryAction | null>(null);
  const [target, setTarget] = useState<InventoryMutationTarget | null>(null);
  const [selectedItems, setSelectedItems] = useState(
    () => new Map<number, InventoryItem>()
  );
  const [bulkOpened, setBulkOpened] = useState(false);
  const [historyTarget, setHistoryTarget] =
    useState<InventoryMutationTarget | null>(null);

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

  const asMutationTarget = (item: InventoryItem): InventoryMutationTarget => ({
    productId: item.productId,
    productName: item.productName,
    onHandQuantity: item.onHandQuantity,
    reservedQuantity: item.reservedQuantity,
    lowStockThreshold: item.lowStockThreshold,
  });

  const toggleSelection = (item: InventoryItem, selected: boolean) => {
    setSelectedItems((current) => {
      const next = new Map(current);
      if (selected && item.onHandQuantity !== null && next.size < 50) {
        next.set(item.productId, item);
      } else if (!selected) {
        next.delete(item.productId);
      }
      return next;
    });
  };

  const togglePage = (items: InventoryItem[], selected: boolean) => {
    setSelectedItems((current) => {
      const next = new Map(current);
      for (const item of items) {
        if (selected) {
          if (next.size >= 50) break;
          next.set(item.productId, item);
        } else {
          next.delete(item.productId);
        }
      }
      return next;
    });
  };

  const clearFilters = () => {
    setStatus("all");
    setSearch("");
    setPage(1);
    setSearchParams({});
  };

  const filtersChanged = status !== "all" || search.length > 0;

  return (
    <section>
      <PageHeader
        eyebrow="Operations"
        title="Inventory"
        description="Monitor store-level stock, account for active reservations, and record controlled quantity changes."
        action={
          <Button
            leftSection={<PackagePlus size={16} />}
            disabled={selectedItems.size === 0}
            onClick={() => setBulkOpened(true)}
          >
            Bulk restock{selectedItems.size ? ` (${selectedItems.size})` : ""}
          </Button>
        }
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
            setSelectedItems(new Map());
            setBulkOpened(false);
            setHistoryTarget(null);
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
          onHistory={(item) => setHistoryTarget(asMutationTarget(item))}
          selectedProductIds={new Set(selectedItems.keys())}
          onToggleSelection={toggleSelection}
          onTogglePage={togglePage}
        />
      )}

      <InventoryActionModal
        action={action}
        target={target}
        storeId={storeId}
        onClose={closeAction}
      />
      {bulkOpened && storeId !== null && (
        <BulkRestockModal
          storeId={storeId}
          selectedItems={[...selectedItems.values()]}
          onClose={() => setBulkOpened(false)}
          onSaved={() => {
            setBulkOpened(false);
            setSelectedItems(new Map());
          }}
        />
      )}
      {historyTarget && storeId !== null && (
        <MovementHistoryDrawer
          key={`${storeId}-${historyTarget.productId}`}
          storeId={storeId}
          target={historyTarget}
          onClose={() => setHistoryTarget(null)}
        />
      )}
    </section>
  );
}

export default AdminInventoryPage;
