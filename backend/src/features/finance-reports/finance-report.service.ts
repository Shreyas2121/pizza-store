import type { AuthPrincipal } from "../auth/auth.types";
import authorizationService, { resourceNotFound } from "../access/access.service";
import type { Permission } from "../access/access.permissions";
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

type Period = { from: string; to: string };
type Scope = { kind: "store" | "consolidated"; storeIds: number[]; timezone: string };

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

const profitAndLossSeries = (rows: FinanceMovement[], groupBy: GroupedFinanceReportQuery["groupBy"]) => groupFinanceReport(rows, groupBy).map((row) => ({
  period: row.period,
  recognizedRevenuePaise: row.recognizedRevenuePaise,
  cogsPaise: row.cogsPaise,
  grossProfitPaise: row.grossProfitPaise,
  grossMarginBps: row.grossMarginBps,
  operatingExpensesPaise: row.operatingExpensesPaise,
  payrollCostPaise: row.payrollCostPaise,
  operatingResultPaise: row.operatingResultPaise,
}));

export class FinanceReportService {
  constructor(private readonly repository: FinanceReportRepository = financeReportRepository) {}

  async overview(actor: AuthPrincipal, query: FinanceReportQuery, now = new Date()) {
    const scope = await this.resolveScope(actor, query.storeId, "finance.overview.read");
    const period = { from: query.from, to: query.to };
    const comparisonPeriod = comparisonPeriodFor(query.from, query.to);
    const [current, comparison, issues] = await Promise.all([
      this.load(scope, period), this.load(scope, comparisonPeriod), this.repository.openReconciliationIssues(scope.storeIds),
    ]);
    return overviewResponseSchema.parse({
      policy: this.policy(scope, now), period, comparisonPeriod,
      kpis: { ...current.totals, openReconciliationIssues: issues },
      comparison: { period: comparisonPeriod, kpis: { ...comparison.totals, openReconciliationIssues: null } },
      drillDownUrls: this.drillDownUrls(query),
    });
  }

  async profitAndLoss(actor: AuthPrincipal, query: GroupedFinanceReportQuery, now = new Date()) {
    const scope = await this.resolveScope(actor, query.storeId, "finance.overview.read");
    const period = { from: query.from, to: query.to };
    const comparisonPeriod = comparisonPeriodFor(query.from, query.to);
    const [current, comparison] = await Promise.all([this.load(scope, period), this.load(scope, comparisonPeriod)]);
    return profitAndLossResponseSchema.parse({
      policy: this.policy(scope, now), period, comparisonPeriod, groupBy: query.groupBy,
      totals: current.totals, operatingExpenseLines: current.operatingExpenseLines, periods: profitAndLossSeries(current.rows, query.groupBy),
      comparison: { totals: comparison.totals, operatingExpenseLines: comparison.operatingExpenseLines, periods: profitAndLossSeries(comparison.rows, query.groupBy) },
    });
  }

  async sales(actor: AuthPrincipal, query: GroupedFinanceReportQuery, now = new Date()) {
    const scope = await this.resolveScope(actor, query.storeId, "finance.sales.read");
    const period = { from: query.from, to: query.to };
    const comparisonPeriod = comparisonPeriodFor(query.from, query.to);
    const [current, comparison] = await Promise.all([this.load(scope, period), this.load(scope, comparisonPeriod)]);
    return salesResponseSchema.parse({
      policy: this.policy(scope, now), period, comparisonPeriod, groupBy: query.groupBy, totals: current.totals,
      series: salesSeries(current.rows, query.groupBy), comparison: { totals: comparison.totals, series: salesSeries(comparison.rows, query.groupBy) },
    });
  }

  async margins(actor: AuthPrincipal, query: GroupedFinanceReportQuery, now = new Date()) {
    const scope = await this.resolveScope(actor, query.storeId, "finance.sales.read");
    const period = { from: query.from, to: query.to };
    const comparisonPeriod = comparisonPeriodFor(query.from, query.to);
    const [current, comparison] = await Promise.all([this.load(scope, period), this.load(scope, comparisonPeriod)]);
    return marginsResponseSchema.parse({
      policy: this.policy(scope, now), period, comparisonPeriod, groupBy: query.groupBy, totals: current.totals,
      series: marginSeries(current.rows, query.groupBy), comparison: { totals: comparison.totals, series: marginSeries(comparison.rows, query.groupBy) },
    });
  }

  private async resolveScope(actor: AuthPrincipal, storeId: number | undefined, permission: Permission): Promise<Scope> {
    if (storeId === undefined) authorizationService.requirePlatformAdmin(actor);
    else await authorizationService.requireStorePermission({ principal: actor, storeId, permission });
    const stores = await this.repository.stores(storeId);
    if (storeId !== undefined && stores.length !== 1) throw resourceNotFound();
    const timezones = [...new Set(stores.map((store) => store.timezone))];
    return { kind: storeId === undefined ? "consolidated" : "store", storeIds: stores.map((store) => store.id), timezone: timezones.length <= 1 ? (timezones[0] ?? "Asia/Kolkata") : "multiple" };
  }

  private async load(scope: Scope, period: Period) {
    const [rows, collectionsPaise, unsettledRazorpayPaise] = await Promise.all([
      this.repository.movements(scope.storeIds, period.from, period.to),
      this.repository.collectionTotal(scope.storeIds, period.from, period.to),
      this.repository.unsettledRazorpay(scope.storeIds, period.to),
    ]);
    return { rows, ...projectFinanceReport(rows, { collectionsPaise, unsettledRazorpayPaise }) };
  }

  private policy(scope: Scope, now: Date) {
    return { currency: "INR" as const, timezone: scope.timezone, dateBasis: "journal_business_date" as const, recognitionBasis: "delivery" as const, includedJournalStatuses: ["posted", "reversed"] as const, generatedAt: now.toISOString(), scope: { kind: scope.kind, storeIds: scope.storeIds } };
  }

  private drillDownUrls(query: FinanceReportQuery) {
    const params = new URLSearchParams({ from: query.from, to: query.to });
    if (query.storeId !== undefined) params.set("storeId", String(query.storeId));
    const suffix = params.toString();
    return { revenue: `/api/v1/finance/sales?${suffix}`, cogs: `/api/v1/finance/margins?${suffix}`, expenses: `/api/v1/finance/expenses?${suffix}`, refunds: `/api/v1/finance/refunds?${suffix}` };
  }
}

export default new FinanceReportService();
