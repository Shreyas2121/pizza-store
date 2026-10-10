import { useEffect, useState } from "react";
import { Alert, Button, Card, Checkbox, Group, Modal, NumberInput, Select, Stack, Table, Text, Textarea } from "@mantine/core";
import { EmptyState, TableSkeleton, PanelSkeleton } from "@/shared/ui";
import { formatDateTime, formatPaise } from "@/shared/lib/regional";
import { error, success } from "@/shared/lib/notifications";
import { apiMessage, humanizeStatus } from "../model/finance.helpers";
import { useCashSession, useCashSessions, useCloseCashSession, useOpenCashSession, useRecordCashMovement, useReopenCashSession, useReverseCashMovement } from "../api/finance.queries";
import type { CashMovement, CashMovementType } from "../model/finance.types";
import { StatusBadge } from "./status-badge";

const asInteger = (value: string | number) => typeof value === "number" && Number.isInteger(value) ? value : 0;

export const CashSessionsPanel = ({ storeId, canReview }: { storeId: number; canReview: boolean }) => {
  const sessions = useCashSessions(storeId);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [openingFloat, setOpeningFloat] = useState<string | number>(0);
  const [movementType, setMovementType] = useState<Exclude<CashMovementType, "cod_collection" | "refund">>("cash_in");
  const [amount, setAmount] = useState<string | number>(0);
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [reason, setReason] = useState("");
  const [counted, setCounted] = useState<string | number>(0);
  const [acknowledged, setAcknowledged] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [reverseTarget, setReverseTarget] = useState<CashMovement | null>(null);
  const [reverseReason, setReverseReason] = useState("");
  const detail = useCashSession(selectedId);
  const open = useOpenCashSession();
  const record = useRecordCashMovement();
  const close = useCloseCashSession();
  const reopen = useReopenCashSession();
  const reverse = useReverseCashMovement();

  useEffect(() => {
    if (!selectedId && sessions.data?.data[0]) setSelectedId(sessions.data.data[0].id);
  }, [selectedId, sessions.data]);

  const act = async (work: () => Promise<unknown>, message: string) => {
    try { await work(); success(message); setReason(""); }
    catch (cause) { error(apiMessage(cause)); }
  };

  if (sessions.isLoading) return <TableSkeleton toolbar={false} label="Loading cash sessions" />;
  if (sessions.isError) return <Alert color="red" title="Cash sessions unavailable">The cash-session history could not be loaded. Try again.</Alert>;

  const detailData = detail.data;
  const selected = detailData?.session;
  return <Stack>
    {!sessions.data?.data.length && <EmptyState title="No cash sessions" description="Open today’s session before a COD delivery or cash movement is recorded." />}
    {canReview && <Card withBorder>
      <Group align="end" justify="space-between">
        <NumberInput label="Opening float (paise)" description="Whole paise; 100 paise = ₹1.00" min={0} step={100} value={openingFloat} onChange={setOpeningFloat} allowDecimal={false} />
        <Button loading={open.isPending} onClick={() => act(async () => { const created = await open.mutateAsync({ storeId, openingFloatPaise: asInteger(openingFloat) }); setSelectedId(created.id); }, "Cash session opened.")}>Open today’s session</Button>
      </Group>
    </Card>}

    {!!sessions.data?.data.length && <Select label="Cash session" value={selectedId?.toString() ?? null} onChange={(value) => setSelectedId(value ? Number(value) : null)} data={sessions.data.data.map((item) => ({ value: String(item.id), label: `${item.businessDate} · ${humanizeStatus(item.status)} · ${formatPaise(item.expectedCashPaise)}` }))} />}

    {detail.isLoading ? <PanelSkeleton label="Loading cash session detail" /> : detail.isError ? <Alert color="red">Cash-session detail could not be loaded.</Alert> : selected && <>
      <Card withBorder>
        <Group justify="space-between" align="start"><div><Group gap="xs"><Text fw={700}>Session #{selected.id}</Text><StatusBadge value={selected.status} /></Group><Text size="sm" c="dimmed">Business date {selected.businessDate} · Opened {formatDateTime(selected.openedAt)}</Text></div><div className="text-right"><Text size="xs" c="dimmed">Expected cash</Text><Text fw={800} className="tabular-nums">{formatPaise(selected.expectedCashPaise)}</Text></div></Group>
        {selected.status === "closed" && <Alert mt="md" color={selected.variancePaise ? "yellow" : "green"} title="Counted close"><Text>Counted {formatPaise(selected.countedCashPaise ?? 0)} · Variance {formatPaise(selected.variancePaise ?? 0)}</Text><Text size="xs">Closed {selected.closedAt ? formatDateTime(selected.closedAt) : "—"} by user #{selected.closedBy ?? "—"}</Text></Alert>}
      </Card>

      {selected.status === "open" && <Card withBorder><Text fw={700}>Record manual movement</Text><Text size="sm" c="dimmed" mb="sm">COD collections and COD refunds appear automatically from their source workflows.</Text><Group grow align="end"><Select label="Movement type" value={movementType} onChange={(value) => setMovementType(value as typeof movementType)} data={["cash_in", "cash_out", "deposit", "adjustment"].map((value) => ({ value, label: humanizeStatus(value) }))} /><NumberInput label="Amount (paise)" min={1} step={100} value={amount} onChange={setAmount} allowDecimal={false} />{movementType === "adjustment" && <Select label="Adjustment direction" value={direction} onChange={(value) => setDirection(value as "in" | "out")} data={[{ value: "in", label: "Cash in" }, { value: "out", label: "Cash out" }]} />}</Group><Textarea mt="sm" required label="Reason" value={reason} onChange={(event) => setReason(event.currentTarget.value)} minLength={3} maxLength={1000} /><Button mt="sm" disabled={asInteger(amount) < 1 || reason.trim().length < 3} loading={record.isPending} onClick={() => act(() => record.mutateAsync({ sessionId: selected.id, type: movementType, amountPaise: asInteger(amount), direction: movementType === "adjustment" ? direction : undefined, reason: reason.trim() }), "Cash movement recorded.")}>Record movement</Button></Card>}

      <Card withBorder><Text fw={700}>Movement history</Text>{!detailData.movements.length ? <Text mt="sm" size="sm" c="dimmed">No movements have been recorded.</Text> : <div className="overflow-x-auto"><Table mt="sm" withTableBorder><Table.Thead><Table.Tr><Table.Th>Time</Table.Th><Table.Th>Type</Table.Th><Table.Th>Amount</Table.Th><Table.Th>Source / reason</Table.Th>{canReview && selected.status === "open" && <Table.Th>Review</Table.Th>}</Table.Tr></Table.Thead><Table.Tbody>{detailData.movements.map((item) => { const wasReversed = detailData.movements.some((candidate) => candidate.reversesMovementId === item.id); return <Table.Tr key={item.id}><Table.Td>{formatDateTime(item.occurredAt)}</Table.Td><Table.Td>{humanizeStatus(item.type)}</Table.Td><Table.Td className="tabular-nums">{formatPaise(item.amountPaise)}</Table.Td><Table.Td>{item.orderId ? `Order #${item.orderId}` : item.refundId ? `Refund #${item.refundId}` : item.reversesMovementId ? `Reversal of #${item.reversesMovementId}: ${item.reason}` : item.reason}</Table.Td>{canReview && selected.status === "open" && <Table.Td><Button size="compact-xs" variant="subtle" color="red" disabled={Boolean(item.reversesMovementId) || wasReversed} onClick={() => setReverseTarget(item)}>{wasReversed ? "Reversed" : "Reverse"}</Button></Table.Td>}</Table.Tr>; })}</Table.Tbody></Table></div>}</Card>

      {canReview && selected.status === "open" && <Card withBorder><Text fw={700}>Owner / manager counted close</Text><NumberInput mt="sm" label="Counted cash (paise)" min={0} step={100} value={counted} onChange={setCounted} allowDecimal={false} /><Text mt="xs" size="sm">Current variance: {formatPaise(asInteger(counted) - selected.expectedCashPaise)}</Text><Checkbox mt="sm" checked={acknowledged} onChange={(event) => setAcknowledged(event.currentTarget.checked)} label="I reviewed and acknowledge any material variance (₹500.00 or more)." /><Button mt="sm" color="orange" loading={close.isPending} onClick={() => act(() => close.mutateAsync({ sessionId: selected.id, countedCashPaise: asInteger(counted), materialVarianceAcknowledged: acknowledged }), "Cash session closed and variance recorded.")}>Close counted session</Button></Card>}

      {canReview && selected.status === "closed" && <Card withBorder><Text fw={700}>Controlled reopen</Text><Alert color="yellow" my="sm">Reopening reverses the prior close event and preserves its counted evidence. Use this only to correct the session.</Alert><Textarea required label="Reopen reason" value={reopenReason} onChange={(event) => setReopenReason(event.currentTarget.value)} minLength={3} /><Button mt="sm" variant="outline" disabled={reopenReason.trim().length < 3} loading={reopen.isPending} onClick={() => act(() => reopen.mutateAsync({ sessionId: selected.id, reason: reopenReason.trim() }), "Cash session reopened; the prior close remains in history.")}>Reopen session</Button></Card>}
    </>}
    <Modal opened={Boolean(reverseTarget)} onClose={() => { setReverseTarget(null); setReverseReason(""); }} title={`Reverse movement #${reverseTarget?.id ?? ""}`} centered>
      <Alert color="red" mb="sm">This records an opposite adjustment. The original movement remains immutable.</Alert>
      <Textarea required label="Reversal reason" value={reverseReason} onChange={(event) => setReverseReason(event.currentTarget.value)} minLength={3} autoFocus />
      <Button mt="sm" color="red" loading={reverse.isPending} disabled={reverseReason.trim().length < 3} onClick={() => reverseTarget && void act(async () => { await reverse.mutateAsync({ movementId: reverseTarget.id, reason: reverseReason.trim() }); setReverseTarget(null); setReverseReason(""); }, "Movement reversed with an opposite adjustment.")}>Confirm reversal</Button>
    </Modal>
  </Stack>;
};
