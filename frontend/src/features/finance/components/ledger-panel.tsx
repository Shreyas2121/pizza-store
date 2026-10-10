import { useMemo, useState } from "react";
import { Alert, Badge, Button, Card, Group, Modal, NumberInput, Select, SimpleGrid, Stack, Table, Text, TextInput, Textarea } from "@mantine/core";
import { EmptyState, TableSkeleton, PanelSkeleton } from "@/shared/ui";
import { formatDateTime, formatPaise } from "@/shared/lib/regional";
import { error, success } from "@/shared/lib/notifications";
import { apiMessage, formatAggregatePaise, humanizeStatus } from "../model/finance.helpers";
import { useFiscalPeriods, useJournal, useJournals, useLedgerAccounts, useOpenFiscalPeriod, usePeriodCommand, usePostManualJournal, useReverseJournal, useTrialBalance } from "../api/finance.queries";
import type { FiscalPeriod, JournalEntry } from "../model/finance.types";
import { StatusBadge } from "./status-badge";

const today = () => new Date().toISOString().slice(0, 10);
const integer = (value: string | number) => typeof value === "number" && Number.isSafeInteger(value) ? value : 0;

export const LedgerPanel = ({ storeId, canPost, isOwner }: { storeId: number; canPost: boolean; isOwner: boolean }) => {
  const accounts = useLedgerAccounts(storeId);
  const journals = useJournals(storeId);
  const trial = useTrialBalance(storeId);
  const periods = useFiscalPeriods(storeId);
  const [journalId, setJournalId] = useState<number | null>(null);
  const detail = useJournal(journalId);
  const [manualOpen, setManualOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [businessDate, setBusinessDate] = useState(today());
  const [debitAccount, setDebitAccount] = useState<string | null>(null);
  const [creditAccount, setCreditAccount] = useState<string | null>(null);
  const [amount, setAmount] = useState<string | number>(0);
  const [overrideReason, setOverrideReason] = useState("");
  const [reverseTarget, setReverseTarget] = useState<JournalEntry | null>(null);
  const [reverseReason, setReverseReason] = useState("");
  const [periodName, setPeriodName] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [periodReason, setPeriodReason] = useState("");
  const [periodTarget, setPeriodTarget] = useState<{ period: FiscalPeriod; action: "soft-close" | "close" | "reopen" } | null>(null);
  const postManual = usePostManualJournal();
  const reverse = useReverseJournal();
  const openPeriod = useOpenFiscalPeriod();
  const periodCommand = usePeriodCommand();

  const accountOptions = useMemo(() => (accounts.data ?? []).filter((item) => item.isActive).map((item) => ({ value: item.code, label: `${item.code} · ${item.name}` })), [accounts.data]);
  const act = async (work: () => Promise<unknown>, message: string) => { try { await work(); success(message); } catch (cause) { error(apiMessage(cause)); } };

  if (accounts.isLoading || journals.isLoading || trial.isLoading || periods.isLoading) return <TableSkeleton toolbar={false} label="Loading ledger" />;
  if (accounts.isError || journals.isError || trial.isError || periods.isError) return <Alert color="red" title="Ledger unavailable">The ledger workspace could not be loaded.</Alert>;
  const balance = trial.data!;

  return <Stack gap="lg">
    <SimpleGrid cols={{ base: 1, md: 3 }}>
      <Card withBorder><Text size="xs" c="dimmed">Total debits</Text><Text fw={800} size="lg" className="tabular-nums">{formatAggregatePaise(balance.totals.debitPaise)}</Text></Card>
      <Card withBorder><Text size="xs" c="dimmed">Total credits</Text><Text fw={800} size="lg" className="tabular-nums">{formatAggregatePaise(balance.totals.creditPaise)}</Text></Card>
      <Card withBorder><Text size="xs" c="dimmed">Trial balance</Text><Group gap="xs"><Text fw={800} size="lg">{balance.policy.balanced ? "Balanced" : "Out of balance"}</Text><Badge color={balance.policy.balanced ? "green" : "red"}>{formatAggregatePaise(balance.totals.differencePaise)}</Badge></Group><Text size="xs" c="dimmed">INR · posted journals · store scoped</Text></Card>
    </SimpleGrid>

    <Card withBorder><Group justify="space-between"><div><Text fw={700}>Trial balance</Text><Text size="sm" c="dimmed">Wider aggregates are serialized as exact paise strings.</Text></div>{canPost && <Button onClick={() => setManualOpen(true)}>Manual adjustment</Button>}</Group>
      {!balance.accounts.length ? <EmptyState title="No posted balances" description="Post source or manual journals to populate the trial balance." /> : <div className="overflow-x-auto"><Table mt="sm" withTableBorder><Table.Thead><Table.Tr><Table.Th>Account</Table.Th><Table.Th>Type</Table.Th><Table.Th>Debit</Table.Th><Table.Th>Credit</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{balance.accounts.map((row) => <Table.Tr key={row.accountId}><Table.Td>{row.accountCode} · {row.accountName}</Table.Td><Table.Td>{humanizeStatus(row.accountType)}</Table.Td><Table.Td className="tabular-nums">{formatAggregatePaise(row.debitPaise)}</Table.Td><Table.Td className="tabular-nums">{formatAggregatePaise(row.creditPaise)}</Table.Td></Table.Tr>)}</Table.Tbody></Table></div>}
    </Card>

    <Card withBorder><Text fw={700}>Journal history</Text><Text size="sm" c="dimmed">Select a journal to inspect its balanced lines and immutable source identity.</Text>
      {!journals.data?.length ? <EmptyState title="No journals" description="No posted journals exist for this store." /> : <div className="overflow-x-auto"><Table mt="sm" highlightOnHover><Table.Thead><Table.Tr><Table.Th>Date</Table.Th><Table.Th>Journal</Table.Th><Table.Th>Description</Table.Th><Table.Th>Source</Table.Th><Table.Th>Status</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{journals.data.map((item) => <Table.Tr key={item.id} onClick={() => setJournalId(item.id)} style={{ cursor: "pointer" }}><Table.Td>{item.businessDate}</Table.Td><Table.Td>{item.journalNumber}</Table.Td><Table.Td>{item.description}</Table.Td><Table.Td>{item.eventType}</Table.Td><Table.Td><StatusBadge value={item.status} /></Table.Td></Table.Tr>)}</Table.Tbody></Table></div>}
    </Card>

    <Card withBorder><Group justify="space-between"><div><Text fw={700}>Fiscal periods</Text><Text size="sm" c="dimmed">Closed periods reject every backdated posting. Owner actions require authentication within 15 minutes.</Text></div></Group>
      {isOwner && <Stack mt="sm"><Group grow align="end"><TextInput label="Period name" value={periodName} onChange={(event) => setPeriodName(event.currentTarget.value)} /><TextInput type="date" label="Start date" value={periodStart} onChange={(event) => setPeriodStart(event.currentTarget.value)} /><TextInput type="date" label="End date" value={periodEnd} onChange={(event) => setPeriodEnd(event.currentTarget.value)} /></Group><Textarea label="Audit reason" value={periodReason} onChange={(event) => setPeriodReason(event.currentTarget.value)} /><Button variant="outline" loading={openPeriod.isPending} disabled={!periodName.trim() || !periodStart || !periodEnd || periodReason.trim().length < 3} onClick={() => void act(async () => { await openPeriod.mutateAsync({ storeId, name: periodName.trim(), startDate: periodStart, endDate: periodEnd, reason: periodReason.trim() }); setPeriodName(""); setPeriodStart(""); setPeriodEnd(""); setPeriodReason(""); }, "Fiscal period opened.")}>Open fiscal period</Button></Stack>}
      {!periods.data?.length ? <Text mt="sm" size="sm" c="dimmed">No fiscal periods.</Text> : <Table mt="md"><Table.Thead><Table.Tr><Table.Th>Period</Table.Th><Table.Th>Range</Table.Th><Table.Th>Status</Table.Th>{isOwner && <Table.Th>Control</Table.Th>}</Table.Tr></Table.Thead><Table.Tbody>{periods.data.map((period) => <Table.Tr key={period.id}><Table.Td>{period.name}</Table.Td><Table.Td>{period.startDate} – {period.endDate}</Table.Td><Table.Td><StatusBadge value={period.status} /></Table.Td>{isOwner && <Table.Td><Button size="compact-xs" variant="subtle" onClick={() => setPeriodTarget({ period, action: period.status === "open" ? "soft-close" : period.status === "soft_closed" ? "close" : "reopen" })}>{period.status === "open" ? "Soft close" : period.status === "soft_closed" ? "Close" : "Reopen"}</Button></Table.Td>}</Table.Tr>)}</Table.Tbody></Table>}
    </Card>

    <Modal opened={Boolean(journalId)} onClose={() => setJournalId(null)} title={detail.data?.journalNumber ?? "Journal detail"} size="xl">
      {detail.isLoading ? <PanelSkeleton label="Loading journal details" /> : detail.isError ? <Alert color="red">Journal detail could not be loaded.</Alert> : detail.data && <Stack><Group justify="space-between"><div><Text fw={700}>{detail.data.description}</Text><Text size="sm" c="dimmed">{detail.data.businessDate} · {formatDateTime(detail.data.occurredAt)} · {detail.data.eventType}</Text></div><StatusBadge value={detail.data.status} /></Group><Table withTableBorder><Table.Thead><Table.Tr><Table.Th>#</Table.Th><Table.Th>Account</Table.Th><Table.Th>Debit</Table.Th><Table.Th>Credit</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{detail.data.lines.map((line) => <Table.Tr key={line.id}><Table.Td>{line.lineNumber}</Table.Td><Table.Td>{line.account.code} · {line.account.name}</Table.Td><Table.Td>{line.debitPaise ? formatPaise(line.debitPaise) : "—"}</Table.Td><Table.Td>{line.creditPaise ? formatPaise(line.creditPaise) : "—"}</Table.Td></Table.Tr>)}</Table.Tbody></Table>{canPost && detail.data.status === "posted" && !detail.data.reversalOfJournalEntryId && <Button color="red" variant="outline" onClick={() => { setReverseTarget(detail.data!); setJournalId(null); }}>Reverse journal</Button>}</Stack>}
    </Modal>

    <Modal opened={manualOpen} onClose={() => setManualOpen(false)} title="Confirm manual journal" size="lg"><Alert color="yellow" mb="sm">This posts immediately through the balanced kernel. Posted history cannot be edited or deleted.</Alert><Stack><TextInput label="Business date" type="date" value={businessDate} onChange={(event) => setBusinessDate(event.currentTarget.value)} /><TextInput label="Description" value={description} onChange={(event) => setDescription(event.currentTarget.value)} /><Group grow><Select searchable label="Debit account" data={accountOptions} value={debitAccount} onChange={setDebitAccount} /><Select searchable label="Credit account" data={accountOptions} value={creditAccount} onChange={setCreditAccount} /></Group><NumberInput label="Amount (paise)" min={1} allowDecimal={false} value={amount} onChange={setAmount} /><Textarea label="Soft-close owner override reason (only when needed)" value={overrideReason} onChange={(event) => setOverrideReason(event.currentTarget.value)} /><Button loading={postManual.isPending} disabled={!businessDate || description.trim().length < 3 || !debitAccount || !creditAccount || debitAccount === creditAccount || integer(amount) < 1} onClick={() => void act(async () => { await postManual.mutateAsync({ storeId, businessDate, description: description.trim(), lines: [{ accountCode: debitAccount!, side: "debit", amountPaise: integer(amount) }, { accountCode: creditAccount!, side: "credit", amountPaise: integer(amount) }], softCloseOverrideReason: overrideReason.trim() || undefined }); setManualOpen(false); setDescription(""); setAmount(0); setOverrideReason(""); }, "Balanced manual journal posted.")}>Confirm balanced posting</Button></Stack></Modal>

    <Modal opened={Boolean(reverseTarget)} onClose={() => setReverseTarget(null)} title="Confirm exact journal reversal"><Alert color="red" mb="sm">The original stays immutable. A new journal will copy every line with debit and credit exchanged.</Alert><TextInput type="date" label="Effective open business date" value={businessDate} onChange={(event) => setBusinessDate(event.currentTarget.value)} /><Textarea mt="sm" label="Audit reason" value={reverseReason} onChange={(event) => setReverseReason(event.currentTarget.value)} /><Button mt="sm" color="red" loading={reverse.isPending} disabled={!businessDate || reverseReason.trim().length < 3} onClick={() => reverseTarget && void act(async () => { await reverse.mutateAsync({ journalId: reverseTarget.id, businessDate, reason: reverseReason.trim() }); setReverseTarget(null); setReverseReason(""); }, "Journal reversed with exact opposite lines.")}>Confirm reversal</Button></Modal>

    <Modal opened={Boolean(periodTarget)} onClose={() => setPeriodTarget(null)} title={`${periodTarget ? humanizeStatus(periodTarget.action) : "Update"} fiscal period`}><Alert color="yellow" mb="sm">This owner-only action is audited and requires a recently issued access token.</Alert><Textarea label="Audit reason" value={periodReason} onChange={(event) => setPeriodReason(event.currentTarget.value)} /><Button mt="sm" loading={periodCommand.isPending} disabled={periodReason.trim().length < 3} onClick={() => periodTarget && void act(async () => { await periodCommand.mutateAsync({ periodId: periodTarget.period.id, action: periodTarget.action, reason: periodReason.trim() }); setPeriodTarget(null); setPeriodReason(""); }, `Period ${humanizeStatus(periodTarget.action)} completed.`)}>Confirm period action</Button></Modal>
  </Stack>;
};
