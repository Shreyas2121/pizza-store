import { useState } from "react";
import { Alert, Button, Card, Checkbox, Group, Loader, Select, Stack, Table, Text, TextInput } from "@mantine/core";
import { RefreshCw } from "lucide-react";
import { error, formatDateTime, formatPaise, success } from "@/shared/lib";
import { EmptyState } from "@/shared/ui";
import { useImportSettlement, useReconcileSettlement, useSettlement, useSettlements } from "../api/finance.queries";
import type { SettlementBatch } from "../model/finance.types";
import { apiMessage } from "../model/finance.helpers";
import { StatusBadge } from "./status-badge";

const SettlementImport = ({ storeId, canManage }: { storeId: number; canManage: boolean }) => {
  const [source, setSource] = useState<"fixture" | "test_provider">("fixture");
  const [providerId, setProviderId] = useState("set_m1_s1_001");
  const [confirmed, setConfirmed] = useState(false);
  const importSettlement = useImportSettlement();
  if (!canManage) return null;
  return <Card withBorder><Stack gap="sm"><Text fw={700}>Import or sync provider settlement</Text><Text size="sm" c="dimmed">Imports preserve provider values as source truth. Reconciliation is a separate reviewed action.</Text>
    <Group grow align="end"><Select label="Safe source" value={source} onChange={(value) => { setSource(value as "fixture" | "test_provider"); setConfirmed(false); }} data={[{ value: "fixture", label: "Checked-in fixture" }, { value: "test_provider", label: "Test provider sync" }]} /><TextInput label="Provider settlement ID" value={providerId} onChange={(event) => { setProviderId(event.currentTarget.value); setConfirmed(false); }} /></Group>
    {source === "fixture" && <Text size="xs" c="dimmed">Available demo IDs: set_m1_s1_001 (store 1), set_m2_s2_001 (store 2).</Text>}
    <Checkbox checked={confirmed} onChange={(event) => setConfirmed(event.currentTarget.checked)} label={`Import ${providerId || "this settlement"} into the selected store workflow. Existing identical imports are safe no-ops.`} />
    <Button loading={importSettlement.isPending} disabled={!providerId.trim() || !confirmed} onClick={async () => { try { const result = await importSettlement.mutateAsync(source === "fixture" ? { source, providerSettlementId: providerId } : { source, providerSettlementId: providerId, storeId }); success(result.imported ? "Settlement imported." : "This identical settlement was already imported."); setConfirmed(false); } catch (cause) { error(apiMessage(cause)); } }}>Import or sync</Button>
  </Stack></Card>;
};

const SettlementDetailCard = ({ batch, canManage }: { batch: SettlementBatch; canManage: boolean }) => {
  const detail = useSettlement(batch.id);
  const reconcile = useReconcileSettlement();
  return <Card withBorder><Group justify="space-between" align="start"><div><Text fw={800}>{batch.providerSettlementId}</Text><Text size="sm" c="dimmed">Settled {formatDateTime(batch.settledAt)} · {batch.utr ?? "No UTR"}</Text></div><StatusBadge value={batch.status} /></Group>
    <div className="mt-4 grid gap-3 sm:grid-cols-5">{[["Gross", batch.grossAmountPaise], ["Fee", batch.feePaise], ["Fee tax", batch.feeTaxPaise], ["Adjustments", batch.adjustmentPaise], ["Net", batch.netAmountPaise]].map(([label, value]) => <div key={String(label)}><Text size="xs" c="dimmed">{label}</Text><Text fw={700} className="tabular-nums">{formatPaise(Number(value))}</Text></div>)}</div>
    {canManage && batch.status === "imported" && <Button mt="md" leftSection={<RefreshCw size={16} />} loading={reconcile.isPending} onClick={async () => { try { const value = await reconcile.mutateAsync(batch.id); success(value?.batch.status === "reconciled" ? "Every provider line matched local source truth." : "Reconciliation completed with issues requiring review."); } catch (cause) { error(apiMessage(cause)); } }}>Run deterministic matching</Button>}
    {detail.isLoading ? <Loader mt="md" size="sm" aria-label="Loading settlement detail" /> : detail.isError ? <Alert mt="md" color="red">Settlement detail could not be loaded.</Alert> : detail.data && <div className="mt-4 overflow-x-auto"><Table withTableBorder><Table.Thead><Table.Tr><Table.Th>Provider line</Table.Th><Table.Th>Type</Table.Th><Table.Th>Amount</Table.Th><Table.Th>Fees + tax</Table.Th><Table.Th>Match</Table.Th><Table.Th>Local source</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{detail.data.lines.map((line) => <Table.Tr key={line.id}><Table.Td>{line.providerLineId}</Table.Td><Table.Td>{line.type}</Table.Td><Table.Td>{formatPaise(line.amountPaise)}</Table.Td><Table.Td>{formatPaise(line.feePaise + line.feeTaxPaise)}</Table.Td><Table.Td><StatusBadge value={line.matchStatus} /></Table.Td><Table.Td>{line.paymentAttemptId ? `Attempt #${line.paymentAttemptId}` : line.refundId ? `Refund #${line.refundId}` : "—"}</Table.Td></Table.Tr>)}</Table.Tbody></Table></div>}
  </Card>;
};

export const SettlementsPanel = ({ storeId, canManage }: { storeId: number; canManage: boolean }) => {
  const settlements = useSettlements(storeId);
  return <Stack><SettlementImport storeId={storeId} canManage={canManage} />
    {settlements.isLoading ? <Loader aria-label="Loading settlements" /> : settlements.isError ? <Alert color="red">Settlements could not be loaded.</Alert> : !settlements.data?.data.length ? <EmptyState title="No settlements imported" description="Use a checked-in fixture or the test provider sync to begin." /> : settlements.data.data.map((batch) => <SettlementDetailCard key={batch.id} batch={batch} canManage={canManage} />)}
  </Stack>;
};
