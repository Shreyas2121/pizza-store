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

  it("posts only aggregate payroll totals to the outbox and reverses the exact posted source", async () => {
    authorize();
    const paid = {
      ...run, status: "paid" as const, version: 4, calculatedBy: 2, approvedBy: 3, paidBy: 4,
      grossPayPaise: 300_000, deductionPaise: 10_000, netPayPaise: 290_000,
      employerCostPaise: 20_000, totalEmployerCostPaise: 320_000, paymentReference: "UTR-PRIVATE",
    };
    const posted = { ...paid, status: "posted" as const, version: 5, postedBy: 5, postedAt: now };
    const eventWriter = { write: vi.fn().mockResolvedValue(undefined) };
    const repository = {
      command: vi.fn().mockResolvedValue(undefined), findRun: vi.fn().mockResolvedValue(paid),
      transaction: (work: (tx: never) => Promise<unknown>) => work({} as never), lockRun: vi.fn().mockResolvedValue(paid),
      findStore: vi.fn().mockResolvedValue({ id: 1, timezone: "Asia/Kolkata" }), update: vi.fn().mockResolvedValue(posted),
      recordCommand: vi.fn().mockResolvedValue({ id: 2 }), detail: vi.fn().mockResolvedValue({ run: posted, employees: [] }),
    };
    await new PayRunService(repository as never, { write: vi.fn() }, eventWriter).post(actor(5), 4, crypto.randomUUID(), now);
    const postedEvent = eventWriter.write.mock.calls[0][1];
    expect(postedEvent).toMatchObject({ eventType: "pay_run.posted", businessDate: "2026-08-31", sourceVersion: 5 });
    expect(JSON.stringify(postedEvent)).not.toContain("UTR-PRIVATE");

    const reversed = { ...posted, status: "reversed" as const, version: 6, reversedBy: 6, reversedAt: now, reversalReason: "Correction" };
    Object.assign(repository, {
      findRun: vi.fn().mockResolvedValue(posted), lockRun: vi.fn().mockResolvedValue(posted),
      update: vi.fn().mockResolvedValue(reversed), detail: vi.fn().mockResolvedValue({ run: reversed, employees: [] }),
    });
    await new PayRunService(repository as never, { write: vi.fn() }, eventWriter).reverse(
      actor(6), 4, crypto.randomUUID(), { reason: "Correction", effectiveBusinessDate: "2026-09-07" }, now,
    );
    expect(eventWriter.write.mock.calls[1][1]).toMatchObject({
      eventType: "pay_run.reversed", sourceVersion: 6,
      payload: { originalPostingSource: { eventType: "pay_run.posted", sourceVersion: 5 } },
    });
  });

  it("returns a restricted payslip-style statement from the immutable snapshot", async () => {
    authorize();
    const employee = {
      id: 11, payRunId: 4, payRunStoreId: 1, profileId: 8, compensationVersionId: 12,
      employeeCode: "EMP-08", displayName: "Employee Eight", grossPayPaise: 200_000,
      deductionPaise: 10_000, netPayPaise: 190_000, employerCostPaise: 20_000,
      totalEmployerCostPaise: 220_000, createdAt: now,
      lines: [{ id: 1, payRunEmployeeId: 11, compensationComponentId: 31, type: "earning", componentCode: "BASE", componentName: "Base", amountPaise: 200_000, createdAt: now }],
    };
    const repository = { findRun: vi.fn().mockResolvedValue(run), detail: vi.fn().mockResolvedValue({ run, employees: [employee] }) };
    const result = await new PayRunService(repository as never).statement(actor(7), 4, 11);
    expect(result.data).toMatchObject({ employee: { employeeCode: "EMP-08" }, totals: { netPayPaise: 190_000 } });
    expect(JSON.stringify(result)).not.toContain("paymentReference");
    await expect(new PayRunService(repository as never).statement(actor(7), 4, 999)).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
  });
});
