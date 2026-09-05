import { beforeEach, describe, expect, it, vi } from "vitest";
import authorizationService from "../access/access.service";
import auditService from "../audit/audit.service";
import { CashService } from "./cash.service";

const actor = { userId: 9, email: "owner@example.com", platformRole: "admin" as const, tokenVersion: 1 };
const session = { id: 4, storeId: 1, businessDate: "2026-09-05", status: "open", currency: "INR", openingFloatPaise: 10_000, expectedCashPaise: 12_000, countedCashPaise: null, variancePaise: null, materialVarianceAcknowledged: false, version: 2, openedBy: 9, openedAt: new Date(), closedBy: null, closedAt: null, createdAt: new Date(), updatedAt: new Date() } as const;

describe("cash service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authorizationService, "requireResourceStorePermission").mockResolvedValue({ access: "platform", userId: 9, storeId: 1, permission: "finance.cash.manage" });
    vi.spyOn(auditService, "write").mockResolvedValue();
  });

  it("records signed manual movement and updates expected cash transactionally", async () => {
    const repository = {
      findById: vi.fn().mockResolvedValue(session),
      transaction: (work: (tx: never) => Promise<unknown>) => work({} as never),
      lockById: vi.fn().mockResolvedValue(session),
      addMovement: vi.fn().mockResolvedValue({ id: 20, sessionId: 4, storeId: 1, type: "cash_out", amountPaise: -2_000, reason: "Petty cash supplies", orderId: null, refundId: null, reversesMovementId: null }),
      updateExpected: vi.fn().mockResolvedValue({ ...session, expectedCashPaise: 10_000, version: 3 }),
      findStore: vi.fn().mockResolvedValue({ id: 1, timezone: "Asia/Kolkata" }),
    };
    const events = { write: vi.fn().mockResolvedValue({}) };
    const service = new CashService(repository as never, events);
    const result = await service.recordManual(actor, 4, { type: "cash_out", amountPaise: 2_000, reason: "Petty cash supplies" });
    expect(repository.addMovement).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ amountPaise: -2_000 }));
    expect(repository.updateExpected).toHaveBeenCalledWith(expect.anything(), 4, 10_000, 3);
    expect(result.session.expectedCashPaise).toBe(10_000);
    expect(events.write).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ eventType: "cash.movement_recorded" }));
  });

  it("requires acknowledgement before a material-variance close", async () => {
    const repository = {
      findById: vi.fn().mockResolvedValue(session),
      transaction: (work: (tx: never) => Promise<unknown>) => work({} as never),
      lockById: vi.fn().mockResolvedValue(session),
    };
    const service = new CashService(repository as never, { write: vi.fn() });
    await expect(service.close(actor, 4, { countedCashPaise: 62_000, materialVarianceAcknowledged: false }))
      .rejects.toMatchObject({ code: "MATERIAL_VARIANCE_ACKNOWLEDGEMENT_REQUIRED", data: { variancePaise: 50_000 } });
    expect(repository).not.toHaveProperty("close");
  });

  it("refuses source-controlled movements through the manual command", async () => {
    const service = new CashService({} as never, { write: vi.fn() });
    await expect(service.recordManual(actor, 4, { type: "cod_collection", amountPaise: 1_000, reason: "manual" }))
      .rejects.toMatchObject({ code: "CASH_SOURCE_MOVEMENT_REQUIRED" });
  });
});
