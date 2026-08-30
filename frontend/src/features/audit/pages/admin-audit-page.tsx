import { Alert, Badge, Button, Group, Pagination, Paper, Select, Table, Text, TextInput } from "@mantine/core";
import { FilterX, ScrollText } from "lucide-react";
import { useEffect, useState } from "react";
import { isPlatformAdmin, useAccessMe, useStaffActiveStore } from "@/features/access";
import { useAdminStores } from "@/features/store";
import { formatDateTime } from "@/shared/lib";
import { PageHeader, TableSkeleton } from "@/shared/ui";
import { useAuditList } from "../api/audit.queries";

const actionLabels: Record<string, string> = {
  "staff.membership.assigned": "Staff assigned",
  "staff.membership.updated": "Staff membership updated",
  "staff.membership.revoked": "Staff access revoked",
  "staff.invitation.created": "Invitation created",
  "staff.invitation.revoked": "Invitation revoked",
  "staff.invitation.accepted": "Invitation accepted",
  "store.profile.updated": "Store profile updated",
  "store.products.mapped": "Store products mapped",
  "store.product.updated": "Store product updated",
  "store.product.removed": "Store product removed",
  "order.status.updated": "Order status updated",
  "inventory.restocked": "Inventory restocked",
  "inventory.bulk_restocked": "Bulk inventory restock",
  "inventory.adjusted": "Inventory adjusted",
  "inventory.threshold_updated": "Stock threshold updated",
  "system.clear_all": "Application data cleared",
};

const actionOptions = Object.entries(actionLabels).map(([value, label]) => ({ value, label }));

const safeMetadata = (metadata: Record<string, unknown>) => {
  const text = JSON.stringify(metadata, null, 2);
  return text === "{}" ? "—" : text;
};

export function AdminAuditPage() {
  const { data: access } = useAccessMe();
  const { activeStoreId } = useStaffActiveStore();
  const global = isPlatformAdmin(access);
  const stores = useAdminStores();
  const [storeId, setStoreId] = useState<number | null>(activeStoreId);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<string | undefined>();
  const [actor, setActor] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    if (!global) setStoreId(activeStoreId);
  }, [activeStoreId, global]);

  const actorUserId = /^\d+$/.test(actor) && Number(actor) > 0 ? Number(actor) : undefined;
  const audit = useAuditList(global, global ? storeId : activeStoreId, {
    page,
    action,
    actorUserId,
    from: from || undefined,
    to: to || undefined,
  });
  const hasFilters = !!action || !!actor || !!from || !!to || (global && !!storeId);
  const reset = () => {
    setAction(undefined);
    setActor("");
    setFrom("");
    setTo("");
    if (global) setStoreId(null);
    setPage(1);
  };

  if (!global && !activeStoreId) {
    return <section><PageHeader eyebrow="Security" title="Audit history" description="Select an active store to review its activity." /><Paper withBorder radius="lg" p="xl"><Text c="dimmed">Choose a store from the workspace switcher.</Text></Paper></section>;
  }

  return (
    <section>
      <PageHeader eyebrow="Security" title={global ? "Global audit history" : "Store audit history"} description="Review attributable changes using allow-listed filters and safe event metadata." />
      <div className="mb-4 grid gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm md:grid-cols-5 md:items-end">
        {global && <Select label="Store" placeholder="All stores" clearable searchable data={(stores.data ?? []).map((store) => ({ value: String(store.id), label: store.name }))} value={storeId ? String(storeId) : null} onChange={(value) => { setStoreId(value ? Number(value) : null); setPage(1); }} />}
        <Select label="Action" placeholder="All actions" clearable searchable data={actionOptions} value={action ?? null} onChange={(value) => { setAction(value ?? undefined); setPage(1); }} />
        <TextInput label="Actor user ID" inputMode="numeric" value={actor} onChange={(event) => { setActor(event.currentTarget.value.replace(/\D/g, "")); setPage(1); }} />
        <TextInput label="From" type="date" value={from} onChange={(event) => { setFrom(event.currentTarget.value); setPage(1); }} />
        <TextInput label="To" type="date" value={to} onChange={(event) => { setTo(event.currentTarget.value); setPage(1); }} />
        <Button variant="default" leftSection={<FilterX size={16} />} disabled={!hasFilters} onClick={reset}>Reset</Button>
      </div>

      {audit.isLoading ? <TableSkeleton /> : audit.isError ? <Alert color="red">Audit history could not be loaded.</Alert> : (
        <Paper withBorder radius="lg" className="overflow-hidden">
          <Table.ScrollContainer minWidth={980}><Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover>
            <Table.Thead><Table.Tr><Table.Th>Time</Table.Th><Table.Th>Action</Table.Th><Table.Th>Actor</Table.Th>{global && <Table.Th>Store</Table.Th>}<Table.Th>Resource</Table.Th><Table.Th>Metadata</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>{audit.data?.data.map((entry) => <Table.Tr key={entry.id}>
              <Table.Td><Text size="sm" className="whitespace-nowrap">{formatDateTime(entry.createdAt)}</Text></Table.Td>
              <Table.Td><Text fw={600} size="sm">{actionLabels[entry.action] ?? entry.action.replace(/\./g, " ")}</Text><Badge size="xs" variant="light" color={entry.outcome === "success" ? "green" : "red"}>{entry.outcome}</Badge></Table.Td>
              <Table.Td><Text size="sm">{entry.actorEmailSnapshot ?? "System"}</Text>{entry.actorUserId && <Text size="xs" c="dimmed">User #{entry.actorUserId}</Text>}</Table.Td>
              {global && <Table.Td>{entry.storeId ? `#${entry.storeId}` : "Global"}</Table.Td>}
              <Table.Td><Text size="sm">{entry.resourceType}</Text><Text size="xs" c="dimmed">#{entry.resourceId ?? "—"}</Text></Table.Td>
              <Table.Td><Text component="pre" size="xs" maw={360} className="max-h-32 overflow-auto whitespace-pre-wrap break-words rounded bg-surface-muted p-2 font-mono">{safeMetadata(entry.metadata)}</Text></Table.Td>
            </Table.Tr>)}{!audit.data?.data.length && <Table.Tr><Table.Td colSpan={global ? 6 : 5}><div className="py-10 text-center"><ScrollText className="mx-auto text-ink-muted" /><Text c="dimmed" mt="sm">No audit events match these filters.</Text></div></Table.Td></Table.Tr>}</Table.Tbody>
          </Table></Table.ScrollContainer>
          {(audit.data?.meta.totalPages ?? 0) > 1 && <Group justify="center" p="md"><Pagination value={page} total={audit.data?.meta.totalPages ?? 1} onChange={setPage} /></Group>}
        </Paper>
      )}
    </section>
  );
}

export default AdminAuditPage;
