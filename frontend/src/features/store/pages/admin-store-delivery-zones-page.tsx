import { useState } from "react";
import { Badge, Button, Textarea } from "@mantine/core";
import { modals } from "@mantine/modals";
import { ArrowLeft, MapPin, Plus, Trash2 } from "lucide-react";
import { Link, useParams } from "react-router";
import { PageHeader, TableSkeleton } from "@/shared/ui";
import { error, success } from "@/shared/lib";
import { useAddDeliveryZones, useDeliveryZones, useRemoveDeliveryZone, useStoreDetail } from "../api/store.queries";

export function AdminStoreDeliveryZonesPage() {
  const storeId = Number(useParams().id);
  const [input, setInput] = useState("");
  const store = useStoreDetail(storeId);
  const zones = useDeliveryZones(storeId);
  const addZones = useAddDeliveryZones(storeId);
  const removeZone = useRemoveDeliveryZone(storeId);

  const add = () => {
    const pincodes = [...new Set(input.split(/[\s,]+/).map((value) => value.trim()).filter(Boolean))];
    const invalid = pincodes.filter((pincode) => !/^\d{6}$/.test(pincode));
    if (!pincodes.length) return error("Enter at least one pincode.");
    if (invalid.length) return error(`Invalid pincodes: ${invalid.join(", ")}`);
    if (pincodes.length > 100) return error("Add no more than 100 pincodes at a time.");

    addZones.mutate(pincodes, {
      onSuccess: (response) => {
        success(`${response.meta.addedCount} pincode${response.meta.addedCount === 1 ? "" : "s"} added${response.meta.skippedCount ? `; ${response.meta.skippedCount} already existed` : ""}.`);
        setInput("");
      },
      onError: () => error("Delivery zones could not be added."),
    });
  };

  const confirmRemove = (zoneId: number, pincode: string) => modals.openConfirmModal({
    title: `Remove pincode ${pincode}?`,
    children: <p className="text-sm text-ink-muted">This store will stop serving this delivery zone.</p>,
    labels: { confirm: "Remove pincode", cancel: "Cancel" },
    confirmProps: { color: "red" },
    centered: true,
    onConfirm: () => removeZone.mutate(zoneId, {
      onSuccess: () => success("Delivery zone removed."),
      onError: () => error("Delivery zone could not be removed."),
    }),
  });

  const isLoading = store.isLoading || zones.isLoading;
  const isError = !Number.isInteger(storeId) || store.isError || zones.isError;

  return (
    <section>
      <PageHeader eyebrow="Delivery coverage" title={store.data?.name ?? "Delivery zones"} description="Manage the pincodes that can resolve to this store." action={<Button component={Link} to="/admin/stores" variant="default" leftSection={<ArrowLeft size={16} />}>Stores</Button>} />

      <div className="mb-6 rounded-card border border-border bg-surface p-5 shadow-subtle">
        <h2 className="font-bold text-ink">Add delivery pincodes</h2>
        <p className="mt-1 text-sm text-ink-muted">Enter up to 100 six-digit pincodes, separated by commas, spaces, or new lines.</p>
        <Textarea mt="md" minRows={3} placeholder={"560001, 560002\n560003"} value={input} onChange={(event) => setInput(event.currentTarget.value)} disabled={addZones.isPending} />
        <Button mt="md" leftSection={<Plus size={16} />} loading={addZones.isPending} onClick={add}>Add pincodes</Button>
      </div>

      {isLoading ? <TableSkeleton /> : isError ? (
        <div className="empty-state m-0"><h2 className="text-section-title-scale">Delivery zones unavailable</h2><p className="mt-2 text-supporting-scale">Check the store and refresh the page.</p></div>
      ) : !zones.data?.length ? (
        <div className="empty-state m-0"><MapPin size={34} className="text-brand" /><h2 className="mt-3 text-section-title-scale">No delivery zones</h2><p className="mt-2 text-supporting-scale">This store cannot be resolved until at least one pincode is added.</p></div>
      ) : (
        <div className="overflow-hidden rounded-card border border-border bg-surface shadow-subtle">
          <div className="flex items-center justify-between border-b border-border bg-surface-muted px-5 py-3"><p className="text-sm font-semibold text-ink">Served pincodes</p><Badge color="brand" variant="light">{zones.data.length} zones</Badge></div>
          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {zones.data.map((zone) => (
              <div key={zone.id} className="flex min-h-12 items-center justify-between rounded-control border border-border px-4">
                <span className="flex items-center gap-2 font-semibold tabular-nums text-ink"><MapPin size={16} className="text-brand" />{zone.pincode}</span>
                <Button variant="subtle" color="red" size="compact-sm" aria-label={`Remove pincode ${zone.pincode}`} loading={removeZone.isPending && removeZone.variables === zone.id} onClick={() => confirmRemove(zone.id, zone.pincode)}><Trash2 size={15} /></Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default AdminStoreDeliveryZonesPage;
