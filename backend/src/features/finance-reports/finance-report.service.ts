import type { AuthPrincipal } from "../auth/auth.types";
import authorizationService, { resourceNotFound } from "../access/access.service";
import type { Permission } from "../access/access.permissions";
import { buildFinanceReportCsv, financeExportFilename, type FinanceExportType } from "./finance-report.csv";
import financeReportRepository, { FinanceReportRepository } from "./finance-report.repository";
import { comparisonPeriodFor, groupFinanceReport, projectFinanceReport, type FinanceMovement } from "./finance-report.policy";
import {
  marginsResponseSchema,
  overviewResponseSchema,
  profitAndLossResponseSchema,
  salesResponseSchema,
  type FinanceReportQuery,
  type GroupedFinanceReportQuery,
} from "./finance-report.schemas";
import { financeMetrics, type FinanceReportType } from "../observability/finance-metrics";

type Period = { from: string; to: string };
type Scope = { kind: "store" | "consolidated"; storeIds: number[]; timezone: string; canReadPayrollCost: boolean };

type PayrollDerivedValues = { payrollCostPaise: string | null; operatingResultPaise: string | null };

const applyPayrollPrivacy = <T extends PayrollDerivedValues>(value: T, canReadPayrollCost: boolean): T => canReadPayrollCost
  ? value
  : { ...value, payrollCostPaise: null, operatingResultPaise: null };

const salesSeries = (rows: FinanceMovement[], groupBy: GroupedFinanceReportQuery["groupBy"]) => groupFinanceReport(rows, groupBy).map((row) => ({
  period: row.period,
  salesRevenuePaise: row.salesRevenuePaise,
  deliveryRevenuePaise: row.deliveryRevenuePaise,
  discountsPaise: row.discountsPaise,
  refundsPaise: row.refundsPaise,
  recognizedRevenuePaise: row.recognizedRevenuePaise,
}));

const marginSeries = (rows: FinanceMovement[], groupBy: GroupedFinanceReportQuery["groupBy"]) => groupFinanceReport(rows, groupBy).map((row) => ({
  period: row.period,
  recognizedRevenuePaise: row.recognizedRevenuePaise,
  cogsPaise: row.cogsPaise,
  grossProfitPaise: row.grossProfitPaise,
  grossMarginBps: row.grossMarginBps,
}));

const profitAndLossSeries = (rows: FinanceMovement[], groupBy: GroupedFinanceReportQuery["groupBy"], canReadPayrollCost: boolean) => groupFinanceReport(rows, groupBy).map((row) => applyPayrollPrivacy({
  period: row.period,
  recognizedRevenuePaise: row.recognizedRevenuePaise,
  cogsPaise: row.cogsPaise,
  grossProfitPaise: row.grossProfitPaise,
  grossMarginBps: row.grossMarginBps,
  operatingExpensesPaise: row.operatingExpensesPaise,
  payrollCostPaise: row.payrollCostPaise,
  operatingResultPaise: row.operatingResultPaise,
}, canReadPayrollCost));

export class FinanceReportService {
  constructor(private readonly repository: FinanceReportRepository = financeReportRepository) {}

  async overview(actor: AuthPrincipal, query: FinanceReportQuery, now = new Date()) {
    const scope = await this.resolveScope(actor, query.storeId, "finance.overview.read");
    const period = { from: query.from, to: query.to };
    const comparisonPeriod = comparisonPeriodFor(query.from, query.to);
    const [current, comparison, issues, lastReconciledAt] = await Promise.all([
      this.load(scope, period), this.load(scope, comparisonPeriod), this.repository.openReconciliationIssues(scope.storeIds),
      this.repository.lastReconciledAt(scope.storeIds),
    ]);
    return overviewResponseSchema.parse({
      policy: this.policy("overview", scope, now, lastReconciledAt), period, comparisonPeriod,
      kpis: { ...applyPayrollPrivacy(current.totals, scope.canReadPayrollCost), openReconciliationIssues: issues },
      comparison: { period: comparisonPeriod, kpis: { ...applyPayrollPrivacy(comparison.totals, scope.canReadPayrollCost), openReconciliationIssues: null } },
      drillDownUrls: this.drillDownUrls(query, scope.canReadPayrollCost),
    });
  }

  async profitAndLoss(actor: AuthPrincipal, query: GroupedFinanceReportQuery, now = new Date()) {
    const scope = await this.resolveScope(actor, query.storeId, "finance.overview.read");
    const period = { from: query.from, to: query.to };
    const comparisonPeriod = comparisonPeriodFor(query.from, query.to);
    const [current, comparison, lastReconciledAt] = await Promise.all([this.load(scope, period), this.load(scope, comparisonPeriod), this.repository.lastReconciledAt(scope.storeIds)]);
    return profitAndLossResponseSchema.parse({
      policy: this.policy("profit_and_loss", scope, now, lastReconciledAt), period, comparisonPeriod, groupBy: query.groupBy,
      totals: applyPayrollPrivacy(current.totals, scope.canReadPayrollCost), operatingExpenseLines: current.operatingExpenseLines, periods: profitAndLossSeries(current.rows, query.groupBy, scope.canReadPayrollCost),
      comparison: { totals: applyPayrollPrivacy(comparison.totals, scope.canReadPayrollCost), operatingExpenseLines: comparison.operatingExpenseLines, periods: profitAndLossSeries(comparison.rows, query.groupBy, scope.canReadPayrollCost) },
    });
  }

  async sales(actor: AuthPrincipal, query: GroupedFinanceReportQuery, now = new Date()) {
    const scope = await this.resolveScope(actor, query.storeId, "finance.sales.read");
    const period = { from: query.from, to: query.to };
    const comparisonPeriod = comparisonPeriodFor(query.from, query.to);
    const [current, comparison, lastReconciledAt] = await Promise.all([this.load(scope, period), this.load(scope, comparisonPeriod), this.repository.lastReconciledAt(scope.storeIds)]);
    return salesResponseSchema.parse({
      policy: this.policy("sales", scope, now, lastReconciledAt), period, comparisonPeriod, groupBy: query.groupBy, totals: applyPayrollPrivacy(current.totals, scope.canReadPayrollCost),
      series: salesSeries(current.rows, query.groupBy), comparison: { totals: applyPayrollPrivacy(comparison.totals, scope.canReadPayrollCost), series: salesSeries(comparison.rows, query.groupBy) },
    });
  }

  async margins(actor: AuthPrincipal, query: GroupedFinanceReportQuery, now = new Date()) {
    const scope = await this.resolveScope(actor, query.storeId, "finance.sales.read");
    const period = { from: query.from, to: query.to };
    const comparisonPeriod = comparisonPeriodFor(query.from, query.to);
    const [current, comparison, lastReconciledAt] = await Promise.all([this.load(scope, period), this.load(scope, comparisonPeriod), this.repository.lastReconciledAt(scope.storeIds)]);
    return marginsResponseSchema.parse({
      policy: this.policy("margins", scope, now, lastReconciledAt), period, comparisonPeriod, groupBy: query.groupBy, totals: applyPayrollPrivacy(current.totals, scope.canReadPayrollCost),
      series: marginSeries(current.rows, query.groupBy), comparison: { totals: applyPayrollPrivacy(comparison.totals, scope.canReadPayrollCost), series: marginSeries(comparison.rows, query.groupBy) },
    });
  }

  async exportCsv(actor: AuthPrincipal, reportType: FinanceExportType, query: GroupedFinanceReportQuery, now = new Date()) {
    const report = reportType === "overview"
      ? await this.overview(actor, query, now)
      : reportType === "profit-and-loss"
        ? await this.profitAndLoss(actor, query, now)
        : reportType === "sales"
          ? await this.sales(actor, query, now)
          : await this.margins(actor, query, now);
    return {
      body: buildFinanceReportCsv({ reportType, report } as Parameters<typeof buildFinanceReportCsv>[0]),
      filename: financeExportFilename(reportType, report),
    };
  }

  private async resolveScope(actor: AuthPrincipal, storeId: number | undefined, permission: Permission): Promise<Scope> {
    if (storeId === undefined) authorizationService.requirePlatformAdmin(actor);
    else await authorizationService.requireStorePermission({ principal: actor, storeId, permission });
    const canReadPayrollCost = storeId === undefined || actor.platformRole === "admin"
      ? true
      : await authorizationService.hasStorePermission(actor, storeId, "payroll.read");
    const stores = await this.repository.stores(storeId);
    if (storeId !== undefined && stores.length !== 1) throw resourceNotFound();
    const timezones = [...new Set(stores.map((store) => store.timezone))];
    return { kind: storeId === undefined ? "consolidated" : "store", storeIds: stores.map((store) => store.id), timezone: timezones.length <= 1 ? (timezones[0] ?? "Asia/Kolkata") : "multiple", canReadPayrollCost };
  }

  private async load(scope: Scope, period: Period) {
    const [rows, collectionsPaise, unsettledRazorpayPaise] = await Promise.all([
      this.repository.movements(scope.storeIds, period.from, period.to),
      this.repository.collectionTotal(scope.storeIds, period.from, period.to),
      this.repository.unsettledRazorpay(scope.storeIds, period.to),
    ]);
    return { rows, ...projectFinanceReport(rows, { collectionsPaise, unsettledRazorpayPaise }) };
  }

  private policy(reportType: FinanceReportType, scope: Scope, now: Date, lastReconciledAt: Date | null) {
    financeMetrics.setReportFreshness(reportType, scope.kind, lastReconciledAt ? (now.getTime() - lastReconciledAt.getTime()) / 1000 : null);
    return { currency: "INR" as const, timezone: scope.timezone, dateBasis: "journal_business_date" as const, recognitionBasis: "delivery" as const, includedJournalStatuses: ["posted", "reversed"] as const, generatedAt: now.toISOString(), lastReconciledAt: lastReconciledAt?.toISOString() ?? null, payrollCostVisibility: scope.canReadPayrollCost ? "detailed" as const : "suppressed" as const, scope: { kind: scope.kind, storeIds: scope.storeIds } };
  }

  private drillDownUrls(query: FinanceReportQuery, canReadPayrollCost: boolean) {
    const params = new URLSearchParams({ from: query.from, to: query.to });
    if (query.storeId !== undefined) params.set("storeId", String(query.storeId));
    const suffix = params.toString();
    return {
      revenue: `/api/v1/finance/sales?${suffix}`,
      cogs: `/api/v1/finance/margins?${suffix}`,
      expenses: `/api/v1/finance/expenses?${suffix}`,
      refunds: `/api/v1/finance/refunds?${suffix}`,
      ...(canReadPayrollCost ? { payroll: `/api/v1/finance/ledger/journals?${suffix}&accountCodes=6200` } : {}),
    };
  }
}

export default new FinanceReportService();
