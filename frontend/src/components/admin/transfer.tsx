import { CUSTOMIZATION_API_HOOKS, PRODUCTS_HOOKS } from "@/hooks";
import { success } from "@/lib";
import { useAuthModalStore } from "@/shared/model";
import { ActionIcon, Button, Loader, TextInput } from "@mantine/core";
import { ArrowLeft, ArrowRight, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface Product { id: number; name: string; }

const Transfer = ({ groupId }: { groupId: number }) => {
  const { data: groupedProducts, isLoading: loadingGroup } = PRODUCTS_HOOKS.useGetProductsByGroup(groupId);
  const { data: products, isLoading: loadingProducts } = PRODUCTS_HOOKS.useGetProductsA();
  const updateMapping = CUSTOMIZATION_API_HOOKS.useUpdateGroupMapping();
  const closeModal = useAuthModalStore((state) => state.closeModal);
  const [assigned, setAssigned] = useState<Product[]>([]);
  const [initialIds, setInitialIds] = useState<number[]>([]);
  const [availableSearch, setAvailableSearch] = useState("");
  const [assignedSearch, setAssignedSearch] = useState("");

  useEffect(() => {
    if (groupedProducts) {
      setAssigned(groupedProducts);
      setInitialIds(groupedProducts.map((product) => product.id).sort((a, b) => a - b));
    }
  }, [groupedProducts]);

  const available = useMemo(() => (products ?? []).filter((product) => !assigned.some((item) => item.id === product.id) && product.name.toLowerCase().includes(availableSearch.toLowerCase())), [products, assigned, availableSearch]);
  const filteredAssigned = assigned.filter((product) => product.name.toLowerCase().includes(assignedSearch.toLowerCase()));
  const currentIds = assigned.map((product) => product.id).sort((a, b) => a - b);
  const hasChanges = currentIds.join(",") !== initialIds.join(",");

  if (loadingGroup || loadingProducts) return <div className="grid min-h-64 place-items-center"><Loader /></div>;

  const ProductList = ({ items, destination }: { items: Product[]; destination: "assigned" | "available" }) => (
    <div className="h-72 overflow-y-auto rounded-xl border border-border bg-surface">
      {items.length ? items.map((product) => (
        <div key={product.id} className="flex min-h-12 items-center justify-between gap-3 border-b border-border px-3 py-2 last:border-0">
          <span className="truncate text-sm font-medium">{product.name}</span>
          <ActionIcon variant="subtle" color={destination === "assigned" ? "brand" : "gray"} size={36} aria-label={`${destination === "assigned" ? "Assign" : "Remove"} ${product.name}`} onClick={() => destination === "assigned" ? setAssigned((current) => [...current, product]) : setAssigned((current) => current.filter((item) => item.id !== product.id))}>
            {destination === "assigned" ? <ArrowRight size={16} /> : <ArrowLeft size={16} />}
          </ActionIcon>
        </div>
      )) : <p className="p-5 text-center text-sm text-ink-muted">No products in this list.</p>}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-brand-soft p-4 text-sm text-ink"><strong>{assigned.length} products assigned.</strong> Move products between the available and assigned lists, then save the final selection.</div>
      <div className="grid gap-5 md:grid-cols-2">
        <section>
          <div className="mb-2 flex items-center justify-between"><div><p className="font-semibold">Available</p><p className="text-xs text-ink-muted">Source · {available.length} shown</p></div><Button size="xs" variant="subtle" disabled={!available.length} onClick={() => setAssigned(products ?? [])}>Assign all</Button></div>
          <TextInput mb="sm" aria-label="Search available products" placeholder="Search available" leftSection={<Search size={15} />} value={availableSearch} onChange={(event) => setAvailableSearch(event.currentTarget.value)} />
          <ProductList items={available} destination="assigned" />
        </section>
        <section>
          <div className="mb-2 flex items-center justify-between"><div><p className="font-semibold">Assigned</p><p className="text-xs text-ink-muted">Destination · {assigned.length} selected</p></div><Button size="xs" variant="subtle" color="red" disabled={!assigned.length} onClick={() => setAssigned([])}>Remove all</Button></div>
          <TextInput mb="sm" aria-label="Search assigned products" placeholder="Search assigned" leftSection={<Search size={15} />} value={assignedSearch} onChange={(event) => setAssignedSearch(event.currentTarget.value)} />
          <ProductList items={filteredAssigned} destination="available" />
        </section>
      </div>
      <div className="sticky -bottom-4 -mx-4 flex items-center justify-between gap-3 border-t border-border bg-surface/95 p-4 backdrop-blur">
        <span className="text-sm text-ink-muted">{hasChanges ? "Unsaved assignment changes" : "Assignments are up to date"}</span>
        <div className="flex gap-3"><Button variant="default" onClick={closeModal}>Cancel</Button><Button color="brand" disabled={!hasChanges} loading={updateMapping.isPending} onClick={() => updateMapping.mutate({ groupId, productIds: assigned.map((product) => product.id) }, { onSuccess: (response) => { success(response.message || "Assignments updated."); setInitialIds(currentIds); closeModal(); } })}>Save assignments</Button></div>
      </div>
    </div>
  );
};

export default Transfer;
