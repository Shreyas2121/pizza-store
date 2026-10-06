import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addressTable,
  storesTable,
  ordersTable,
  orderItemsTable,
  orderItemCustomizationsTable,
  orderItemBundleComponentsTable,
} from "../../db/schema";
import type { TransactionType } from "../../utils/types";
import pricingService from "../pricing";
import inventoryService from "../inventory/inventory.service";
import { PromotionApplicationService } from "../promotions/applications";
import { snapshotQuote } from "../promotions/promotion-application.test-fixtures";
import { CodCheckoutService } from "./checkout-cod.service";
import { CodCheckoutRepository } from "./checkout-cod.repository";
import { publicQuoteRepository } from "./checkout.repository";
import { createOrderSchema } from "../../utils/zodSchema";

const now = new Date("2026-10-06T12:00:00Z");
const store: typeof storesTable.$inferSelect = {
  id: 1,
  name: "Store",
  slug: "store",
  address: "Street",
  city: "City",
  state: "Karnataka",
  pincode: "123456",
  phone: "1234567890",
  email: null,
  latitude: null,
  longitude: null,
  opensAt: "11:00",
  closesAt: "13:00",
  timezone: "UTC",
  isActive: true,
  createdAt: now,
  updatedAt: now,
};
const address: typeof addressTable.$inferSelect = {
  id: 2,
  userId: 7,
  type: "Home",
  street: "Street",
  city: "City",
  state: "Karnataka",
  pincode: "123456",
  phone: "1234567890",
  createdAt: now,
  updatedAt: now,
};
const cart = {
  storeId: 1,
  items: [{ id: 101, productId: 11, quantity: 2, customizationOptionIds: [5] }],
};
const harness = () => {
  const repository = new CodCheckoutRepository();
  const applications = new PromotionApplicationService();
  const quote = snapshotQuote();
  const events: string[] = [];
  vi.spyOn(repository, "lockCart").mockImplementation(async () => {
    events.push("cart");
    return cart;
  });
  vi.spyOn(repository, "lockUser").mockImplementation(async () => {
    events.push("user");
  });
  vi.spyOn(repository, "lockStore").mockImplementation(async () => {
    events.push("store");
    return { ...store };
  });
  vi.spyOn(repository, "address").mockResolvedValue(address);
  vi.spyOn(repository, "lockCatalogue").mockImplementation(async () => {
    events.push("catalogue");
  });
  vi.spyOn(publicQuoteRepository, "findStoreProducts").mockResolvedValue([
    {
      productId: 11,
      productName: "Current pizza",
      categoryId: 3,
      productType: "single",
      compareAtUnitPricePaise: null,
      pricePaise: 900,
      productIsAvailable: true,
      storeProductIsAvailable: true,
    },
  ]);
  vi.spyOn(
    publicQuoteRepository,
    "findProductCustomizationOptions",
  ).mockResolvedValue([
    {
      productId: 11,
      optionId: 5,
      optionName: "Current cheese",
      pricePaise: 100,
      isAvailable: true,
    },
  ]);
  vi.spyOn(publicQuoteRepository, "findBundleDefinitions").mockResolvedValue(
    new Map(),
  );
  vi.spyOn(inventoryService, "validateAndLockStock").mockImplementation(
    async () => {
      events.push("inventory");
      return [];
    },
  );
  vi.spyOn(pricingService, "buildQuote").mockImplementation(async () => {
    events.push("promotions");
    return { quote };
  });
  vi.spyOn(applications, "record").mockResolvedValue([]);
  // This transaction adapter implements only the inserts exercised by snapshots.
  const writes: Array<{ table: unknown; value: unknown }> = [];
  const executor = {
    insert: (table: unknown) => ({
      values: (value: unknown) => {
        writes.push({ table, value });
        return {
          returning: async () =>
            table === ordersTable ? [{ id: 42, storeId: 1 }] : [{ id: 501 }],
        };
      },
    }),
  };
  const tx = executor as unknown as TransactionType;
  return {
    service: new CodCheckoutService(
      repository,
      pricingService,
      inventoryService,
      applications,
      () => now,
    ),
    repository,
    applications,
    quote,
    tx,
    writes,
    events,
  };
};
describe("COD final checkout", () => {
  beforeEach(() => vi.restoreAllMocks());
  it("locks identities/catalogue before inventory/promotions and reprices inside the same executor", async () => {
    const h = harness();
    const result = await h.service.buildQuote(
      { userId: 7, addressId: 2 },
      h.tx,
    );
    expect(h.events).toEqual([
      "cart",
      "user",
      "store",
      "catalogue",
      "inventory",
      "promotions",
    ]);
    expect(h.repository.lockCatalogue).toHaveBeenCalledWith(1, [11], [5], h.tx);
    expect(publicQuoteRepository.findStoreProducts).toHaveBeenCalledWith(
      1,
      [11],
      h.tx,
    );
    expect(
      publicQuoteRepository.findProductCustomizationOptions,
    ).toHaveBeenCalledWith([11], [5], h.tx);
    expect(pricingService.buildQuote).toHaveBeenCalledWith(
      {
        storeId: 1,
        userId: 7,
        items: [
          expect.objectContaining({
            lineId: 101,
            categoryId: 3,
            baseUnitPricePaise: 900,
            customizations: [
              {
                customizationOptionId: 5,
                name: "Current cheese",
                pricePaise: 100,
              },
            ],
          }),
        ],
        couponCode: undefined,
        destinationState: "Karnataka",
        now,
      },
      { executor: h.tx, lockPromotions: true },
    );
    expect(result.totalPaise).toBe(1800);
    expect(result.now).toBe(now);
  });
  it("uses the locked store timezone and rejects closed stores before catalogue reads", async () => {
    const h = harness();
    vi.mocked(h.repository.lockStore).mockResolvedValue({
      ...store,
      timezone: "Asia/Kolkata",
    });
    await expect(
      h.service.buildQuote({ userId: 7, addressId: 2 }, h.tx),
    ).rejects.toMatchObject({ code: "STORE_CLOSED" });
    expect(h.repository.lockCatalogue).not.toHaveBeenCalled();
    expect(pricingService.buildQuote).not.toHaveBeenCalled();
  });
  it.each(["address", "inventory", "promotion"])(
    "propagates %s failures before order persistence",
    async (failure) => {
      const h = harness();
      if (failure === "address")
        vi.mocked(h.repository.address).mockRejectedValue(
          new Error("checkout failed"),
        );
      if (failure === "inventory")
        vi.mocked(inventoryService.validateAndLockStock).mockRejectedValue(
          new Error("checkout failed"),
        );
      if (failure === "promotion")
        vi.mocked(pricingService.buildQuote).mockRejectedValue(
          new Error("checkout failed"),
        );
      await expect(
        h.service.buildQuote({ userId: 7, addressId: 2 }, h.tx),
      ).rejects.toThrow("checkout failed");
      expect(h.writes).toEqual([]);
    },
  );
  it("persists item/delivery tax and immutable discount mode, then consumes exact applications using order-item IDs", async () => {
    const h = harness();
    const quote = await h.service.buildQuote({ userId: 7, addressId: 2 }, h.tx);
    await h.service.createOrderSnapshot(
      quote,
      {
        userId: 7,
        addressId: 2,
        paymentId: 8,
        paymentType: "cash",
        status: "pending",
      },
      h.tx,
    );
    expect(h.writes[0]).toMatchObject({
      table: ordersTable,
      value: {
        discountMode: "automatic_deals",
        discountPaise: 200,
        deliveryFeePaise: 0,
        grandTotalPaise: 1800,
        pricingPolicyVersion: 4,
        taxPaise: 86,
        pricingTimezone: "UTC",
        status: "pending",
      },
    });
    expect(h.writes[0].value).not.toHaveProperty("couponId");
    expect(h.writes[1]).toMatchObject({
      table: orderItemsTable,
      value: {
        discountAllocationPaise: 200,
        lineTotalPaise: 1800,
        productName: "Pizza snapshot",
        unitPricePaise: 1000,
      },
    });
    expect(h.writes[2]).toMatchObject({
      table: orderItemCustomizationsTable,
      value: [
        {
          orderItemId: 501,
          customizationName: "Cheese snapshot",
          pricePaise: 100,
        },
      ],
    });
    expect(h.applications.record).toHaveBeenCalledWith(
      42,
      h.quote,
      new Map([[101, 501]]),
      "consumed",
      h.tx,
      now,
    );
  });
  it("snapshots bundle compare-at/components while excluding markdown from order discounts", async () => {
    const h = harness();
    h.quote.items[0] = {
      ...h.quote.items[0],
      productType: "bundle",
      customizations: [],
      compareAtUnitPricePaise: 1500,
      bundleMarkdownPaise: 1000,
      bundleComponents: [
        {
          productId: 21,
          name: "Drink snapshot",
          quantityPerBundle: 2,
          totalQuantity: 4,
          isAvailable: true,
        },
      ],
    };
    const quote = await h.service.buildQuote({ userId: 7, addressId: 2 }, h.tx);
    await h.service.createOrderSnapshot(
      quote,
      {
        userId: 7,
        addressId: 2,
        paymentId: 8,
        paymentType: "cash",
        status: "pending",
      },
      h.tx,
    );
    expect(h.writes[0]).toMatchObject({ value: { discountPaise: 200 } });
    expect(h.writes[1]).toMatchObject({
      value: {
        productType: "bundle",
        compareAtUnitPricePaise: 1500,
        bundleMarkdownPaise: 1000,
      },
    });
    expect(h.writes[2]).toMatchObject({
      table: orderItemBundleComponentsTable,
      value: [
        {
          orderItemId: 501,
          componentProductId: 21,
          componentName: "Drink snapshot",
          quantityPerBundle: 2,
          totalQuantity: 4,
        },
      ],
    });
  });
  it("rejects caller offer IDs/prices and enforces coupon normalization after uppercase expansion", () => {
    expect(
      createOrderSchema.parse({ addressId: 2, couponCode: "  save  " })
        .couponCode,
    ).toBe("SAVE");
    for (const extra of [
      { offerId: 10 },
      { totalPaise: 1 },
      { discountMode: "coupon" },
    ])
      expect(
        createOrderSchema.safeParse({ addressId: 2, ...extra }).success,
      ).toBe(false);
    expect(
      createOrderSchema.safeParse({ addressId: 2, couponCode: "ß".repeat(64) })
        .success,
    ).toBe(false);
  });
});
