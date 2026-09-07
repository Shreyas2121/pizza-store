import type {
  FinanceMarginsDto,
  FinanceOverviewDto,
  FinanceProfitAndLossDto,
  FinanceSalesDto,
} from "./finance-report.schemas";

export const FINANCE_EXPORT_TYPES = ["overview", "profit-and-loss", "sales", "margins"] as const;
export type FinanceExportType = (typeof FINANCE_EXPORT_TYPES)[number];

type FinanceExport =
  | { reportType: "overview"; report: FinanceOverviewDto }
  | { reportType: "profit-and-loss"; report: FinanceProfitAndLossDto }
  | { reportType: "sales"; report: FinanceSalesDto }
  | { reportType: "margins"; report: FinanceMarginsDto };

const HEADINGS = [
  "report_type", "scope_kind", "store_ids", "period_from", "period_to",
  "comparison_from", "comparison_to", "timezone", "currency", "date_basis",
  "recognition_basis", "included_journal_statuses", "generated_at", "last_reconciled_at",
  "payroll_cost_visibility", "amount_unit", "group_by", "row_type", "row_key", "account_code",
  "account_name", "metric", "value",
] as const;

const TOTAL_METRICS = [
  "salesRevenuePaise", "deliveryRevenuePaise", "discountsPaise", "refundsPaise",
  "recognizedRevenuePaise", "collectionsPaise", "cogsPaise", "grossProfitPaise",
  "grossMarginBps", "operatingExpensesPaise", "payrollCostPaise",
  "operatingResultPaise", "unsettledRazorpayPaise", "cashVariancePaise",
] as const;

const OVERVIEW_METRICS = [...TOTAL_METRICS, "openReconciliationIssues"] as const;
const SALES_METRICS = ["salesRevenuePaise", "deliveryRevenuePaise", "discountsPaise", "refundsPaise", "recognizedRevenuePaise"] as const;
const MARGIN_METRICS = ["recognizedRevenuePaise", "cogsPaise", "grossProfitPaise", "grossMarginBps"] as const;
const PROFIT_AND_LOSS_METRICS = [...MARGIN_METRICS, "operatingExpensesPaise", "payrollCostPaise", "operatingResultPaise"] as const;

const formulaPrefix = /^[\s]*[=+\-@\t\r]/;

export const escapeCsvField = (value: unknown) => {
  const raw = value === null || value === undefined ? "" : String(value);
  const safe = formulaPrefix.test(raw) ? `'${raw}` : raw;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
};

const unitFor = (metric: string) => metric.endsWith("Paise")
  ? "paise"
  : metric.endsWith("Bps")
    ? "basis_points"
    : "count";

export const buildFinanceReportCsv = (input: FinanceExport) => {
  const report = input.report;
  const common = [
    input.reportType,
    report.policy.scope.kind,
    report.policy.scope.storeIds.join("|"),
    report.period.from,
    report.period.to,
    report.comparisonPeriod.from,
    report.comparisonPeriod.to,
    report.policy.timezone,
    report.policy.currency,
    report.policy.dateBasis,
    report.policy.recognitionBasis,
    report.policy.includedJournalStatuses.join("|"),
    report.policy.generatedAt,
    report.policy.lastReconciledAt,
    report.policy.payrollCostVisibility,
  ];
  const rows: unknown[][] = [];
  const appendMetrics = (
    rowType: string,
    rowKey: string,
    values: Record<string, unknown>,
    metrics: readonly string[],
    groupBy = "",
    accountCode = "",
    accountName = "",
  ) => {
    for (const metric of metrics) {
      rows.push([...common, unitFor(metric), groupBy, rowType, rowKey, accountCode, accountName, metric, values[metric]]);
    }
  };

  if (input.reportType === "overview") {
    appendMetrics("current_total", "current", input.report.kpis, OVERVIEW_METRICS);
    appendMetrics("comparison_total", "comparison", input.report.comparison.kpis, OVERVIEW_METRICS);
  } else if (input.reportType === "sales") {
    appendMetrics("current_total", "current", input.report.totals, TOTAL_METRICS, input.report.groupBy);
    appendMetrics("comparison_total", "comparison", input.report.comparison.totals, TOTAL_METRICS, input.report.groupBy);
    for (const point of input.report.series) appendMetrics("current_period", point.period, point, SALES_METRICS, input.report.groupBy);
    for (const point of input.report.comparison.series) appendMetrics("comparison_period", point.period, point, SALES_METRICS, input.report.groupBy);
  } else if (input.reportType === "margins") {
    appendMetrics("current_total", "current", input.report.totals, TOTAL_METRICS, input.report.groupBy);
    appendMetrics("comparison_total", "comparison", input.report.comparison.totals, TOTAL_METRICS, input.report.groupBy);
    for (const point of input.report.series) appendMetrics("current_period", point.period, point, MARGIN_METRICS, input.report.groupBy);
    for (const point of input.report.comparison.series) appendMetrics("comparison_period", point.period, point, MARGIN_METRICS, input.report.groupBy);
  } else {
    appendMetrics("current_total", "current", input.report.totals, TOTAL_METRICS, input.report.groupBy);
    appendMetrics("comparison_total", "comparison", input.report.comparison.totals, TOTAL_METRICS, input.report.groupBy);
    for (const point of input.report.periods) appendMetrics("current_period", point.period, point, PROFIT_AND_LOSS_METRICS, input.report.groupBy);
    for (const point of input.report.comparison.periods) appendMetrics("comparison_period", point.period, point, PROFIT_AND_LOSS_METRICS, input.report.groupBy);
    for (const line of input.report.operatingExpenseLines) appendMetrics("current_expense_account", line.accountCode, line, ["amountPaise"], input.report.groupBy, line.accountCode, line.accountName);
    for (const line of input.report.comparison.operatingExpenseLines) appendMetrics("comparison_expense_account", line.accountCode, line, ["amountPaise"], input.report.groupBy, line.accountCode, line.accountName);
  }

  return [HEADINGS, ...rows].map((row) => row.map((value, index) =>
    index === HEADINGS.indexOf("value") && /^-?\d+$/.test(String(value))
      ? String(value)
      : escapeCsvField(value)
  ).join(",")).join("\r\n") + "\r\n";
};

export const financeExportFilename = (reportType: FinanceExportType, report: FinanceExport["report"]) => {
  const scope = report.policy.scope.kind === "consolidated" ? "consolidated" : `store-${report.policy.scope.storeIds[0]}`;
  return `finance-${reportType}-${scope}-${report.period.from}-${report.period.to}.csv`;
};
