import { beforeEach, describe, expect, it, vi } from "vitest";
import authorizationService from "../access/access.service";
import auditService from "../audit/audit.service";
import { LedgerAdminService, requireRecentOwner } from "./ledger-admin.service";

const now = new Date("2026-09-06T10:00:00.000Z");
const owner = { userId: 1, email: "owner@example.com", platformRole: "admin" as const, tokenVersion: 1, authenticatedAt: new Date("2026-09-06T09:50:00.000Z") };
const finance = { userId: 2, email: "finance@example.com", platformRole: "user" as const, tokenVersion: 1 };
const transaction = (work: (tx: never) => Promise<unknown>) => work({} as never);

describe("ledger admin service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(auditService, "write").mockResolvedValue();
    vi.spyOn(authorizationService, "requireStorePermission").mockResolvedValue({ access: "membership", userId: 2, storeId: 1, membershipId: 4, membershipRole: "finance_manager", permission: "finance.ledger.read" });
    vi.spyOn(authorizationService, "requireResourceStorePermission").mockResolvedValue({ access: "membership", userId: 2, storeId: 1, membershipId: 4, membershipRole: "finance_manager", permission: "finance.ledger.read" });
  });

  it("requires an owner with recent authentication for period control", () => {
    expect(() => requireRecentOwner(owner, now)).not.toThrow();
    expect(() => requireRecentOwner({ ...owner, authenticatedAt: new Date("2026-09-06T09:30:00.000Z") }, now)).toThrowError(expect.objectContaining({ code: "RECENT_AUTHENTICATION_REQUIRED" }));
    expect(() => requireRecentOwner(finance, now)).toThrowError(expect.objectContaining({ code: "PERMISSION_DENIED" }));
  });

  it("opens and audits a non-overlapping financial year", async () => {
    const repository = { transaction, overlappingPeriods: vi.fn().mockResolvedValue([]), createPeriod: vi.fn().mockResolvedValue({ id: 3, storeId: 1, name: "FY 2026-27", startDate: "2026-04-01", endDate: "2027-03-31", status: "open" }) };
    const result = await new LedgerAdminService(repository as never, {} as never).openPeriod(owner, { storeId: 1, name: "FY 2026-27", startDate: "2026-04-01", endDate: "2027-03-31", reason: "Open financial year" }, now);
    expect(result.status).toBe("open");
    expect(auditService.write).toHaveBeenCalledWith(expect.objectContaining({ action: "ledger.period_opened", resourceId: 3 }));
  });

  it("enforces open to soft-close to close and controlled reopen", async () => {
    let period: Record<string, unknown> = { id: 3, storeId: 1, status: "open", name: "FY", startDate: "2026-04-01", endDate: "2027-03-31" };
    const repository = { transaction, findPeriod: vi.fn(async () => ({ ...period })), lockPeriod: vi.fn(async () => ({ ...period })), updatePeriod: vi.fn(async (_tx, _id, values) => { period = { ...period, ...values }; return { ...period }; }) };
    const service = new LedgerAdminService(repository as never, {} as never);
    await service.softClosePeriod(owner, 3, "Review complete", now);
    await service.closePeriod(owner, 3, "Owner close", now);
    await service.reopenPeriod(owner, 3, "Correction required", now);
    expect(period.status).toBe("open");
    expect(auditService.write).toHaveBeenCalledTimes(3);
  });

  it("serializes aggregates and exposes balance policy metadata", async () => {
    const repository = { trialBalance: vi.fn().mockResolvedValue([{ accountId: 1, accountCode: "1000", accountName: "Cash", accountType: "asset", normalSide: "debit", debitPaise: "52500", creditPaise: "0" }, { accountId: 2, accountCode: "2000", accountName: "Advances", accountType: "liability", normalSide: "credit", debitPaise: "0", creditPaise: "52500" }]) };
    const result = await new LedgerAdminService(repository as never, {} as never).trialBalance(finance, { storeId: 1 });
    expect(result.totals).toEqual({ debitPaise: "52500", creditPaise: "52500", differencePaise: "0" });
    expect(result.policy).toMatchObject({ currency: "INR", basis: "posted_journals", balanced: true });
  });

  it("routes manual journals through the kernel and audits in one transaction", async () => {
    const ledger = { postWithin: vi.fn().mockResolvedValue({ id: 9, journalNumber: "JRN-1-9", businessDate: "2026-09-06" }) };
    await new LedgerAdminService({ transaction } as never, ledger as never).postManual(finance, "manual-key-1", { storeId: 1, businessDate: "2026-09-06", description: "Owner adjustment", lines: [{ accountCode: "1000", side: "debit", amountPaise: 100 }, { accountCode: "3000", side: "credit", amountPaise: 100 }] }, now);
    expect(ledger.postWithin).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ kind: "manual", postedBy: 2 }));
    expect(auditService.write).toHaveBeenCalledWith(expect.objectContaining({ action: "ledger.manual_journal_posted", resourceId: 9 }));
  });

  it("denies a journal detail outside the actor's store scope", async () => {
    const repository = { journalDetail: vi.fn().mockResolvedValue({ id: 9, storeId: 2, lines: [] }) };
    vi.spyOn(authorizationService, "requireResourceStorePermission").mockRejectedValueOnce(new Error("denied"));
    await expect(new LedgerAdminService(repository as never, {} as never).journal(finance, 9)).rejects.toThrow("denied");
  });

  it("allows only the platform owner to list consolidated journal drill-downs", async () => {
    const repository = { listJournals: vi.fn().mockResolvedValue({ items: [], meta: { limit: 25, hasNextPage: false, nextCursor: null } }) };
    const service = new LedgerAdminService(repository as never, {} as never);
    await expect(service.journals(finance, { limit: 25 })).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    await expect(service.journals(owner, { limit: 25 })).resolves.toMatchObject({ items: [] });
  });
});
