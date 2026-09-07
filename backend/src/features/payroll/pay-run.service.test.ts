import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import authorizationService, { permissionDenied, resourceNotFound } from "../access/access.service";
import { PayRunService } from "./pay-run.service";

const now = new Date("2026-09-07T10:00:00Z");
const actor = (userId: number) => ({
  userId, email: `payroll-${userId}@example.com`, platformRole: "user" as const,
  tokenVersion: 1, authenticatedAt: new Date("2026-09-07T09:55:00Z"),
});
const run = {
  id: 4, storeId: 1, periodStart: "2026-08-01", periodEnd: "2026-08-31",
  status: "draft" as const, currency: "INR" as const, demoOnly: true,
  employeeCount: null, grossPayPaise: null, deductionPaise: null, netPayPaise: null,
  employerCostPaise: null, totalEmployerCostPaise: null,
  clientRequestId: crypto.randomUUID(), payloadHash: "a".repeat(64), version: 1,
  createdBy: 1, calculatedBy: null, calculatedAt: null, approvedBy: null, approvedAt: null,
  paidBy: null, paidAt: null, paymentReference: null, postedBy: null, postedAt: null,
  voidedBy: null, voidedAt: null, voidReason: null, reversedBy: null, reversedAt: null,
  reversalReason: null, createdAt: now, updatedAt: now,
};

const authorize = () => vi.spyOn(authorizationService, "requireResourceStorePermission").mockResolvedValue({
  access: "membership", userId: 1, storeId: 1, permission: "payroll.calculate",
  membershipId: 3, membershipRole: "payroll_manager",
});

describe("pay run service", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("calculates and persists immutable exact snapshots from period-end compensation", async () => {
    authorize();
    const audit = { write: vi.fn().mockResolvedValue(undefined) };
    const replaceSnapshot = vi.fn().mockResolvedValue(undefined);
    const updated = {
      ...run, status: "calculated" as const, version: 2, calculatedBy: 1, calculatedAt: now,
      employeeCount: 1, grossPayPaise: 200_000, deductionPaise: 10_000,
      netPayPaise: 190_000, employerCostPaise: 20_000, totalEmployerCostPaise: 220_000,
    };
    const repository = {
      command: vi.fn().mockResolvedValue(undefined),
      findRun: vi.fn().mockResolvedValue(run),
      transaction: (work: (tx: never) => Promise<unknown>) => work({} as never),
      lockRun: vi.fn().mockResolvedValue(run),
      calculationInputs: vi.fn().mockResolvedValue([{
        profileId: 8, employeeCode: "EMP-08", displayName: "Employee Eight", compensationVersionId: 12,
        components: [
          { id: 31, compensationVersionId: 12, type: "earning", code: "BASE", name: "Base", amountPaise: 200_000 },
          { id: 32, compensationVersionId: 12, type: "deduction", code: "DEMO_DEDUCTION", name: "Demo deduction", amountPaise: 10_000 },
          { id: 33, compensationVersionId: 12, type: "employer_cost", code: "DEMO_EMPLOYER", name: "Demo employer cost", amountPaise: 20_000 },
        ],
      }]),
      replaceSnapshot,
      update: vi.fn().mockResolvedValue(updated),
      recordCommand: vi.fn().mockResolvedValue({ id: 2 }),
      detail: vi.fn().mockResolvedValue({ run: updated, employees: [] }),
    };
    const result = await new PayRunService(repository as never, audit).calculate(actor(1), 4, crypto.randomUUID(), now);
    expect(replaceSnapshot).toHaveBeenCalledWith(expect.anything(), 4, 1, expect.objectContaining({
      totals: expect.objectContaining({ netPayPaise: 190_000, totalEmployerCostPaise: 220_000 }),
    }));
    expect(result.data.run.status).toBe("calculated");
    const serializedAudit = JSON.stringify(audit.write.mock.calls);
    expect(serializedAudit).not.toContain("grossPayPaise");
    expect(serializedAudit).not.toContain("200000");
  });

  it("prevents a drafter or calculator from approving their own run", async () => {
    authorize();
    const calculated = { ...run, status: "calculated" as const, calculatedBy: 2, calculatedAt: now, version: 2 };
    const repository = {
      command: vi.fn().mockResolvedValue(undefined), findRun: vi.fn().mockResolvedValue(calculated),
      transaction: (work: (tx: never) => Promise<unknown>) => work({} as never), lockRun: vi.fn().mockResolvedValue(calculated),
    };
    await expect(new PayRunService(repository as never, { write: vi.fn() }).approve(actor(1), 4, crypto.randomUUID(), now))
      .rejects.toMatchObject({ code: "PAY_RUN_SEGREGATION_VIOLATION" });
    await expect(new PayRunService(repository as never, { write: vi.fn() }).approve(actor(2), 4, crypto.randomUUID(), now))
      .rejects.toMatchObject({ code: "PAY_RUN_SEGREGATION_VIOLATION" });
  });

  it("requires a fourth-party payer and never copies the payment reference into audit", async () => {
    authorize();
    const approved = { ...run, status: "approved" as const, createdBy: 1, calculatedBy: 2, approvedBy: 3, version: 3 };
    const repository = {
      command: vi.fn().mockResolvedValue(undefined), findRun: vi.fn().mockResolvedValue(approved),
      transaction: (work: (tx: never) => Promise<unknown>) => work({} as never), lockRun: vi.fn().mockResolvedValue(approved),
    };
    await expect(new PayRunService(repository as never, { write: vi.fn() }).pay(actor(3), 4, crypto.randomUUID(), { paymentReference: "UTR-PRIVATE" }, now))
      .rejects.toMatchObject({ code: "PAY_RUN_SEGREGATION_VIOLATION" });

    const paid = { ...approved, status: "paid" as const, paidBy: 4, paidAt: now, paymentReference: "UTR-PRIVATE", version: 4 };
    const audit = { write: vi.fn().mockResolvedValue(undefined) };
    Object.assign(repository, {
      update: vi.fn().mockResolvedValue(paid), recordCommand: vi.fn().mockResolvedValue({ id: 2 }),
      detail: vi.fn().mockResolvedValue({ run: paid, employees: [] }),
    });
    const result = await new PayRunService(repository as never, audit).pay(actor(4), 4, crypto.randomUUID(), { paymentReference: "UTR-PRIVATE" }, now);
    expect(result.data.run.status).toBe("paid");
    expect(JSON.stringify(audit.write.mock.calls)).not.toContain("UTR-PRIVATE");
    expect(audit.write).toHaveBeenCalledWith(expect.objectContaining({ metadata: { paymentReferenceRecorded: true } }));
  });

  it("returns the same not-found result for missing and cross-store detail/export probes", async () => {
    const missingRepository = { findRun: vi.fn().mockResolvedValue(undefined) };
    await expect(new PayRunService(missingRepository as never).get(actor(7), 999)).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });

    vi.spyOn(authorizationService, "requireResourceStorePermission").mockRejectedValue(resourceNotFound());
    const crossStoreRepository = { findRun: vi.fn().mockResolvedValue(run), detail: vi.fn() };
    const service = new PayRunService(crossStoreRepository as never);
    await expect(service.get(actor(7), 4)).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
    await expect(service.exportCsv(actor(7), 4)).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
    expect(crossStoreRepository.detail).not.toHaveBeenCalled();
  });

  it("does not query pay-run lists after a store permission denial", async () => {
    vi.spyOn(authorizationService, "requireStorePermission").mockRejectedValue(permissionDenied());
    const repository = { list: vi.fn() };
    await expect(new PayRunService(repository as never).list(actor(7), { storeId: 2, page: 1, limit: 25 }))
      .rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    expect(repository.list).not.toHaveBeenCalled();
  });
});
