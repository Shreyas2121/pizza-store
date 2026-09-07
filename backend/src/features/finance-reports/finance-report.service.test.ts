import { afterEach, describe, expect, it, vi } from "vitest";
import authorizationService from "../access/access.service";
import type { AuthPrincipal } from "../auth/auth.types";
import { FinanceReportService } from "./finance-report.service";

const admin: AuthPrincipal = { userId: 1, email: "owner@example.com", platformRole: "admin", tokenVersion: 0 };
const finance: AuthPrincipal = { userId: 8, email: "finance@example.com", platformRole: "user", tokenVersion: 0 };
const rows = [{ businessDate: "2026-04-01", accountCode: "4000", accountName: "Sales", accountType: "revenue", debitPaise: "0", creditPaise: "10000" }] as const;
const payrollRows = [
  ...rows,
  { businessDate: "2026-04-01", accountCode: "6000", accountName: "Rent", accountType: "expense", debitPaise: "500", creditPaise: "0" },
  { businessDate: "2026-04-01", accountCode: "6200", accountName: "Payroll employer cost", accountType: "expense", debitPaise: "2000", creditPaise: "0" },
] as const;

const repository = () => ({
  stores: vi.fn().mockResolvedValue([{ id: 1, timezone: "Asia/Kolkata" }, { id: 2, timezone: "Asia/Kolkata" }]),
  movements: vi.fn().mockResolvedValue(rows),
  collectionTotal: vi.fn().mockResolvedValue("12000"),
  unsettledRazorpay: vi.fn().mockResolvedValue("2000"),
  openReconciliationIssues: vi.fn().mockResolvedValue(2),
  lastReconciledAt: vi.fn().mockResolvedValue(new Date("2026-04-29T10:00:00.000Z")),
});

afterEach(() => vi.restoreAllMocks());

describe("finance report service", () => {
  it("returns validated consolidated overview metadata and string aggregates", async () => {
    const repo = repository();
    const result = await new FinanceReportService(repo as never).overview(admin, { from: "2026-04-01", to: "2026-04-30" }, new Date("2026-05-01T00:00:00.000Z"));
    expect(result.policy).toMatchObject({ currency: "INR", timezone: "Asia/Kolkata", dateBasis: "journal_business_date", recognitionBasis: "delivery", lastReconciledAt: "2026-04-29T10:00:00.000Z", scope: { kind: "consolidated", storeIds: [1, 2] } });
    expect(result.kpis).toMatchObject({ recognizedRevenuePaise: "10000", collectionsPaise: "12000", unsettledRazorpayPaise: "2000", openReconciliationIssues: 2 });
    expect(result.comparison.period).toEqual({ from: "2026-03-02", to: "2026-03-31" });
  });

  it("returns null reconciliation metadata when the selected scope has never reconciled a settlement", async () => {
    const repo = repository();
    repo.lastReconciledAt.mockResolvedValue(null);
    const result = await new FinanceReportService(repo as never).overview(admin, { from: "2026-04-01", to: "2026-04-30" });
    expect(result.policy.lastReconciledAt).toBeNull();
  });

  it("requires store scope for staff and enforces the report permission", async () => {
    const repo = repository();
    const service = new FinanceReportService(repo as never);
    await expect(service.overview(finance, { from: "2026-04-01", to: "2026-04-30" })).rejects.toMatchObject({ code: "PERMISSION_DENIED" });

    const requirePermission = vi.spyOn(authorizationService, "requireStorePermission").mockRejectedValueOnce(Object.assign(new Error("denied"), { code: "PERMISSION_DENIED" }));
    await expect(service.sales(finance, { from: "2026-04-01", to: "2026-04-30", storeId: 99, groupBy: "month" })).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    expect(requirePermission).toHaveBeenCalledWith(expect.objectContaining({ storeId: 99, permission: "finance.sales.read" }));
    expect(repo.movements).not.toHaveBeenCalled();
  });

  it("returns store P&L with current and comparison projections", async () => {
    vi.spyOn(authorizationService, "requireStorePermission").mockResolvedValue({ access: "membership", userId: 8, storeId: 1, permission: "finance.overview.read", membershipId: 4, membershipRole: "finance_manager" });
    vi.spyOn(authorizationService, "hasStorePermission").mockResolvedValue(false);
    const repo = repository();
    repo.stores.mockResolvedValue([{ id: 1, timezone: "Asia/Kolkata" }]);
    const result = await new FinanceReportService(repo as never).profitAndLoss(finance, { from: "2026-04-01", to: "2026-04-30", storeId: 1, groupBy: "month" });
    expect(result.policy.scope).toEqual({ kind: "store", storeIds: [1] });
    expect(result.periods).toEqual([expect.objectContaining({ period: "2026-04", recognizedRevenuePaise: "10000", grossProfitPaise: "10000" })]);
    expect(result.comparison.totals.recognizedRevenuePaise).toBe("10000");
  });

  it("exports the same exact totals as the screen service with identical authorization", async () => {
    vi.spyOn(authorizationService, "requireStorePermission").mockResolvedValue({ access: "membership", userId: 8, storeId: 1, permission: "finance.sales.read", membershipId: 4, membershipRole: "finance_manager" });
    vi.spyOn(authorizationService, "hasStorePermission").mockResolvedValue(false);
    const repo = repository();
    repo.stores.mockResolvedValue([{ id: 1, timezone: "Asia/Kolkata" }]);
    const service = new FinanceReportService(repo as never);
    const query = { from: "2026-04-01", to: "2026-04-30", storeId: 1, groupBy: "month" } as const;
    const screen = await service.sales(finance, query, new Date("2026-05-01T00:00:00.000Z"));
    const exported = await service.exportCsv(finance, "sales", query, new Date("2026-05-01T00:00:00.000Z"));
    const [heading, ...csvRows] = exported.body.split("\r\n").filter(Boolean).map((line) => line.split(","));
    const column = (name: string) => heading.indexOf(name);
    const currentTotals = Object.fromEntries(csvRows.filter((columns) => columns[column("row_type")] === "current_total").map((columns) => [columns[column("metric")], columns[column("value")]]));
    const screenTotals = Object.fromEntries(Object.entries(screen.totals).map(([metric, value]) => [metric, value === null ? "" : String(value)]));
    expect(currentTotals).toEqual(screenTotals);
    expect(exported.filename).toBe("finance-sales-store-1-2026-04-01-2026-04-30.csv");
    expect(authorizationService.requireStorePermission).toHaveBeenCalledTimes(2);
  });

  it("suppresses payroll cost and every derived operating result without payroll.read", async () => {
    vi.spyOn(authorizationService, "requireStorePermission").mockResolvedValue({ access: "membership", userId: 8, storeId: 1, permission: "finance.overview.read", membershipId: 4, membershipRole: "finance_manager" });
    vi.spyOn(authorizationService, "hasStorePermission").mockResolvedValue(false);
    const repo = repository();
    repo.stores.mockResolvedValue([{ id: 1, timezone: "Asia/Kolkata" }]);
    repo.movements.mockResolvedValue(payrollRows);
    const service = new FinanceReportService(repo as never);
    const query = { from: "2026-04-01", to: "2026-04-30", storeId: 1, groupBy: "month" } as const;

    const overview = await service.overview(finance, query);
    const pnl = await service.profitAndLoss(finance, query);

    expect(overview.policy.payrollCostVisibility).toBe("suppressed");
    expect(overview.kpis).toMatchObject({ operatingExpensesPaise: "500", payrollCostPaise: null, operatingResultPaise: null });
    expect(overview.comparison.kpis).toMatchObject({ payrollCostPaise: null, operatingResultPaise: null });
    expect(overview.drillDownUrls).not.toHaveProperty("payroll");
    expect(pnl.totals).toMatchObject({ operatingExpensesPaise: "500", payrollCostPaise: null, operatingResultPaise: null });
    expect(pnl.comparison.totals).toMatchObject({ payrollCostPaise: null, operatingResultPaise: null });
    expect(pnl.periods).toEqual([expect.objectContaining({ payrollCostPaise: null, operatingResultPaise: null })]);
    expect(pnl.comparison.periods).toEqual([expect.objectContaining({ payrollCostPaise: null, operatingResultPaise: null })]);
    expect(pnl.operatingExpenseLines).toEqual([{ accountCode: "6000", accountName: "Rent", amountPaise: "500" }]);
  });

  it("retains exact payroll employer cost for an explicitly authorized viewer", async () => {
    vi.spyOn(authorizationService, "requireStorePermission").mockResolvedValue({ access: "membership", userId: 8, storeId: 1, permission: "finance.overview.read", membershipId: 4, membershipRole: "finance_manager" });
    vi.spyOn(authorizationService, "hasStorePermission").mockResolvedValue(true);
    const repo = repository();
    repo.stores.mockResolvedValue([{ id: 1, timezone: "Asia/Kolkata" }]);
    repo.movements.mockResolvedValue(payrollRows);
    const result = await new FinanceReportService(repo as never).overview(finance, { from: "2026-04-01", to: "2026-04-30", storeId: 1 });

    expect(authorizationService.hasStorePermission).toHaveBeenCalledWith(finance, 1, "payroll.read");
    expect(result.policy.payrollCostVisibility).toBe("detailed");
    expect(result.kpis).toMatchObject({ operatingExpensesPaise: "500", payrollCostPaise: "2000", operatingResultPaise: "7500" });
    expect(result.drillDownUrls.payroll).toContain("accountCodes=6200");
  });

  it("keeps protected values blank in every restricted report CSV", async () => {
    vi.spyOn(authorizationService, "requireStorePermission").mockResolvedValue({ access: "membership", userId: 8, storeId: 1, permission: "finance.overview.read", membershipId: 4, membershipRole: "finance_manager" });
    vi.spyOn(authorizationService, "hasStorePermission").mockResolvedValue(false);
    const repo = repository();
    repo.stores.mockResolvedValue([{ id: 1, timezone: "Asia/Kolkata" }]);
    repo.movements.mockResolvedValue(payrollRows);
    const service = new FinanceReportService(repo as never);
    const query = { from: "2026-04-01", to: "2026-04-30", storeId: 1, groupBy: "month" } as const;

    for (const reportType of ["overview", "profit-and-loss", "sales", "margins"] as const) {
      const { body } = await service.exportCsv(finance, reportType, query);
      const [headings, ...csvRows] = body.trim().split("\r\n").map((line) => line.split(","));
      const metricIndex = headings.indexOf("metric");
      const valueIndex = headings.indexOf("value");
      const visibilityIndex = headings.indexOf("payroll_cost_visibility");
      const protectedRows = csvRows.filter((row) => ["payrollCostPaise", "operatingResultPaise"].includes(row[metricIndex]));
      expect(protectedRows.length, reportType).toBeGreaterThan(0);
      expect(protectedRows.every((row) => row[valueIndex] === "" && row[visibilityIndex] === "suppressed"), reportType).toBe(true);
    }
  });

  it("does not load export data when report permission is denied", async () => {
    vi.spyOn(authorizationService, "requireStorePermission").mockRejectedValue(Object.assign(new Error("denied"), { code: "PERMISSION_DENIED" }));
    const repo = repository();
    const service = new FinanceReportService(repo as never);
    await expect(service.exportCsv(finance, "profit-and-loss", { from: "2026-04-01", to: "2026-04-30", storeId: 1, groupBy: "month" })).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    expect(repo.movements).not.toHaveBeenCalled();
  });
});
