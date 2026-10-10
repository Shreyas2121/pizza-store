import { useState } from "react";
import { Alert, Button, Card, Group, Modal, Stack, Text, Textarea } from "@mantine/core";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { error, success } from "@/shared/lib";
import { EmptyState, ListSkeleton } from "@/shared/ui";
import { useReconciliationIssues, useResolveIssue } from "../api/finance.queries";
import type { ReconciliationIssue } from "../model/finance.types";
import { apiMessage, humanizeStatus } from "../model/finance.helpers";
import { StatusBadge } from "./status-badge";

export const IssuesPanel = ({ storeId, canManage }: { storeId: number | null; canManage: boolean }) => {
  const issues = useReconciliationIssues(storeId);
  const resolve = useResolveIssue();
  const [selected, setSelected] = useState<ReconciliationIssue | null>(null);
  const [reason, setReason] = useState("");
  return <Stack>{issues.isLoading ? <ListSkeleton label="Loading reconciliation issues" /> : issues.isError ? <Alert color="red">The issue queue could not be loaded.</Alert> : !issues.data?.data.length ? <EmptyState icon={CheckCircle2} title="No open reconciliation issues" description="Imported provider activity currently needs no manual review." /> : issues.data.data.map((item) => <Card key={item.id} withBorder><Group justify="space-between" align="start"><div><Group gap="xs"><StatusBadge value={item.severity} /><Text fw={700}>{humanizeStatus(item.issueType)}</Text></Group><Text size="sm" mt="xs">Batch #{item.batchId ?? "—"} · Line #{item.settlementLineId ?? "—"} · Owner #{item.ownerUserId ?? "unassigned"}</Text><Text size="xs" c="dimmed" mt={4}>{Object.entries(item.details).map(([key, value]) => `${key}: ${String(value)}`).join(" · ")}</Text></div>{canManage && <Button size="xs" variant="light" onClick={() => setSelected(item)}>Resolve</Button>}</Group></Card>)}
    <Modal opened={Boolean(selected)} onClose={() => { setSelected(null); setReason(""); }} title={`Resolve issue #${selected?.id}`} centered><Stack><Alert color="yellow" icon={<AlertTriangle size={17} />}>Resolution acknowledges the variance; it does not change provider lines, payment attempts, refunds, or amounts.</Alert><Textarea required label="Resolution reason" description="Record the evidence or operational decision used." value={reason} onChange={(event) => setReason(event.currentTarget.value)} minRows={3} maxLength={1000} /><Button disabled={reason.trim().length < 3} loading={resolve.isPending} onClick={async () => { if (!selected) return; try { await resolve.mutateAsync({ issueId: selected.id, reason }); success(`Issue #${selected.id} was resolved with an audit record.`); setSelected(null); setReason(""); } catch (cause) { error(apiMessage(cause)); } }}>Confirm resolution</Button></Stack></Modal>
  </Stack>;
};
