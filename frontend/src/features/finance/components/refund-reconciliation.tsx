import { useState } from "react";
import { Alert, Badge, Button, Card, Group, NumberInput, Stack, Text } from "@mantine/core";
import { useReconcileRefunds } from "../api/finance.queries";
import { apiMessage } from "../model/finance.helpers";

export function RefundReconciliation({ storeId }: { storeId: number }) {
  const reconcile = useReconcileRefunds();
  const [age, setAge] = useState<number | string>(15);
  const [limit, setLimit] = useState<number | string>(50);
  const valid = typeof age === "number" && Number.isInteger(age) && age >= 1 && age <= 10080 && typeof limit === "number" && Number.isInteger(limit) && limit >= 1 && limit <= 100;
  return <Card withBorder><Stack gap="sm">
    <Text fw={700}>Reconcile stale refunds</Text><Text size="sm" c="dimmed">Check provider outcomes for this store and update local refunds. This can mark refunds processed or failed; it does not request a new refund.</Text>
    <form onSubmit={(event) => { event.preventDefault(); if (valid) reconcile.mutate({ storeId, olderThanMinutes: Number(age), limit: Number(limit) }); }}>
      <Group align="end"><NumberInput label="Minimum age (minutes)" min={1} max={10080} allowDecimal={false} value={age} onChange={setAge} disabled={reconcile.isPending} /><NumberInput label="Batch limit" min={1} max={100} allowDecimal={false} value={limit} onChange={setLimit} disabled={reconcile.isPending} /><Button type="submit" disabled={!valid} loading={reconcile.isPending}>Reconcile refunds</Button></Group>
    </form>
    {reconcile.isError && <Alert color="red" role="alert">{apiMessage(reconcile.error)}</Alert>}
    {reconcile.data && !reconcile.isPending && !reconcile.isError && <div>
      <Group gap="xs" aria-label="Refund reconciliation results">{["checked", "processed", "failed", "processing", "unchanged", "errors"].map((key) => <Badge key={key} color={key === "errors" && reconcile.data.data.errors ? "red" : "gray"}>{key}: {reconcile.data.data[key as keyof Omit<typeof reconcile.data.data, "results">]}</Badge>)}</Group>
      {!reconcile.data.data.checked && <Text size="sm" mt="sm" role="status">No stale refunds matched this batch.</Text>}
      {reconcile.data.data.results.length > 0 && <ul className="mt-3 divide-y divide-border">{reconcile.data.data.results.map((result) => <li key={result.refundId} className="py-2"><Text size="sm">Refund #{result.refundId} · Order #{result.orderId} · {result.status}</Text>{result.error && <Text size="sm" c="red">{result.error}</Text>}</li>)}</ul>}
    </div>}
  </Stack></Card>;
}
