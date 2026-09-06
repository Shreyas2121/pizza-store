import { Alert, Button, Card, Group, Loader, Modal, Stack, Table, Text, TextInput, Textarea } from "@mantine/core";
import { useState } from "react";
import { EmptyState } from "@/shared/ui";
import { apiMessage, humanizeStatus } from "../model/finance.helpers";
import { error, success } from "@/shared/lib/notifications";
import { useFiscalPeriods, useOpenFiscalPeriod, usePeriodCommand } from "../api/finance.queries";
import type { FiscalPeriod } from "../model/finance.types";
import { StatusBadge } from "./status-badge";

export const PeriodClosePanel = ({ storeId, isOwner }: { storeId: number; isOwner: boolean }) => {
  const periods = useFiscalPeriods(storeId);
  const openPeriod = useOpenFiscalPeriod();
  const periodCommand = usePeriodCommand();
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [target, setTarget] = useState<{ period: FiscalPeriod; action: "soft-close" | "close" | "reopen" } | null>(null);
  const act = async (work: () => Promise<unknown>, message: string) => { try { await work(); success(message); } catch (cause) { error(apiMessage(cause)); } };

  if (periods.isLoading) return <Group><Loader size="sm" /><Text>Loading fiscal periods…</Text></Group>;
  if (periods.isError) return <Alert color="red" title="Fiscal periods unavailable">Period controls could not be loaded. <Button ml="sm" size="compact-xs" onClick={() => void periods.refetch()}>Retry</Button></Alert>;

  return <Stack gap="md">
    <Alert color={isOwner ? "blue" : "gray"} title={isOwner ? "Owner-controlled close" : "Read-only period status"}>{isOwner ? "Soft-close, close, and reopen actions are fully audited and require authentication within 15 minutes." : "Only the platform owner can change fiscal period state."}</Alert>
    {isOwner && <Card withBorder><Text fw={700}>Open fiscal period</Text><Group grow align="end" mt="sm"><TextInput label="Period name" value={name} onChange={(event) => setName(event.currentTarget.value)} /><TextInput type="date" label="Start date" value={startDate} onChange={(event) => setStartDate(event.currentTarget.value)} /><TextInput type="date" label="End date" value={endDate} onChange={(event) => setEndDate(event.currentTarget.value)} /></Group><Textarea mt="sm" label="Audit reason" value={reason} onChange={(event) => setReason(event.currentTarget.value)} /><Button mt="sm" loading={openPeriod.isPending} disabled={!name.trim() || !startDate || !endDate || reason.trim().length < 3} onClick={() => void act(async () => { await openPeriod.mutateAsync({ storeId, name: name.trim(), startDate, endDate, reason: reason.trim() }); setName(""); setStartDate(""); setEndDate(""); setReason(""); }, "Fiscal period opened.")}>Open period</Button></Card>}
    {!periods.data?.length ? <EmptyState title="No fiscal periods" description="The owner must open a fiscal period before journals can post." /> : <Card withBorder><Text fw={700}>Period history</Text><Table mt="sm" withTableBorder><Table.Thead><Table.Tr><Table.Th>Period</Table.Th><Table.Th>Range</Table.Th><Table.Th>Status</Table.Th>{isOwner && <Table.Th>Next control</Table.Th>}</Table.Tr></Table.Thead><Table.Tbody>{periods.data.map((period) => { const action = period.status === "open" ? "soft-close" : period.status === "soft_closed" ? "close" : "reopen"; return <Table.Tr key={period.id}><Table.Td>{period.name}</Table.Td><Table.Td>{period.startDate} – {period.endDate}</Table.Td><Table.Td><StatusBadge value={period.status} /></Table.Td>{isOwner && <Table.Td><Button size="compact-xs" variant="light" onClick={() => setTarget({ period, action })}>{humanizeStatus(action)}</Button></Table.Td>}</Table.Tr>; })}</Table.Tbody></Table></Card>}
    <Modal opened={Boolean(target)} onClose={() => setTarget(null)} title={`${target ? humanizeStatus(target.action) : "Update"} fiscal period`}><Alert color="yellow" mb="sm">This state change affects whether journals can post into the period.</Alert><Textarea label="Audit reason" value={reason} onChange={(event) => setReason(event.currentTarget.value)} /><Button mt="sm" loading={periodCommand.isPending} disabled={reason.trim().length < 3} onClick={() => target && void act(async () => { await periodCommand.mutateAsync({ periodId: target.period.id, action: target.action, reason: reason.trim() }); setTarget(null); setReason(""); }, "Fiscal period updated.")}>Confirm {target ? humanizeStatus(target.action) : "action"}</Button></Modal>
  </Stack>;
};
