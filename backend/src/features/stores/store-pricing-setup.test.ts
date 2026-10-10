import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "../../db";
import { deliveryPricingRulesTable, taxRulesTable, DEMO_TAX_DISCLAIMER } from "../../db/schema";
import type { TransactionType } from "../../utils/types";
import { PricingService, type PricingRepository } from "../pricing/pricing.service";
import type { AuthPrincipal } from "../auth/auth.types";
import { StoreService } from "./stores.service";
import { initializeCheckoutPricing, planMissingPricingRule, readCheckoutPricing } from "./store-pricing-setup";

afterEach(() => vi.restoreAllMocks());
const now = new Date("2026-10-09T20:00:00Z"); // Already October 10 in Kolkata.
const store = { id: 17, timezone: "Asia/Kolkata" };
const admin: AuthPrincipal = { userId: 1, email: "admin@example.test", platformRole: "admin", tokenVersion: 0 };

function harness() {
  const delivery: Array<typeof deliveryPricingRulesTable.$inferSelect> = [];
  const taxes: Array<typeof taxRulesTable.$inferSelect> = [];
  const lock = vi.fn(async () => [store]);
  const insert = vi.fn((table) => ({ values: vi.fn(async (values) => {
    const target = table === deliveryPricingRulesTable ? delivery : taxes;
    target.push({ id: target.length + 1, isDemo: true, disclaimer: DEMO_TAX_DISCLAIMER,
      createdAt: now, updatedAt: now, ...values });
  }) }));
  const tx = {
    insert,
    select: () => ({ from: (table: unknown) => ({ where: () => table === deliveryPricingRulesTable ?
      Promise.resolve(delivery) : table === taxRulesTable ? Promise.resolve(taxes) : { for: lock } }) }),
  } as unknown as TransactionType;
  return { tx, delivery, taxes, insert, lock };
}

describe("checkout pricing initialization", () => {
  it("uses the store business date and creates all rules needed by an actual quote", async () => {
    const h = harness();
    await initializeCheckoutPricing(h.tx, store, now);
    const repository: PricingRepository = {
      findStorePricingContext: async () => ({ timezone: store.timezone, state: "Maharashtra" }),
      findDeliveryPricingRules: async () => h.delivery,
      findTaxRules: async (_id, component) => h.taxes.filter((rule) => rule.component === component),
    };
    const service = new PricingService(repository, { load: async () => ({ promotions: [], qualifyingOrderCount: 0, usageByPromotionId: {} }) });
    const { quote } = await service.buildQuote({ storeId: store.id, userId: 7, now,
      items: [{ lineId: 1, productId: 1, categoryId: 1, productName: "Demo item", quantity: 1, baseUnitPricePaise: 10000, customizations: [] }],
    });
    expect(quote.deliveryPricing.businessDate).toBe("2026-10-10");
    expect(quote.grandTotalPaise).toBe(14000);
    expect(quote.tax.itemRule.rateBps).toBe(500);
    expect(quote.tax.deliveryRule.rateBps).toBe(500);
    expect(await readCheckoutPricing(h.tx, store, now)).toMatchObject({ ready: true });
  });

  it("is idempotent and preserves custom existing delivery and item tax while filling delivery tax", async () => {
    const h = harness();
    await initializeCheckoutPricing(h.tx, store, now);
    h.delivery[0].deliveryFeePaise = 2500;
    h.taxes[0].rateBps = 1800;
    h.taxes.splice(1, 1);
    h.insert.mockClear();
    await initializeCheckoutPricing(h.tx, store, now);
    expect(h.insert).toHaveBeenCalledTimes(1);
    expect(h.delivery[0].deliveryFeePaise).toBe(2500);
    expect(h.taxes[0].rateBps).toBe(1800);
    h.insert.mockClear();
    await initializeCheckoutPricing(h.tx, store, now);
    expect(h.insert).not.toHaveBeenCalled();
  });

  it("does not insert any component when another has overlapping rules", async () => {
    const h = harness();
    await initializeCheckoutPricing(h.tx, store, now);
    h.delivery.splice(0);
    h.taxes.push({ ...h.taxes[0], id: 99, version: 2 });
    h.insert.mockClear();
    await expect(initializeCheckoutPricing(h.tx, store, now)).rejects.toMatchObject({ code: "PRICING_RULES_OVERLAP" });
    expect(h.insert).not.toHaveBeenCalled();
  });

  it("fills an expired gap without overlapping a future rule or reusing a version", () => {
    expect(planMissingPricingRule([
      { version: 2, effectiveFrom: "2026-01-01", effectiveTo: "2026-10-09" },
      { version: 7, effectiveFrom: "2026-11-01", effectiveTo: null },
    ], "2026-10-10")).toEqual({ version: 8, effectiveFrom: "2026-10-10", effectiveTo: "2026-10-31" });
  });

  it("preserves inclusive end dates and handles the day before a future start", () => {
    expect(planMissingPricingRule([{ version: 1, effectiveFrom: "2026-01-01", effectiveTo: "2026-10-10" }], "2026-10-10")).toBeNull();
    expect(planMissingPricingRule([{ version: 1, effectiveFrom: "2026-10-11", effectiveTo: null }], "2026-10-10"))
      .toMatchObject({ effectiveFrom: "2026-10-10", effectiveTo: "2026-10-10" });
  });

  it("denies non-admin reads and writes before database access", async () => {
    const transaction = vi.spyOn(db, "transaction");
    const service = new StoreService();
    const customer = { ...admin, platformRole: "user" as const };
    await expect(service.getCheckoutPricing(store.id, customer)).rejects.toMatchObject({ status: 403 });
    await expect(service.initializeCheckoutPricing(store.id, customer)).rejects.toMatchObject({ status: 403 });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("locks the store row before initializing and audits only newly created rules", async () => {
    const h = harness();
    const audit = { write: vi.fn(async () => {}) };
    vi.spyOn(db, "transaction").mockImplementation(async (callback) => callback(h.tx));
    const service = new StoreService(undefined, audit);
    await service.initializeCheckoutPricing(store.id, admin);
    expect(h.lock).toHaveBeenCalledWith("update");
    expect(audit.write).toHaveBeenCalledWith(expect.objectContaining({ storeId: store.id, action: "store.checkout_pricing.initialized" }));
    await service.initializeCheckoutPricing(store.id, admin);
    expect(audit.write).toHaveBeenCalledTimes(1);
  });

  it("returns 404 when the store does not exist", async () => {
    const h = harness(); h.lock.mockResolvedValue([]);
    vi.spyOn(db, "transaction").mockImplementation(async (callback) => callback(h.tx));
    await expect(new StoreService().initializeCheckoutPricing(store.id, admin)).rejects.toMatchObject({ status: 404 });
    expect(h.insert).not.toHaveBeenCalled();
  });
});
