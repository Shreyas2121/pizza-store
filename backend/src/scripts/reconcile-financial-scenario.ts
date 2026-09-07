import type { AuthPrincipal } from "../features/auth/auth.types";
import { FinanceReportService } from "../features/finance-reports/finance-report.service";
import type { ReportTotalsDto } from "../features/finance-reports/finance-report.schemas";
import {
  FIXTURE_REPORT_MOVEMENTS,
  fixtureCollections,
  fixtureUnsettledRazorpay,
} from "../fixtures/financial-scenario-report.fixtures";
import {
  EXPECTED_LEDGER_REPORT_CONSOLIDATED_TWO_MONTH_TOTAL,
  EXPECTED_LEDGER_REPORT_STORE_MONTH_SUMMARIES,
  FIXTURE_SETTLEMENTS,
  type FixtureLedgerReportSummary,
} from "../fixtures/financial-scenario.fixtures";

const actor: AuthPrincipal = { userId: 1, email: "fixture-owner@pizzastore.test", platformRole: "admin", tokenVersion: 0 };
const period = { from: "2026-07-01", to: "2026-08-31", groupBy: "month" as const };
const generatedAt = new Date("2026-09-01T06:00:00.000Z");

const totalKeys = [
  "salesRevenuePaise", "deliveryRevenuePaise", "discountsPaise", "refundsPaise",
  "recognizedRevenuePaise", "collectionsPaise", "cogsPaise", "grossProfitPaise",
  "grossMarginBps", "operatingExpensesPaise", "payrollCostPaise", "operatingResultPaise",
  "unsettledRazorpayPaise", "cashVariancePaise",
] as const;

type ExpectedTotals = Record<(typeof totalKeys)[number], number> & { openReconciliationIssues: number };

const expectedForStore = (storeId: number): ExpectedTotals => {
  const summaries = Object.values(EXPECTED_LEDGER_REPORT_STORE_MONTH_SUMMARIES).filter((summary) => summary.storeId === storeId);
  const sum = (key: keyof FixtureLedgerReportSummary) => summaries.reduce((total, summary) => total + Number(summary[key]), 0);
  const recognizedRevenuePaise = sum("recognizedRevenuePaise");
  const grossProfitPaise = sum("grossProfitPaise");
  return {
    salesRevenuePaise: sum("salesRevenuePaise"),
    deliveryRevenuePaise: sum("deliveryRevenuePaise"),
    discountsPaise: sum("discountsPaise"),
    refundsPaise: sum("refundsPaise"),
    recognizedRevenuePaise,
    collectionsPaise: sum("collectionsPaise"),
    cogsPaise: sum("cogsPaise"),
    grossProfitPaise,
    grossMarginBps: Math.trunc(grossProfitPaise * 10_000 / recognizedRevenuePaise),
    operatingExpensesPaise: sum("operatingExpensesPaise"),
    payrollCostPaise: sum("payrollCostPaise"),
    operatingResultPaise: sum("operatingResultPaise"),
    unsettledRazorpayPaise: summaries.find((summary) => summary.month === "2026-08")!.unsettledRazorpayPaise,
    cashVariancePaise: sum("cashVariancePaise"),
    openReconciliationIssues: 0,
  };
};

const consolidatedExpected: ExpectedTotals = EXPECTED_LEDGER_REPORT_CONSOLIDATED_TWO_MONTH_TOTAL;

const repository = {
  stores: async (storeId?: number) => [1, 2].filter((id) => storeId === undefined || id === storeId).map((id) => ({ id, timezone: "Asia/Kolkata" })),
  movements: async (storeIds: number[], from: string, to: string) => FIXTURE_REPORT_MOVEMENTS.filter((row) => storeIds.includes(row.storeId) && row.businessDate >= from && row.businessDate <= to).map(({ storeId: _storeId, ...row }) => row),
  collectionTotal: async (storeIds: number[], from: string, to: string) => fixtureCollections(storeIds, from, to),
  unsettledRazorpay: async (storeIds: number[], asOf: string) => fixtureUnsettledRazorpay(storeIds, asOf),
  openReconciliationIssues: async () => 0,
  lastReconciledAt: async (storeIds: number[]) => {
    const times = FIXTURE_SETTLEMENTS.filter((settlement) => storeIds.includes(settlement.storeId)).map((settlement) => new Date(settlement.settledAt));
    return times.length ? new Date(Math.max(...times.map((time) => time.getTime()))) : null;
  },
};

const assertEqual = (actual: unknown, expected: unknown, label: string) => {
  if (String(actual) !== String(expected)) throw new Error(`${label}: expected ${expected}, received ${actual}`);
};

const assertTotals = (actual: ReportTotalsDto, expected: ExpectedTotals, label: string) => {
  for (const key of totalKeys) assertEqual(actual[key], expected[key], `${label}.${key}`);
};

const csvCurrentTotals = (body: string) => {
  const [headings, ...rows] = body.split("\r\n").filter(Boolean).map((line) => line.split(","));
  const column = (name: string) => headings.indexOf(name);
  return Object.fromEntries(rows
    .filter((row) => row[column("row_type")] === "current_total")
    .map((row) => [row[column("metric")], row[column("value")]]));
};

export async function reconcileFinancialScenarioReports() {
  const service = new FinanceReportService(repository as never);
  let checkedReports = 0;
  let checkedCsvExports = 0;
  for (const storeId of [1, 2, undefined] as const) {
    const query = { ...period, storeId };
    const expected = storeId === undefined ? consolidatedExpected : expectedForStore(storeId);
    const [overview, profitAndLoss, sales, margins] = await Promise.all([
      service.overview(actor, query, generatedAt),
      service.profitAndLoss(actor, query, generatedAt),
      service.sales(actor, query, generatedAt),
      service.margins(actor, query, generatedAt),
    ]);
    const scope = storeId === undefined ? "consolidated" : `store-${storeId}`;
    assertTotals(overview.kpis, expected, `${scope}.overview`);
    assertEqual(overview.kpis.openReconciliationIssues, expected.openReconciliationIssues, `${scope}.overview.openReconciliationIssues`);
    assertTotals(profitAndLoss.totals, expected, `${scope}.profitAndLoss`);
    assertTotals(sales.totals, expected, `${scope}.sales`);
    assertTotals(margins.totals, expected, `${scope}.margins`);

    const expectedPeriods = Object.values(EXPECTED_LEDGER_REPORT_STORE_MONTH_SUMMARIES)
      .filter((summary) => storeId === undefined || summary.storeId === storeId);
    for (const month of ["2026-07", "2026-08"]) {
      const summaries = expectedPeriods.filter((summary) => summary.month === month);
      const expectedRevenue = summaries.reduce((sum, summary) => sum + summary.recognizedRevenuePaise, 0);
      const expectedCogs = summaries.reduce((sum, summary) => sum + summary.cogsPaise, 0);
      const expectedGrossProfit = summaries.reduce((sum, summary) => sum + summary.grossProfitPaise, 0);
      const expectedOperatingResult = summaries.reduce((sum, summary) => sum + summary.operatingResultPaise, 0);
      assertEqual(sales.series.find((row) => row.period === month)?.recognizedRevenuePaise, expectedRevenue, `${scope}.sales.${month}.recognizedRevenuePaise`);
      assertEqual(margins.series.find((row) => row.period === month)?.cogsPaise, expectedCogs, `${scope}.margins.${month}.cogsPaise`);
      assertEqual(margins.series.find((row) => row.period === month)?.grossProfitPaise, expectedGrossProfit, `${scope}.margins.${month}.grossProfitPaise`);
      assertEqual(profitAndLoss.periods.find((row) => row.period === month)?.operatingResultPaise, expectedOperatingResult, `${scope}.profitAndLoss.${month}.operatingResultPaise`);
    }
    checkedReports += 4;

    for (const reportType of ["overview", "profit-and-loss", "sales", "margins"] as const) {
      const exported = await service.exportCsv(actor, reportType, query, generatedAt);
      const totals = csvCurrentTotals(exported.body);
      for (const key of totalKeys) assertEqual(totals[key], expected[key], `${scope}.${reportType}.csv.${key}`);
      if (reportType === "overview") assertEqual(totals.openReconciliationIssues, 0, `${scope}.overview.csv.openReconciliationIssues`);
      checkedCsvExports += 1;
    }
  }
  return { checkedReports, checkedCsvExports, storeMonths: 4, expectedSource: "financial-scenario.fixtures.ts" as const };
}

if (require.main === module) {
  reconcileFinancialScenarioReports()
    .then((result) => console.log(`Finance fixture reconciliation passed: ${result.checkedReports} reports, ${result.checkedCsvExports} CSV exports, ${result.storeMonths} store-months; source ${result.expectedSource}.`))
    .catch((cause) => {
      console.error(cause instanceof Error ? cause.message : "Finance fixture reconciliation failed.");
      process.exitCode = 1;
    });
}
