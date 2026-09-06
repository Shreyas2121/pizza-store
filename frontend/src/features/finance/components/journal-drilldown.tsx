import { Alert, Badge, Button, Card, Group, Loader, Modal, Stack, Table, Text } from "@mantine/core";
import { useState } from "react";
import { EmptyState } from "@/shared/ui";
import { formatDateTime, formatPaise } from "@/shared/lib/regional";
import { useJournal, useJournalDrillDown } from "../api/finance.queries";
import type { JournalFilters } from "../model/finance.types";
import { StatusBadge } from "./status-badge";

const filterSummary = (filters: JournalFilters) => [
  filters.from && `from ${filters.from}`, filters.to && `to ${filters.to}`,
  filters.accountCodes?.length && `accounts ${filters.accountCodes.join(", ")}`,
  filters.accountTypes?.length && `types ${filters.accountTypes.join(", ")}`,
  filters.excludeAccountCodes?.length && `excluding ${filters.excludeAccountCodes.join(", ")}`,
  filters.eventType && `event ${filters.eventType}`, filters.sourceType && `source ${filters.sourceType}`, filters.sourceId && `source ID ${filters.sourceId}`,
].filter(Boolean).join(" · ");

export const JournalDrillDown = ({ storeId, filters, onClear }: { storeId: number | null; filters: JournalFilters; onClear: () => void }) => {
  const journals = useJournalDrillDown(storeId, filters);
  const [journalId, setJournalId] = useState<number | null>(null);
  const detail = useJournal(journalId);
  if (journals.isLoading) return <Group><Loader size="sm" /><Text>Loading filtered source transactions…</Text></Group>;
  if (journals.isError) return <Alert color="red" title="Drill-down unavailable">Filtered journals could not be loaded. <Button ml="sm" size="compact-xs" onClick={() => void journals.refetch()}>Retry</Button></Alert>;
  const result = journals.data!;
  return <Stack gap="md">
    <Alert color="blue" title="Filtered journal drill-down"><Group justify="space-between"><Text size="sm">{storeId === null ? "All stores" : `Store ${storeId}`} · {filterSummary(filters) || "all posted journals"}</Text><Button size="compact-xs" variant="subtle" onClick={onClear}>Clear filter</Button></Group></Alert>
    {journals.isFetching && <Badge color="blue">Refreshing</Badge>}
    {!journals.isFetching && journals.isStale && <Badge color="orange">Stale — refresh available</Badge>}
    {result.meta.hasNextPage && <Alert color="yellow" title="Partial result">Showing the first {result.meta.limit} matching journals. Narrow the date or source filters to reconcile this aggregate.</Alert>}
    {!result.data.length ? <EmptyState title="No matching journals" description="The aggregate is zero or no posted source transactions match these filters." /> : <Card withBorder><Table highlightOnHover><Table.Thead><Table.Tr><Table.Th>Store</Table.Th><Table.Th>Date</Table.Th><Table.Th>Journal</Table.Th><Table.Th>Description</Table.Th><Table.Th>Source</Table.Th><Table.Th>Status</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{result.data.map((item) => <Table.Tr key={item.id} onClick={() => setJournalId(item.id)} style={{ cursor: "pointer" }}><Table.Td>{item.storeId}</Table.Td><Table.Td>{item.businessDate}</Table.Td><Table.Td>{item.journalNumber}</Table.Td><Table.Td>{item.description}</Table.Td><Table.Td>{item.sourceType}:{item.sourceId} · {item.eventType}</Table.Td><Table.Td><StatusBadge value={item.status} /></Table.Td></Table.Tr>)}</Table.Tbody></Table></Card>}
    <Modal opened={Boolean(journalId)} onClose={() => setJournalId(null)} title={detail.data?.journalNumber ?? "Journal source detail"} size="xl">{detail.isLoading ? <Loader /> : detail.isError ? <Alert color="red">Journal detail could not be loaded.</Alert> : detail.data && <Stack><Text fw={700}>{detail.data.description}</Text><Text size="sm" c="dimmed">Store {detail.data.storeId} · {detail.data.businessDate} · {formatDateTime(detail.data.occurredAt)}</Text><Text size="sm">Source: {detail.data.sourceType}:{detail.data.sourceId} · {detail.data.eventType} v{detail.data.sourceVersion}</Text><Table withTableBorder><Table.Thead><Table.Tr><Table.Th>Account</Table.Th><Table.Th>Debit</Table.Th><Table.Th>Credit</Table.Th><Table.Th>Linked source</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{detail.data.lines.map((line) => <Table.Tr key={line.id}><Table.Td>{line.account.code} · {line.account.name}</Table.Td><Table.Td>{line.debitPaise ? formatPaise(line.debitPaise) : "—"}</Table.Td><Table.Td>{line.creditPaise ? formatPaise(line.creditPaise) : "—"}</Table.Td><Table.Td>{line.orderId ? `Order ${line.orderId}` : line.refundId ? `Refund ${line.refundId}` : line.expenseId ? `Expense ${line.expenseId}` : line.paymentAttemptId ? `Payment ${line.paymentAttemptId}` : "—"}</Table.Td></Table.Tr>)}</Table.Tbody></Table></Stack>}</Modal>
  </Stack>;
};
