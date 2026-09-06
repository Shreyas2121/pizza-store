import { beforeEach, describe, expect, it, vi } from "vitest";
import authorizationService from "../access/access.service";
import auditService from "../audit/audit.service";
import { CostService } from "./cost.service";

const actor = { userId: 9, email: "costs@example.com", platformRole: "admin" as const, tokenVersion: 1 };

describe("cost service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authorizationService, "requireResourceStorePermission").mockResolvedValue({
      access: "platform", userId: 9, storeId: 1, permission: "finance.costs.manage",
    });
    vi.spyOn(auditService, "write").mockResolvedValue();
  });

  it("rejects an overlapping effective range before insert", async () => {
    const repository = {
      findStoreProduct: vi.fn().mockResolvedValue({ id: 3, storeId: 1 }),
      transaction: (work: (tx: never) => Promise<unknown>) => work({} as never),
      lockStoreProduct: vi.fn().mockResolvedValue({ id: 3, storeId: 1 }),
      findOverlap: vi.fn().mockResolvedValue({ id: 20 }),
    };
    const service = new CostService(repository as never);
    await expect(service.create(actor, {
      storeId: 1, storeProductId: 3, unitCostPaise: 10_000,
      effectiveFrom: "2026-09-01", effectiveTo: null, source: "review",
    })).rejects.toMatchObject({ code: "COST_VERSION_OVERLAP" });
  });

  it("snapshots the effective unit and line cost without consulting mutable prices", async () => {
    const snapshotOrderItem = vi.fn().mockResolvedValue({ id: 4 });
    const repository = {
      listOrderItems: vi.fn().mockResolvedValue([{ id: 4, productId: 8, quantity: 3, costVersionId: null, unitCostPaise: null, lineCostPaise: null, lineSubtotalPaise: 30_000, discountAllocationPaise: 3_000, taxableAmountPaise: 25_714, taxPaise: 1_286, taxRateBps: 500 }]),
      lockStoreProducts: vi.fn().mockResolvedValue([{ id: 12, storeId: 1, productId: 8 }]),
      findEffectiveCosts: vi.fn().mockResolvedValue([{ id: 30, storeProductId: 12, unitCostPaise: 4_500 }]),
      snapshotOrderItem,
    };
    const service = new CostService(repository as never);
    const result = await service.snapshotOrderItems({} as never, { orderId: 5, storeId: 1, businessDate: "2026-09-04" });
    expect(result).toEqual([{
      orderItemId: 4, productId: 8, quantity: 3, costVersionId: 30,
      unitCostPaise: 4_500, lineCostPaise: 13_500,
      lineSubtotalPaise: 30_000, discountAllocationPaise: 3_000,
      taxableAmountPaise: 25_714, taxPaise: 1_286, taxRateBps: 500,
    }]);
    expect(snapshotOrderItem).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ lineCostPaise: 13_500 }));
  });

  it("preserves an existing historical snapshot", async () => {
    const snapshotOrderItem = vi.fn();
    const repository = {
      listOrderItems: vi.fn().mockResolvedValue([{ id: 4, productId: 8, quantity: 2, costVersionId: 30, unitCostPaise: 4_500, lineCostPaise: 9_000, lineSubtotalPaise: 20_000, discountAllocationPaise: 0, taxableAmountPaise: 19_048, taxPaise: 952, taxRateBps: 500 }]),
      lockStoreProducts: vi.fn().mockResolvedValue([{ id: 12, storeId: 1, productId: 8 }]),
      findEffectiveCosts: vi.fn().mockResolvedValue([{ id: 31, storeProductId: 12, unitCostPaise: 6_000 }]),
      snapshotOrderItem,
    };
    const service = new CostService(repository as never);
    expect(await service.snapshotOrderItems({} as never, { orderId: 5, storeId: 1, businessDate: "2026-09-04" }))
      .toEqual([expect.objectContaining({ costVersionId: 30, lineCostPaise: 9_000 })]);
    expect(snapshotOrderItem).not.toHaveBeenCalled();
  });
});
