import { Alert, Badge, Button, Card, Group, Loader, SimpleGrid, Stack, Table, Text, Tooltip, UnstyledButton } from "@mantine/core";
import { ArrowRight, Info, RefreshCw } from "lucide-react";
import { EmptyState } from "@/shared/ui";
import { formatAggregatePaise } from "../model/finance.helpers";
import { useFinanceMargins, useFinanceOverview, useFinanceProfitAndLoss, useFinanceSales } from "../api/finance.queries";
import type { FinanceReportGroup, FinanceReportPolicy, FinanceReportTotals, JournalFilters } from "../model/finance.types";

export type FinanceDrillDown = { tab: "ledger" | "refunds" | "expenses" | "issues"; filters?: JournalFilters };
type ReportProps = { storeId: number | null | undefined; from: string; to: string; groupBy: FinanceReportGroup; onDrillDown: (target: FinanceDrillDown) => void };

const amount = (value: string) => formatAggregatePaise(value);
const margin = (value: number | null) => value === null ? "Not available" : `${(value / 100).toFixed(2)}%`;
const isZero = (value: string) => BigInt(value) === 0n;
const periodDates = (period: string, groupBy: FinanceReportGroup): JournalFilters => {
  if (groupBy === "month") {
    const [year, month] = period.split("-").map(Number);
    return { from: `${period}-01`, to: new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10) };
  }
  if (groupBy === "quarter") {
    const [yearText, quarterText] = period.split("-Q");
    const startMonth = (Number(quarterText) - 1) * 3;
    return { from: new Date(Date.UTC(Number(yearText), startMonth, 1)).toISOString().slice(0, 10), to: new Date(Date.UTC(Number(yearText), startMonth + 3, 0)).toISOString().slice(0, 10) };
  }
  const startYear = Number(period.slice(3, 7));
  return { from: `${startYear}-04-01`, to: `${startYear + 1}-03-31` };
};
const periodTarget = (target: FinanceDrillDown, period: string, groupBy: FinanceReportGroup): FinanceDrillDown => ({ ...target, filters: { ...target.filters, ...periodDates(period, groupBy) } });
const dateTarget = (target: FinanceDrillDown, period: { from: string; to: string }): FinanceDrillDown => ({ ...target, filters: { ...target.filters, ...period } });

const METRIC_DEFINITIONS = {
  recognizedRevenuePaise: "Tax-exclusive food and delivery revenue recognized at delivery, less posted discounts and finalized post-delivery refunds.",
  collectionsPaise: "Captured COD and Razorpay amounts in the selected period. Collections are cash flow and are not the same as revenue.",
  refundsPaise: "Tax-exclusive contra revenue from finalized refunds after delivery. The separately reversed included tax is excluded.",
  cogsPaise: "Standard-cost snapshots recognized when orders are delivered. A refund does not reverse COGS unless inventory is separately accepted back.",
  grossProfitPaise: "Recognized revenue minus cost of goods sold.",
  operatingExpensesPaise: "Net posted expense-account movements excluding COGS and payroll; includes gateway charges, cash variance, and rounding movements.",
  payrollCostPaise: "Employer cost from posted pay runs. It may include earning, deduction, and employer-cost components and is not take-home pay. Exact values require payroll access.",
  operatingResultPaise: "Gross profit minus operating expenses and payroll employer cost. It is suppressed when payroll cost is restricted to prevent subtraction.",
  unsettledRazorpayPaise: "Net Razorpay clearing balance through the report end date, including earlier captures, refunds, and settlements.",
  cashVariancePaise: "Net posted cash shortages less overages from closed COD cash sessions.",
  openReconciliationIssues: "Current open settlement reconciliation issues in the selected store scope; this count is not historical.",
} as const;

type DefinedMetric = keyof typeof METRIC_DEFINITIONS;
const MetricLabel = ({ metric, label }: { metric: DefinedMetric; label: string }) => <Group component="span" gap={4} wrap="nowrap" display="inline-flex">
  <span>{label}</span>
  <Tooltip label={METRIC_DEFINITIONS[metric]} multiline w={320} withArrow>
    <UnstyledButton aria-label={`Definition: ${label}`} display="inline-flex"><Info size={13} aria-hidden="true" /></UnstyledButton>
  </Tooltip>
</Group>;

const ReportStatus = ({ policy, isFetching, isStale, partial }: { policy: FinanceReportPolicy; isFetching: boolean; isStale: boolean; partial?: boolean }) => <Stack gap={2}>
  <Group gap="xs" wrap="wrap">
    <Badge color={partial ? "yellow" : "green"}>{partial ? "Partial — review issues" : "Complete"}</Badge>
    {isFetching && <Badge color="blue">Refreshing</Badge>}
    {!isFetching && isStale && <Badge color="orange">Stale — refresh available</Badge>}
    <Text size="xs" c="dimmed">Generated {new Date(policy.generatedAt).toLocaleString("en-IN")} · {policy.timezone} · {policy.scope.kind}</Text>
  </Group>
  <Text size="xs" c="dimmed">{policy.lastReconciledAt ? `Last settlement reconciliation ${new Date(policy.lastReconciledAt).toLocaleString("en-IN")}` : "No successful settlement reconciliation in this scope yet"}</Text>
  {policy.payrollCostVisibility === "suppressed" && <Text size="xs" c="dimmed">Payroll employer cost and derived operating result are restricted. Payroll values are available only with explicit payroll access.</Text>}
</Stack>;

const LoadState = ({ loading, error, retry, label }: { loading: boolean; error: boolean; retry: () => void; label: string }) => {
  if (loading) return <Group><Loader size="sm" /><Text>Loading {label}…</Text></Group>;
  if (error) return <Alert color="red" title={`${label} unavailable`}>The report could not be loaded. <Button ml="sm" size="compact-xs" variant="light" leftSection={<RefreshCw size={13} />} onClick={retry}>Retry</Button></Alert>;
  return null;
};

const AmountLink = ({ value, label, onClick }: { value: string; label: string; onClick: () => void }) => <UnstyledButton onClick={onClick} aria-label={`View transactions for ${label}`} className="tabular-nums font-semibold text-primary hover:underline">{amount(value)}</UnstyledButton>;
const ProtectedAmount = ({ value, label, onClick }: { value: string | null; label: string; onClick: () => void }) => value === null
  ? <Text size="sm" c="dimmed" fw={600}>Restricted</Text>
  : <AmountLink value={value} label={label} onClick={onClick} />;

const KPI_FILTERS: Record<string, FinanceDrillDown> = {
  recognizedRevenuePaise: { tab: "ledger", filters: { accountTypes: ["revenue", "contra_revenue"] } },
  collectionsPaise: { tab: "ledger", filters: { eventType: "payment_attempt.captured" } },
  refundsPaise: { tab: "ledger", filters: { accountCodes: ["4110"] } },
  cogsPaise: { tab: "ledger", filters: { accountCodes: ["5000"] } },
  grossProfitPaise: { tab: "ledger", filters: { accountCodes: ["4000", "4010", "4100", "4110", "5000"] } },
  operatingExpensesPaise: { tab: "ledger", filters: { accountTypes: ["expense"], excludeAccountCodes: ["5000", "6200"] } },
  payrollCostPaise: { tab: "ledger", filters: { accountCodes: ["6200"] } },
  operatingResultPaise: { tab: "ledger", filters: { accountTypes: ["revenue", "contra_revenue", "expense"] } },
  unsettledRazorpayPaise: { tab: "ledger", filters: { accountCodes: ["1100"] } },
  cashVariancePaise: { tab: "ledger", filters: { accountCodes: ["6100"] } },
  openReconciliationIssues: { tab: "issues" },
};

const KPI_CARDS: Array<{ key: keyof FinanceReportTotals | "openReconciliationIssues"; label: string }> = [
  { key: "recognizedRevenuePaise", label: "Recognized revenue" }, { key: "collectionsPaise", label: "Collections" },
  { key: "refundsPaise", label: "Refunds" }, { key: "cogsPaise", label: "Cost of goods sold" },
  { key: "grossProfitPaise", label: "Gross profit" }, { key: "operatingExpensesPaise", label: "Operating expenses" },
  { key: "payrollCostPaise", label: "Payroll cost" }, { key: "operatingResultPaise", label: "Operating result" },
  { key: "unsettledRazorpayPaise", label: "Unsettled Razorpay" }, { key: "cashVariancePaise", label: "Cash variance" },
  { key: "openReconciliationIssues", label: "Open reconciliation issues" },
];

export const FinanceOverviewPanel = (props: ReportProps) => {
  const query = useFinanceOverview(props.storeId, props.from, props.to);
  const state = <LoadState loading={query.isLoading} error={query.isError} retry={() => void query.refetch()} label="finance overview" />;
  if (!query.data) return state;
  const report = query.data;
  const noActivity = [report.kpis.recognizedRevenuePaise, report.kpis.collectionsPaise, report.kpis.refundsPaise, report.kpis.cogsPaise, report.kpis.operatingExpensesPaise].every(isZero);
  return <Stack gap="md">
    <ReportStatus policy={report.policy} isFetching={query.isFetching} isStale={query.isStale} partial={Boolean(report.kpis.openReconciliationIssues)} />
    {noActivity && <Alert color="gray" title="Zero activity">No recognized financial activity exists for this period. Each metric still opens its filtered transaction view.</Alert>}
    <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }}>{KPI_CARDS.map(({ key, label }) => {
      const value = report.kpis[key];
      const prior = report.comparison.kpis[key];
      const restricted = value === null;
      const display = key === "openReconciliationIssues" ? String(value ?? "Not historical") : restricted ? "Restricted" : amount(String(value));
      return <Card key={key} withBorder h="100%"><Group justify="space-between" align="start"><div><Text size="xs" c="dimmed"><MetricLabel metric={key as DefinedMetric} label={label} /></Text>{restricted ? <Text fw={800} size="lg" c="dimmed">{display}</Text> : <UnstyledButton onClick={() => props.onDrillDown(KPI_FILTERS[key])} aria-label={`Drill down current ${label}`}><Text fw={800} size="lg" className="tabular-nums text-primary hover:underline">{display}</Text></UnstyledButton>}</div>{!restricted && <ArrowRight size={16} />}</Group>{key === "openReconciliationIssues" ? <Text size="xs" c="dimmed">Previous: not historical</Text> : restricted || prior === null ? <Text size="xs" c="dimmed">Previous: restricted</Text> : <UnstyledButton onClick={() => props.onDrillDown(dateTarget(KPI_FILTERS[key], report.comparisonPeriod))} aria-label={`Drill down previous ${label}`}><Text size="xs" c="dimmed" className="hover:underline">Previous: {amount(String(prior))}</Text></UnstyledButton>}</Card>;
    })}</SimpleGrid>
    <Text size="xs" c="dimmed">Accounting truth: posted and reversed journals · recognition basis: delivery · comparison {report.comparisonPeriod.from} to {report.comparisonPeriod.to}</Text>
  </Stack>;
};

export const FinanceProfitAndLossPanel = (props: ReportProps) => {
  const query = useFinanceProfitAndLoss(props.storeId, props.from, props.to, props.groupBy);
  const state = <LoadState loading={query.isLoading} error={query.isError} retry={() => void query.refetch()} label="profit and loss" />;
  if (!query.data) return state;
  const report = query.data;
  const rows = [
    ["Recognized revenue", "recognizedRevenuePaise"], ["Cost of goods sold", "cogsPaise"], ["Gross profit", "grossProfitPaise"],
    ["Operating expenses", "operatingExpensesPaise"], ["Payroll cost", "payrollCostPaise"], ["Operating result", "operatingResultPaise"],
  ] as const;
  return <Stack gap="md"><ReportStatus policy={report.policy} isFetching={query.isFetching} isStale={query.isStale} />
    <Card withBorder><Text fw={700}>Income statement</Text><Table mt="sm" withTableBorder><Table.Thead><Table.Tr><Table.Th>Line</Table.Th><Table.Th>Current</Table.Th><Table.Th>Previous period</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{rows.map(([label, key]) => <Table.Tr key={key}><Table.Td><MetricLabel metric={key} label={label} /></Table.Td><Table.Td><ProtectedAmount label={label} value={report.totals[key]} onClick={() => props.onDrillDown(KPI_FILTERS[key])} /></Table.Td><Table.Td><ProtectedAmount label={`previous ${label}`} value={report.comparison.totals[key]} onClick={() => props.onDrillDown(dateTarget(KPI_FILTERS[key], report.comparisonPeriod))} /></Table.Td></Table.Tr>)}</Table.Tbody></Table></Card>
    {!report.operatingExpenseLines.length ? <EmptyState title="No operating expenses" description="No posted operating-expense journals exist in this period." /> : <Card withBorder><Text fw={700}>Operating expense accounts</Text><Table mt="sm"><Table.Tbody>{report.operatingExpenseLines.map((line) => <Table.Tr key={line.accountCode}><Table.Td>{line.accountCode} · {line.accountName}</Table.Td><Table.Td><AmountLink label={line.accountName} value={line.amountPaise} onClick={() => props.onDrillDown({ tab: "ledger", filters: { accountCodes: [line.accountCode] } })} /></Table.Td></Table.Tr>)}</Table.Tbody></Table></Card>}
    <Card withBorder><Text fw={700}>Period trend</Text>{!report.periods.length ? <Text size="sm" c="dimmed" mt="sm">No period rows.</Text> : <Table mt="sm"><Table.Thead><Table.Tr><Table.Th>Period</Table.Th><Table.Th>Revenue</Table.Th><Table.Th>COGS</Table.Th><Table.Th>Gross profit</Table.Th><Table.Th>Operating result</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{report.periods.map((row) => <Table.Tr key={row.period}><Table.Td>{row.period}</Table.Td><Table.Td><AmountLink label={`${row.period} revenue`} value={row.recognizedRevenuePaise} onClick={() => props.onDrillDown(periodTarget(KPI_FILTERS.recognizedRevenuePaise, row.period, props.groupBy))} /></Table.Td><Table.Td><AmountLink label={`${row.period} COGS`} value={row.cogsPaise} onClick={() => props.onDrillDown(periodTarget(KPI_FILTERS.cogsPaise, row.period, props.groupBy))} /></Table.Td><Table.Td><AmountLink label={`${row.period} gross profit`} value={row.grossProfitPaise} onClick={() => props.onDrillDown(periodTarget(KPI_FILTERS.grossProfitPaise, row.period, props.groupBy))} /></Table.Td><Table.Td><ProtectedAmount label={`${row.period} operating result`} value={row.operatingResultPaise} onClick={() => props.onDrillDown(periodTarget(KPI_FILTERS.operatingResultPaise, row.period, props.groupBy))} /></Table.Td></Table.Tr>)}</Table.Tbody></Table>}</Card>
  </Stack>;
};

export const FinanceSalesMarginsPanel = (props: ReportProps) => {
  const sales = useFinanceSales(props.storeId, props.from, props.to, props.groupBy);
  const margins = useFinanceMargins(props.storeId, props.from, props.to, props.groupBy);
  const state = <LoadState loading={sales.isLoading || margins.isLoading} error={sales.isError || margins.isError} retry={() => { void sales.refetch(); void margins.refetch(); }} label="sales and margins" />;
  if (!sales.data || !margins.data) return state;
  return <Stack gap="md"><ReportStatus policy={sales.data.policy} isFetching={sales.isFetching || margins.isFetching} isStale={sales.isStale || margins.isStale} />
    {!sales.data.series.length ? <EmptyState title="No recognized sales" description="Cancelled, failed, and unpaid orders do not appear as revenue." /> : <Card withBorder><Text fw={700}>Recognized sales</Text><Table mt="sm" withTableBorder><Table.Thead><Table.Tr><Table.Th>Period</Table.Th><Table.Th>Food</Table.Th><Table.Th>Delivery</Table.Th><Table.Th>Discounts</Table.Th><Table.Th><MetricLabel metric="refundsPaise" label="Refunds" /></Table.Th><Table.Th><MetricLabel metric="recognizedRevenuePaise" label="Net recognized" /></Table.Th></Table.Tr></Table.Thead><Table.Tbody>{sales.data.series.map((row) => <Table.Tr key={row.period}><Table.Td>{row.period}</Table.Td><Table.Td><AmountLink label={`${row.period} food sales`} value={row.salesRevenuePaise} onClick={() => props.onDrillDown(periodTarget({ tab: "ledger", filters: { accountCodes: ["4000"] } }, row.period, props.groupBy))} /></Table.Td><Table.Td><AmountLink label={`${row.period} delivery sales`} value={row.deliveryRevenuePaise} onClick={() => props.onDrillDown(periodTarget({ tab: "ledger", filters: { accountCodes: ["4010"] } }, row.period, props.groupBy))} /></Table.Td><Table.Td><AmountLink label={`${row.period} discounts`} value={row.discountsPaise} onClick={() => props.onDrillDown(periodTarget({ tab: "ledger", filters: { accountCodes: ["4100"] } }, row.period, props.groupBy))} /></Table.Td><Table.Td><AmountLink label={`${row.period} refunds`} value={row.refundsPaise} onClick={() => props.onDrillDown(periodTarget(KPI_FILTERS.refundsPaise, row.period, props.groupBy))} /></Table.Td><Table.Td><AmountLink label={`${row.period} recognized revenue`} value={row.recognizedRevenuePaise} onClick={() => props.onDrillDown(periodTarget(KPI_FILTERS.recognizedRevenuePaise, row.period, props.groupBy))} /></Table.Td></Table.Tr>)}</Table.Tbody></Table></Card>}
    <Card withBorder><Group justify="space-between"><div><Text fw={700}>Gross margin</Text><Text size="sm" c="dimmed">Revenue less snapshotted COGS; refund does not imply inventory return.</Text></div><UnstyledButton onClick={() => props.onDrillDown(KPI_FILTERS.grossProfitPaise)} aria-label="Drill down gross margin"><Badge color={margins.data.totals.grossMarginBps === null ? "gray" : "blue"}>{margin(margins.data.totals.grossMarginBps)}</Badge></UnstyledButton></Group>{!margins.data.series.length ? <Text size="sm" c="dimmed" mt="sm">Margin is unavailable without recognized revenue.</Text> : <Table mt="sm"><Table.Thead><Table.Tr><Table.Th>Period</Table.Th><Table.Th>Revenue</Table.Th><Table.Th>COGS</Table.Th><Table.Th>Gross profit</Table.Th><Table.Th>Margin</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{margins.data.series.map((row) => <Table.Tr key={row.period}><Table.Td>{row.period}</Table.Td><Table.Td><AmountLink label={`${row.period} margin revenue`} value={row.recognizedRevenuePaise} onClick={() => props.onDrillDown(periodTarget(KPI_FILTERS.recognizedRevenuePaise, row.period, props.groupBy))} /></Table.Td><Table.Td><AmountLink label={`${row.period} margin COGS`} value={row.cogsPaise} onClick={() => props.onDrillDown(periodTarget(KPI_FILTERS.cogsPaise, row.period, props.groupBy))} /></Table.Td><Table.Td><AmountLink label={`${row.period} gross profit`} value={row.grossProfitPaise} onClick={() => props.onDrillDown(periodTarget(KPI_FILTERS.grossProfitPaise, row.period, props.groupBy))} /></Table.Td><Table.Td><UnstyledButton onClick={() => props.onDrillDown(periodTarget(KPI_FILTERS.grossProfitPaise, row.period, props.groupBy))} aria-label={`Drill down ${row.period} margin`} className="font-semibold text-primary hover:underline">{margin(row.grossMarginBps)}</UnstyledButton></Table.Td></Table.Tr>)}</Table.Tbody></Table>}</Card>
  </Stack>;
};

export const PaymentsSummary = ({ storeId, from, to, onDrillDown }: Omit<ReportProps, "groupBy">) => {
  const query = useFinanceOverview(storeId, from, to);
  if (query.isLoading) return <Loader size="sm" aria-label="Loading payment summary" />;
  if (query.isError || !query.data) return <Alert color="red">Payment summary unavailable. Refund workflow remains available below.</Alert>;
  return <SimpleGrid cols={{ base: 1, sm: 3 }}><Card withBorder><Text size="xs" c="dimmed"><MetricLabel metric="collectionsPaise" label="Collections" /></Text><AmountLink label="collections" value={query.data.kpis.collectionsPaise} onClick={() => onDrillDown(KPI_FILTERS.collectionsPaise)} /></Card><Card withBorder><Text size="xs" c="dimmed"><MetricLabel metric="refundsPaise" label="Refund contra revenue" /></Text><AmountLink label="refunds" value={query.data.kpis.refundsPaise} onClick={() => onDrillDown(KPI_FILTERS.refundsPaise)} /></Card><Card withBorder><Text size="xs" c="dimmed"><MetricLabel metric="unsettledRazorpayPaise" label="Unsettled Razorpay" /></Text><AmountLink label="unsettled Razorpay" value={query.data.kpis.unsettledRazorpayPaise} onClick={() => onDrillDown(KPI_FILTERS.unsettledRazorpayPaise)} /></Card></SimpleGrid>;
};
