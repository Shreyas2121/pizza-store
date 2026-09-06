import { afterEach, describe, expect, it, vi } from "vitest";
import authorizationService from "../access/access.service";
import type { AuthPrincipal } from "../auth/auth.types";
import { FinanceReportService } from "./finance-report.service";

const admin: AuthPrincipal = { userId: 1, email: "owner@example.com", platformRole: "admin", tokenVersion: 0 };
const finance: AuthPrincipal = { userId: 8, email: "finance@example.com", platformRole: "user", tokenVersion: 0 };
const rows = [{ businessDate: "2026-04-01", accountCode: "4000", accountName: "Sales", accountType: "revenue", debitPaise: "0", creditPaise: "10000" }] as const;

const repository = () => ({
  stores: vi.fn().mockResolvedValue([{ id: 1, timezone: "Asia/Kolkata" }, { id: 2, timezone: "Asia/Kolkata" }]),
  movements: vi.fn().mockResolvedValue(rows),
  collectionTotal: vi.fn().mockResolvedValue("12000"),
  unsettledRazorpay: vi.fn().mockResolvedValue("2000"),
  openReconciliationIssues: vi.fn().mockResolvedValue(2),
});

afterEach(() => vi.restoreAllMocks());

describe("finance report service", () => {
  it("returns validated consolidated overview metadata and string aggregates", async () => {
    const repo = repository();
    const result = await new FinanceReportService(repo as never).overview(admin, { from: "2026-04-01", to: "2026-04-30" }, new Date("2026-05-01T00:00:00.000Z"));
    expect(result.policy).toMatchObject({ currency: "INR", timezone: "Asia/Kolkata", dateBasis: "journal_business_date", recognitionBasis: "delivery", scope: { kind: "consolidated", storeIds: [1, 2] } });
    expect(result.kpis).toMatchObject({ recognizedRevenuePaise: "10000", collectionsPaise: "12000", unsettledRazorpayPaise: "2000", openReconciliationIssues: 2 });
    expect(result.comparison.period).toEqual({ from: "2026-03-02", to: "2026-03-31" });
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
    const repo = repository();
    repo.stores.mockResolvedValue([{ id: 1, timezone: "Asia/Kolkata" }]);
    const result = await new FinanceReportService(repo as never).profitAndLoss(finance, { from: "2026-04-01", to: "2026-04-30", storeId: 1, groupBy: "month" });
    expect(result.policy.scope).toEqual({ kind: "store", storeIds: [1] });
    expect(result.periods).toEqual([expect.objectContaining({ period: "2026-04", recognizedRevenuePaise: "10000", grossProfitPaise: "10000" })]);
    expect(result.comparison.totals.recognizedRevenuePaise).toBe("10000");
  });
});
