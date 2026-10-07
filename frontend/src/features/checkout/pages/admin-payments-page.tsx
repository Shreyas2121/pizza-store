import { useState } from "react";
import { Link } from "react-router";
import { Alert, Badge, Button, NumberInput, Paper, Text } from "@mantine/core";
import { RefreshCw } from "lucide-react";
import { PageHeader } from "@/shared/ui";
import { formatPaise } from "@/shared/lib";
import { useReconcilePayments } from "../api/payment.queries";

export default function AdminPaymentsPage() {
  const reconcile = useReconcilePayments();
  const [age, setAge] = useState<number | string>(15);
  const [limit, setLimit] = useState<number | string>(25);
  const valid = typeof age === "number" && Number.isInteger(age) && age >= 1 && age <= 1440 && typeof limit === "number" && Number.isInteger(limit) && limit >= 1 && limit <= 50;
  return <div className="space-y-5">
    <PageHeader eyebrow="Operations" title="Payment reconciliation" description="Check stale online payments against the payment provider and recover confirmed orders." />
    <Alert color="blue">This checks processing and failed payments older than the selected age. Confirmed payments can finalize orders and notify the kitchen. Run one batch at a time; pending provider results may remain unchanged.</Alert>
    <Paper withBorder radius="lg" p="lg"><form className="flex flex-wrap items-end gap-4" onSubmit={(event) => { event.preventDefault(); if (valid) reconcile.mutate({ olderThanMinutes: Number(age), limit: Number(limit) }); }}>
      <NumberInput label="Minimum age (minutes)" description="1 to 1,440 minutes" min={1} max={1440} allowDecimal={false} value={age} onChange={setAge} disabled={reconcile.isPending} />
      <NumberInput label="Maximum payments" description="1 to 50 per batch" min={1} max={50} allowDecimal={false} value={limit} onChange={setLimit} disabled={reconcile.isPending} />
      <Button type="submit" loading={reconcile.isPending} disabled={!valid} leftSection={<RefreshCw size={16} />}>Reconcile payments</Button>
    </form></Paper>
    {reconcile.isError && <Alert color="red" role="alert">Payment reconciliation could not be completed. Check provider availability and try again.</Alert>}
    {reconcile.data && !reconcile.isPending && !reconcile.isError && <Paper withBorder radius="lg" p="lg">
      <Text fw={700} size="lg" role="status">Batch results</Text>
      <div className="my-4 flex flex-wrap gap-2"><Badge>Checked: {reconcile.data.data.checked}</Badge><Badge color="basil">Finalized: {reconcile.data.data.finalized}</Badge><Badge color="orange">Failed: {reconcile.data.data.failed}</Badge><Badge color="red">Errors: {reconcile.data.data.errors}</Badge></div>
      {!reconcile.data.data.checked ? <Text c="dimmed">No stale payments matched this batch.</Text> : <ul className="divide-y divide-border">{reconcile.data.data.results.map((result, index) => <li key={index} className="flex flex-wrap items-center justify-between gap-3 py-3">
        <div><Text fw={600}>{result.localOrderId ? <Link to={`/admin/order/${result.localOrderId}`} className="text-brand underline">Order #{result.localOrderId}</Link> : result.providerOrderId ?? "Provider order not attached"}</Text>{result.totalPrice !== undefined && <Text size="sm">{formatPaise(result.totalPrice)}</Text>}{result.error && <Text size="sm" c="red">{result.error}</Text>}</div>
        <Badge color={result.status === "error" ? "red" : result.status === "finalized" ? "basil" : "gray"}>{result.status}</Badge>
      </li>)}</ul>}
    </Paper>}
  </div>;
}
