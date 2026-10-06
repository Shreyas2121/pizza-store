import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TransactionType } from "../../utils/types";
import type { PromotionRow } from "./promotion.mapper";
import {
  PromotionApplicationRepository,
  type ApplicationRow,
  type AllocationWrite,
} from "./promotion-application.repository";
import { PromotionApplicationService } from "./promotion-application.service";
import { snapshotQuote } from "./promotion-application.test-fixtures";

const now = new Date("2026-10-06T12:00:00Z");
// Repository methods are stubbed below; this token proves executor propagation.
const tx = {} as TransactionType;
const definition = (id: number): PromotionRow => ({
  id,
  definitionVersion: id === 10 ? 3 : 4,
  kind: "offer",
  name: id === 10 ? "Food snapshot" : "Delivery snapshot",
  description: "Current description",
  code: null,
  discountType: id === 10 ? "fixed_amount" : "free_delivery",
  discountRateBps: null,
  discountAmountPaise: id === 10 ? 200 : null,
  maxDiscountPaise: null,
  scope: id === 10 ? "cart" : "delivery",
  includeCustomizationValue: false,
  minimumOrderPaise: 0,
  minimumCartQuantity: 0,
  firstOrderOnly: false,
  startsAt: new Date("2026-01-01"),
  endsAt: new Date("2027-01-01"),
  activeDaysOfWeek: null,
  activeStartTime: null,
  activeEndTime: null,
  perUserRedemptionLimit: null,
  maxRedemptions: null,
  totalDiscountBudgetPaise: null,
  displayPriority: 0,
  imageUrl: null,
  mobileImageUrl: null,
  imageAlt: null,
  showOnHomepage: false,
  isActive: true,
  createdAt: now,
  updatedAt: now,
});
const harness = () => {
  const repository = new PromotionApplicationRepository();
  const quote = snapshotQuote();
  const owner = {
    id: 42,
    userId: 7,
    storeId: 1,
    discountMode: quote.discountMode,
    discountPaise: 200,
    deliveryFeePaise: 0,
    grandTotalPaise: 1800,
  };
  let rows: ApplicationRow[] = [];
  const allocations: Array<AllocationWrite & { id: number; createdAt: Date }> =
    [];
  const definitions = {
    promotions: [definition(10), definition(20)],
    settings: [],
  };
  vi.spyOn(repository, "lockOwner").mockResolvedValue(owner);
  vi.spyOn(repository, "lockDefinitions").mockResolvedValue(definitions);
  vi.spyOn(repository, "applications").mockImplementation(async () =>
    rows.map((row) => ({ ...row })),
  );
  vi.spyOn(repository, "usage").mockResolvedValue([]);
  vi.spyOn(repository, "insert").mockImplementation(async (writes) => {
    rows = writes.map(
      (write, index): ApplicationRow => ({
        ...write,
        id: 80 + index,
        promotionCode: write.promotionCode ?? null,
        reservedAt: write.reservedAt ?? null,
        consumedAt: write.consumedAt ?? null,
        releasedAt: write.releasedAt ?? null,
        createdAt: now,
        updatedAt: now,
      }),
    );
    return [...rows].reverse(); // RETURNING order must not define allocation ownership.
  });
  vi.spyOn(repository, "insertAllocations").mockImplementation(
    async (writes) => {
      allocations.push(
        ...writes.map((write, index) => ({
          ...write,
          id: index + 1,
          orderItemId: write.orderItemId ?? null,
          unitIndex: write.unitIndex ?? null,
          createdAt: now,
        })),
      );
    },
  );
  vi.spyOn(repository, "allocations").mockImplementation(async () =>
    allocations.map((a) => ({
      ...a,
      orderItemId: a.orderItemId ?? null,
      unitIndex: a.unitIndex ?? null,
    })),
  );
  vi.spyOn(repository, "transition").mockImplementation(
    async (ids, from, to, time) => {
      rows = rows.map((row) =>
        ids.includes(row.id) && row.status === from
          ? {
              ...row,
              status: to,
              updatedAt: time,
              consumedAt: to === "consumed" ? time : null,
              releasedAt: to === "released" ? time : null,
              reservedAt: to === "reserved" ? time : row.reservedAt,
            }
          : row,
      );
    },
  );
  const service = new PromotionApplicationService(repository, () => now);
  return {
    service,
    repository,
    quote,
    owner,
    definitions,
    allocations,
    rows: () => rows,
    replace: (next: ApplicationRow[]) => {
      rows = next;
    },
    itemIds: new Map([[101, 501]]),
  };
};

describe("immutable promotion application collections", () => {
  beforeEach(() => vi.restoreAllMocks());
  it("records exact COD snapshots and maps reversed insert results by promotion ID", async () => {
    const h = harness();
    await h.service.record(42, h.quote, h.itemIds, "consumed", tx);
    expect(h.rows()).toMatchObject([
      {
        promotionId: 10,
        promotionName: "Food snapshot",
        definitionVersion: 3,
        status: "consumed",
        consumedAt: now,
        reservedAt: null,
        itemDiscountPaise: 200,
        deliveryDiscountPaise: 0,
      },
      { promotionId: 20, status: "consumed", totalSavingsPaise: 500 },
    ]);
    expect(h.allocations).toMatchObject([
      {
        promotionApplicationId: 81,
        component: "delivery",
        orderItemId: null,
        unitIndex: null,
        amountPaise: 500,
      },
      {
        promotionApplicationId: 80,
        orderItemId: 501,
        unitIndex: 0,
        amountPaise: 100,
      },
      {
        promotionApplicationId: 80,
        orderItemId: 501,
        unitIndex: 1,
        amountPaise: 100,
      },
    ]);
    expect(h.repository.lockDefinitions).toHaveBeenCalledWith([10, 20], 1, tx);
    expect(h.repository.usage).toHaveBeenCalledWith([10, 20], 7, tx);
  });
  it("repeating record verifies every snapshot/allocation without rewriting or charging capacity", async () => {
    const h = harness();
    await h.service.record(42, h.quote, h.itemIds, "consumed", tx);
    h.definitions.promotions[0].isActive = false;
    await h.service.record(42, h.quote, h.itemIds, "consumed", tx);
    expect(h.repository.insert).toHaveBeenCalledTimes(1);
    expect(h.repository.usage).toHaveBeenCalledTimes(1);
    h.allocations[1].amountPaise++;
    await expect(
      h.service.record(42, h.quote, h.itemIds, "consumed", tx),
    ).rejects.toMatchObject({ code: "PROMOTION_APPLICATION_MISMATCH" });
  });
  it("rejects changed or partial collections instead of filling gaps", async () => {
    const h = harness();
    await h.service.record(42, h.quote, h.itemIds, "reserved", tx);
    h.quote.promotions[0].name = "New snapshot";
    await expect(
      h.service.record(42, h.quote, h.itemIds, "reserved", tx),
    ).rejects.toMatchObject({ code: "PROMOTION_APPLICATION_MISMATCH" });
    h.replace(h.rows().slice(0, 1));
    await expect(
      h.service.record(42, h.quote, h.itemIds, "reserved", tx),
    ).rejects.toMatchObject({ code: "PROMOTION_APPLICATION_MISMATCH" });
    expect(h.repository.insert).toHaveBeenCalledTimes(1);
  });
  it.each(["maximum", "per-user", "budget"])(
    "checks %s capacity using occupied application aggregates before inserting",
    async (limit) => {
      const h = harness();
      const p = h.definitions.promotions[0];
      if (limit === "maximum") p.maxRedemptions = 2;
      if (limit === "per-user") p.perUserRedemptionLimit = 1;
      if (limit === "budget") p.totalDiscountBudgetPaise = 1000;
      vi.mocked(h.repository.usage).mockResolvedValue([
        { promotionId: 10, count: "2", userCount: "1", budget: "801" },
      ]);
      await expect(
        h.service.record(42, h.quote, h.itemIds, "consumed", tx),
      ).rejects.toMatchObject({
        code:
          limit === "budget"
            ? "PROMOTION_BUDGET_EXHAUSTED"
            : "PROMOTION_CAPACITY_EXHAUSTED",
      });
      expect(h.repository.insert).not.toHaveBeenCalled();
    },
  );
  it("permits exact budget remainder and nullable limits, including huge lifetime aggregates", async () => {
    const h = harness();
    h.definitions.promotions[0].totalDiscountBudgetPaise = 1000;
    vi.mocked(h.repository.usage).mockResolvedValue([
      {
        promotionId: 10,
        count: "9007199254740993123456",
        userCount: "9007199254740993123456",
        budget: "800",
      },
    ]);
    await h.service.record(42, h.quote, h.itemIds, "consumed", tx);
    expect(h.rows()).toHaveLength(2);
  });
  it("releases and restores the full collection idempotently without repricing edited definitions", async () => {
    const h = harness();
    await h.service.record(42, h.quote, h.itemIds, "reserved", tx);
    await h.service.release(42, tx);
    await h.service.release(42, tx);
    expect(h.rows().every((row) => row.status === "released")).toBe(true);
    h.definitions.promotions.forEach((p) => {
      p.isActive = false;
      p.endsAt = new Date("2020-01-01");
      p.definitionVersion++;
    });
    await h.service.restore(42, tx);
    await h.service.restore(42, tx);
    expect(h.rows()).toMatchObject([
      {
        status: "reserved",
        promotionName: "Food snapshot",
        definitionVersion: 3,
      },
      { status: "reserved", definitionVersion: 4 },
    ]);
    expect(
      vi.mocked(h.repository.transition).mock.calls.map((call) => call[0]),
    ).toEqual([[80, 81], [], [80, 81], []]);
  });
  it("does not partially restore when one member has no capacity", async () => {
    const h = harness();
    await h.service.record(42, h.quote, h.itemIds, "reserved", tx);
    await h.service.release(42, tx);
    h.definitions.promotions[1].totalDiscountBudgetPaise = 499;
    const calls = vi.mocked(h.repository.transition).mock.calls.length;
    await expect(h.service.restore(42, tx)).rejects.toMatchObject({
      code: "PROMOTION_BUDGET_EXHAUSTED",
    });
    expect(h.repository.transition).toHaveBeenCalledTimes(calls);
    expect(h.rows().every((row) => row.status === "released")).toBe(true);
  });
  it("consumes once and keeps consumed COD usage occupied after release/cancellation", async () => {
    const h = harness();
    await h.service.record(42, h.quote, h.itemIds, "reserved", tx);
    await h.service.consume(42, tx);
    await h.service.consume(42, tx);
    await h.service.release(42, tx);
    expect(h.rows().every((row) => row.status === "consumed")).toBe(true);
    await expect(h.service.restore(42, tx)).rejects.toMatchObject({
      code: "PROMOTION_ALREADY_CONSUMED",
    });
  });
  it("cannot consume a released collection or an incomplete coupon collection", async () => {
    const h = harness();
    await h.service.record(42, h.quote, h.itemIds, "reserved", tx);
    await h.service.release(42, tx);
    await expect(h.service.consume(42, tx)).rejects.toMatchObject({
      code: "PROMOTION_RESERVATION_RELEASED",
    });
    h.owner.discountMode = "coupon";
    await expect(h.service.consume(42, tx)).rejects.toMatchObject({
      code: "PROMOTION_APPLICATION_MISMATCH",
    });
  });
  it.each(["unit", "sum", "mapping", "mode", "scope"])(
    "rejects invalid %s snapshots before persistence",
    async (fault) => {
      const h = harness();
      if (fault === "unit")
        h.quote.promotions[0].allocations[1].unitIndexes = [0];
      if (fault === "sum") h.quote.promotions[0].allocations[0].amountPaise++;
      if (fault === "mapping") h.itemIds.clear();
      if (fault === "mode") h.quote.discountMode = "coupon";
      if (fault === "scope") h.owner.storeId = 2;
      await expect(
        h.service.record(42, h.quote, h.itemIds, "consumed", tx),
      ).rejects.toMatchObject({ code: "PROMOTION_APPLICATION_MISMATCH" });
      expect(h.repository.insert).not.toHaveBeenCalled();
    },
  );
  it("propagates allocation persistence failure to roll back the caller's transaction", async () => {
    const h = harness();
    vi.mocked(h.repository.insertAllocations).mockRejectedValue(
      new Error("allocation persistence failed"),
    );
    await expect(
      h.service.record(42, h.quote, h.itemIds, "consumed", tx),
    ).rejects.toThrow("allocation persistence failed");
  });
  it("records exactly one manual coupon and keeps its normalized code", async () => {
    const h = harness();
    h.quote.discountMode = h.owner.discountMode = "coupon";
    h.quote.promotions = [
      { ...h.quote.promotions[0], kind: "coupon", code: "SAVE" },
    ];
    h.definitions.promotions[0].kind = "coupon";
    h.definitions.promotions[0].code = "SAVE";
    h.quote.deliveryDiscountPaise = 0;
    h.quote.chargedDeliveryFeePaise = h.owner.deliveryFeePaise = 500;
    h.quote.grandTotalPaise = h.owner.grandTotalPaise = 2300;
    h.quote.promotionSavingsPaise = 200;
    await h.service.record(42, h.quote, h.itemIds, "consumed", tx);
    expect(h.rows()).toMatchObject([
      {
        promotionKind: "coupon",
        promotionCode: "SAVE",
        totalSavingsPaise: 200,
      },
    ]);
    expect(h.rows()).toHaveLength(1);
  });
  it.each(["none", "automatic_deals"] as const)(
    "handles zero promotion applications in %s mode",
    async (mode) => {
      const h = harness();
      h.quote.discountMode = h.owner.discountMode = mode;
      h.quote.promotions = [];
      h.quote.itemDiscountPaise =
        h.owner.discountPaise =
        h.quote.items[0].itemDiscountPaise =
          0;
      h.quote.deliveryDiscountPaise = h.quote.promotionSavingsPaise = 0;
      h.quote.chargedDeliveryFeePaise = h.owner.deliveryFeePaise = 500;
      h.quote.grandTotalPaise = h.owner.grandTotalPaise = 2500;
      if (mode === "automatic_deals") h.quote.items[0].productType = "bundle";
      await h.service.record(42, h.quote, h.itemIds, "consumed", tx);
      await h.service.release(42, tx);
      await h.service.consume(42, tx);
      await h.service.restore(42, tx);
      expect(h.rows()).toEqual([]);
      expect(h.allocations).toEqual([]);
    },
  );
  it.each(["inactive", "version", "store"])(
    "rejects %s changes before recording fresh snapshots",
    async (change) => {
      const h = harness();
      if (change === "inactive") h.definitions.promotions[0].isActive = false;
      if (change === "version") h.definitions.promotions[0].definitionVersion++;
      if (change === "store")
        vi.mocked(h.repository.lockDefinitions).mockResolvedValue({
          ...h.definitions,
          settings: [
            {
              id: 1,
              promotionId: 10,
              storeId: 1,
              isEnabled: false,
              disabledReason: "Disabled",
              updatedByUserId: 8,
              createdAt: now,
              updatedAt: now,
            },
          ],
        });
      await expect(
        h.service.record(42, h.quote, h.itemIds, "consumed", tx),
      ).rejects.toMatchObject({ code: "PROMOTION_VERSION_CONFLICT" });
      expect(h.repository.insert).not.toHaveBeenCalled();
    },
  );
  it("rejects allocation loss before consuming a captured collection", async () => {
    const h = harness();
    await h.service.record(42, h.quote, h.itemIds, "reserved", tx);
    h.allocations.pop();
    await expect(h.service.consume(42, tx)).rejects.toMatchObject({
      code: "PROMOTION_APPLICATION_MISMATCH",
    });
    expect(h.repository.transition).not.toHaveBeenCalled();
  });
});
