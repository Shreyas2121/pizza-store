import { useState } from "react";
import { Alert, Button, Checkbox, Group, Loader, Modal, NumberInput, SegmentedControl, Select, Stack, Table, Text, Textarea } from "@mantine/core";
import { RotateCcw } from "lucide-react";
import { error, formatDateTime, formatPaise, success } from "@/shared/lib";
import { EmptyState } from "@/shared/ui";
import { useApproveRefund, useRefunds, useStuckRefunds, useRejectRefund, useRetryRefund } from "../api/finance.queries";
import type { Refund, RefundStatus } from "../model/finance.types";
import { apiMessage, humanizeStatus } from "../model/finance.helpers";
import { StatusBadge } from "./status-badge";
import { RefundRequestModal } from "./refund-request-modal";
import { RefundReconciliation } from "./refund-reconciliation";

export const RefundsPanel = ({ storeId, canApprove }: { storeId: number; canApprove: boolean }) => {
  const [status, setStatus] = useState<RefundStatus | undefined>();
  const [requestOpened, setRequestOpened] = useState(false);
  const [action, setAction] = useState<{ refund: Refund; kind: "approve" | "reject" } | null>(null);
  const [reason, setReason] = useState("");
  const [cashReturned, setCashReturned] = useState(false);
  const [view, setView] = useState("all");
  const [age, setAge] = useState<number | string>(15);
  const [page, setPage] = useState(1);
  const ageValid = typeof age === "number" && Number.isInteger(age) && age >= 1 && age <= 10080;
  const allRefunds = useRefunds(storeId, status, page, view === "all");
  const stuckRefunds = useStuckRefunds(storeId, ageValid ? Number(age) : 15, page, view === "stuck" && ageValid);
  const refunds = view === "stuck" ? stuckRefunds : allRefunds;
  const approve = useApproveRefund();
  const reject = useRejectRefund();
  const retry = useRetryRefund();

  const finish = async () => {
    if (!action) return;
    try {
      if (action.kind === "approve") await approve.mutateAsync({ refundId: action.refund.id, codCashReturned: cashReturned || undefined });
      else await reject.mutateAsync({ refundId: action.refund.id, reason });
      success(`Refund #${action.refund.id} was ${action.kind === "approve" ? "approved" : "rejected"}.`);
      setAction(null); setReason(""); setCashReturned(false);
    } catch (cause) { error(apiMessage(cause)); }
  };

  return <Stack>
    <Group justify="space-between"><Group><SegmentedControl aria-label="Refund queue" value={view} onChange={(value) => { setView(value); setPage(1); }} data={[{ value: "all", label: "All refunds" }, { value: "stuck", label: "Stuck refunds" }]} />{view === "all" ? <Select clearable placeholder="All refund statuses" value={status ?? null} onChange={(value) => { setStatus((value || undefined) as RefundStatus | undefined); setPage(1); }} data={["requested", "approved", "submitted", "processing", "processed", "failed", "rejected", "cancelled"].map((value) => ({ value, label: humanizeStatus(value) }))} /> : <NumberInput label="Stuck for at least (minutes)" min={1} max={10080} allowDecimal={false} value={age} onChange={(value) => { setAge(value); setPage(1); }} error={!ageValid ? "Enter 1–10,080 minutes." : undefined} />}</Group><Button leftSection={<RotateCcw size={16} />} onClick={() => setRequestOpened(true)}>Request refund</Button></Group>
    {view === "stuck" && <Alert color="yellow">This queue shows submitted and processing refunds that have not updated within the selected time. Reconciliation checks their provider outcomes.</Alert>}
    {canApprove && <RefundReconciliation key={storeId} storeId={storeId} />}
    {view === "stuck" && !ageValid ? <Alert color="red">Enter a valid minimum age to load stuck refunds.</Alert> : refunds.isLoading ? <Loader aria-label="Loading refunds" /> : refunds.isError ? <Alert color="red">Refunds could not be loaded.<Button ml="sm" size="xs" variant="subtle" onClick={() => refunds.refetch()}>Retry</Button></Alert> : !refunds.data?.data.length ? <EmptyState title="No refunds in this view" description="New requests and provider outcomes will appear here." /> : <div className="overflow-x-auto"><Table striped highlightOnHover withTableBorder>
      <Table.Thead><Table.Tr><Table.Th>Refund</Table.Th><Table.Th>Order</Table.Th><Table.Th>Amount</Table.Th><Table.Th>Status</Table.Th><Table.Th>Requested</Table.Th><Table.Th>Actions</Table.Th></Table.Tr></Table.Thead>
      <Table.Tbody>{refunds.data.data.map((item) => <Table.Tr key={item.id}><Table.Td>#{item.id}<Text size="xs" c="dimmed">{humanizeStatus(item.reasonCode)}</Text></Table.Td><Table.Td>#{item.orderId}</Table.Td><Table.Td className="tabular-nums">{formatPaise(item.amountPaise)}</Table.Td><Table.Td><StatusBadge value={item.status} />{item.failureDescription && <Text size="xs" c="red">{item.failureDescription}</Text>}</Table.Td><Table.Td>{formatDateTime(item.requestedAt)}</Table.Td><Table.Td><Group gap="xs">
        {canApprove && item.status === "requested" && <><Button size="xs" onClick={() => setAction({ refund: item, kind: "approve" })}>Approve</Button><Button size="xs" color="red" variant="light" onClick={() => setAction({ refund: item, kind: "reject" })}>Reject</Button></>}
        {canApprove && item.status === "failed" && <Button size="xs" variant="light" loading={retry.isPending} onClick={async () => { try { await retry.mutateAsync(item.id); success(`Retry started for refund #${item.id}.`); } catch (cause) { error(apiMessage(cause)); } }}>Retry</Button>}
      </Group></Table.Td></Table.Tr>)}</Table.Tbody>
    </Table></div>}
    {refunds.data && (view === "all" || ageValid) && <Group justify="space-between"><Text size="sm" c="dimmed">Page {refunds.data.meta.page} · {refunds.data.meta.total} refunds</Text><Group gap="xs"><Button variant="default" size="xs" disabled={page <= 1 || refunds.isFetching} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button variant="default" size="xs" disabled={!refunds.data.meta.hasNextPage || refunds.isFetching} onClick={() => setPage((value) => value + 1)}>Next</Button></Group></Group>}
    <RefundRequestModal opened={requestOpened} onClose={() => setRequestOpened(false)} />
    <Modal opened={Boolean(action)} onClose={() => setAction(null)} title={`${action?.kind === "approve" ? "Approve" : "Reject"} refund #${action?.refund.id}`} centered>{action && <Stack><Alert color={action.kind === "approve" ? "yellow" : "red"} title="Check before continuing">This records your decision for exactly {formatPaise(action.refund.amountPaise)} on order #{action.refund.orderId}. Provider submission may begin after approval and cannot be undone from this screen.</Alert>{action.kind === "approve" ? <Checkbox checked={cashReturned} onChange={(event) => setCashReturned(event.currentTarget.checked)} label="Cash was returned (required only for COD refunds)" /> : <Textarea required label="Rejection reason" value={reason} onChange={(event) => setReason(event.currentTarget.value)} minLength={1} />}<Button color={action.kind === "approve" ? "brand" : "red"} disabled={action.kind === "reject" && !reason.trim()} loading={approve.isPending || reject.isPending} onClick={finish}>Confirm {action.kind}</Button></Stack>}</Modal>
  </Stack>;
};
