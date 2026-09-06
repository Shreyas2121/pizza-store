import { beforeEach, describe, expect, it, vi } from "vitest";
import authorizationService from "../access/access.service";
import auditService from "../audit/audit.service";
import { SETTLEMENT_IMPORT_FIXTURES } from "./settlement.fixtures";
import { hashSettlementPayload } from "./settlement.policy";
import settlementRepository from "./settlement.repository";
import settlementService from "./settlement.service";

const actor = {
  userId: 9,
  email: "finance@example.com",
  platformRole: "user" as const,
  tokenVersion: 1,
};

const savedBatch = {
  id: 51,
  storeId: 1,
  provider: "razorpay",
  providerSettlementId: "set_m1_s1_001",
  providerStatus: "processed",
  status: "imported" as const,
  source: "fixture",
  periodFrom: new Date("2026-07-01T00:00:00.000Z"),
  periodTo: new Date("2026-07-28T06:00:00.000Z"),
  grossAmountPaise: 95_000,
  feePaise: 1_900,
  feeTaxPaise: 342,
  adjustmentPaise: -40_000,
  netAmountPaise: 52_758,
  currency: "INR" as const,
  utr: "UTR_FIXTURE_M1_S1_001",
  providerReference: "fixture-july-store-1",
  payloadHash: "a".repeat(64),
  settledAt: new Date("2026-07-28T06:00:00.000Z"),
  importedBy: actor.userId,
  importedAt: new Date(),
  reconciledAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("settlement import service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authorizationService, "requireStorePermission").mockResolvedValue({
      access: "membership",
      userId: actor.userId,
      storeId: 1,
      permission: "finance.reconciliation.manage",
      membershipId: 2,
      membershipRole: "finance_manager",
    });
    vi.spyOn(authorizationService, "requireResourceStorePermission").mockResolvedValue({
      access: "membership",
      userId: actor.userId,
      storeId: 1,
      permission: "finance.reconciliation.manage",
      membershipId: 2,
      membershipRole: "finance_manager",
    });
    vi.spyOn(settlementRepository, "storeExists").mockResolvedValue(true);
    vi.spyOn(auditService, "write").mockResolvedValue();
  });

  it("restricts consolidated reconciliation issue lists to the platform owner", async () => {
    const list = vi.spyOn(settlementRepository, "listIssues").mockResolvedValue({ items: [], meta: { total: 0, page: 1, limit: 25, totalPages: 0, hasNextPage: false } });
    await expect(settlementService.listIssues(actor, { status: "open", page: 1, limit: 25 })).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    await expect(settlementService.listIssues({ ...actor, platformRole: "admin" }, { status: "open", page: 1, limit: 25 })).resolves.toMatchObject({ items: [] });
    expect(list).toHaveBeenCalledWith(undefined, "open", 1, 25);
  });

  it("imports the checked-in fixture atomically and audits exact totals", async () => {
    vi.spyOn(settlementRepository, "findByProviderId").mockResolvedValue(undefined);
    vi.spyOn(settlementRepository, "transaction").mockImplementation(async (work) =>
      work({} as never)
    );
    const create = vi.spyOn(settlementRepository, "create").mockResolvedValue(savedBatch);

    const result = await settlementService.importBatch(actor, {
      source: "fixture",
      providerSettlementId: "set_m1_s1_001",
    });

    expect(result).toEqual({ batch: savedBatch, imported: true });
    expect(create).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        grossAmountPaise: 95_000,
        adjustmentPaise: -40_000,
        netAmountPaise: 52_758,
      }),
      expect.stringMatching(/^[0-9a-f]{64}$/),
      actor.userId
    );
    expect(auditService.write).toHaveBeenCalledWith(expect.objectContaining({
      action: "settlement.imported",
      resourceType: "settlement_batch",
      storeId: 1,
    }));
  });

  it("returns an identical existing import without another transaction", async () => {
    const fixtureHash = hashSettlementPayload(SETTLEMENT_IMPORT_FIXTURES[0]);
    vi.spyOn(settlementRepository, "findByProviderId").mockResolvedValue({
      ...savedBatch,
      payloadHash: fixtureHash,
    });
    const transaction = vi.spyOn(settlementRepository, "transaction");

    const result = await settlementService.importBatch(actor, {
      source: "fixture",
      providerSettlementId: "set_m1_s1_001",
    });

    expect(result.imported).toBe(false);
    expect(transaction).not.toHaveBeenCalled();
  });
});
