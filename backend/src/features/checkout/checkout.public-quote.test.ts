import { beforeEach, describe, expect, it, vi } from "vitest";
import pricingService, { type PricingQuote } from "../pricing/pricing.service";
import { publicQuoteRepository } from "./checkout.repository";
import checkoutService from "./checkout.service";
import { checkoutQuoteSchema } from "../../utils/zodSchema";

const validQuote: PricingQuote = {
  quoteVersion: "2026-09-12-03",
  currency: "INR",
  pricingPolicyVersion: 4,
  itemsSubtotalPaise: 42_000,
  discountMode: "none",
  itemDiscountPaise: 0,
  standardDeliveryFeePaise: 4_000,
  deliveryDiscountPaise: 0,
  promotionSavingsPaise: 0,
  bundleMarkdownPaise: 0,
  totalDisplayedSavingsPaise: 0,
  promotions: [],
  couponEligibility: {
    eligible: true,
    reasonCode: null,
    conflictingLineIds: [],
  },
  chargedDeliveryFeePaise: 4_000,
  roundingAdjustmentPaise: 0,
  grandTotalPaise: 46_000,
  taxableAmountPaise: 42_966,
  taxPaise: 3_034,
  items: [],
  deliveryPricing: {
    ruleId: 11,
    ruleVersion: 1,
    storeId: 1,
    businessDate: "2026-09-11",
    timezone: "Asia/Kolkata",
    standardFeePaise: 4_000,
    chargedFeePaise: 4_000,
  },
  tax: {
    calculationPolicyVersion: 1,
    isDemo: true,
    disclaimer: "Portfolio demo — not a statutory tax invoice",
    placeOfSupplyState: "Karnataka",
    placeOfSupplySource: "delivery_address",
    itemRule: {
      ruleId: 21,
      ruleVersion: 2,
      rateBps: 500,
      hsnSacCode: "21069099-DEMO",
    },
    deliveryRule: {
      ruleId: 22,
      ruleVersion: 2,
      rateBps: 1800,
      hsnSacCode: "996813-DEMO",
      taxableAmountPaise: 3_390,
      taxPaise: 610,
    },
  },
};

const availableStoreProduct = {
  productId: 1,
  productName: "Margherita",
  pricePaise: 42_000,
  categoryId: 5,
  productType: "single" as const,
  compareAtUnitPricePaise: null,
  productIsAvailable: true,
  storeProductIsAvailable: true,
};

describe("CheckoutService public quote authorization and catalogue validation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects store overrides for an owned cart before reading prices", async () => {
    vi.spyOn(publicQuoteRepository, "findOwnedCart").mockResolvedValue({
      storeId: 2,
      items: [{ id: 1, productId: 1, quantity: 1, customizationOptionIds: [] }],
    });
    const products = vi.spyOn(publicQuoteRepository, "findStoreProducts");
    await expect(
      checkoutService.calculatePublicQuote({ userId: 7, storeId: 1 }),
    ).rejects.toMatchObject({ code: "CART_STORE_MISMATCH" });
    expect(products).not.toHaveBeenCalled();
  });
  it("rejects caller prices, categories, offer IDs and malformed normalized codes", () => {
    for (const field of [
      "pricePaise",
      "categoryId",
      "discountPaise",
      "offerId",
    ]) {
      expect(
        checkoutQuoteSchema.safeParse({
          storeId: 1,
          items: [{ productId: 1, quantity: 1, [field]: 7 }],
        }).success,
      ).toBe(false);
    }
    expect(
      checkoutQuoteSchema.safeParse({ storeId: 1, offerId: 1 }).success,
    ).toBe(false);
    expect(
      checkoutQuoteSchema.safeParse({ storeId: 1, couponCode: "ß".repeat(64) })
        .success,
    ).toBe(false);
    expect(
      checkoutQuoteSchema.safeParse({ storeId: 1, items: [] }).success,
    ).toBe(false);
  });
  it("loads bundle selling price, compare-at and components in one batch", async () => {
    vi.spyOn(publicQuoteRepository, "findStoreProducts").mockResolvedValue([
      {
        ...availableStoreProduct,
        productType: "bundle",
        compareAtUnitPricePaise: 50_000,
      },
    ]);
    const definitions = vi
      .spyOn(publicQuoteRepository, "findBundleDefinitions")
      .mockResolvedValue(
        new Map([
          [
            1,
            {
              bundleProductId: 1,
              bundleName: "Combo",
              components: [
                {
                  productId: 20,
                  name: "Drink",
                  quantityPerBundle: 2,
                  isAvailable: true,
                },
              ],
            },
          ],
        ]),
      );
    const pricing = vi
      .spyOn(pricingService, "buildQuote")
      .mockResolvedValue({ quote: validQuote });
    await checkoutService.calculatePublicQuote({
      storeId: 1,
      items: [{ productId: 1, quantity: 3 }],
    });
    expect(definitions).toHaveBeenCalledWith(1, [1]);
    expect(pricing).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [
          expect.objectContaining({
            productType: "bundle",
            baseUnitPricePaise: 42_000,
            compareAtUnitPricePaise: 50_000,
            bundleComponents: [
              {
                productId: 20,
                name: "Drink",
                quantityPerBundle: 2,
                totalQuantity: 6,
                isAvailable: true,
              },
            ],
          }),
        ],
      }),
    );
  });
  it("rejects bundles with unavailable components", async () => {
    vi.spyOn(publicQuoteRepository, "findStoreProducts").mockResolvedValue([
      {
        ...availableStoreProduct,
        productType: "bundle",
        compareAtUnitPricePaise: 50_000,
      },
    ]);
    vi.spyOn(publicQuoteRepository, "findBundleDefinitions").mockResolvedValue(
      new Map([
        [
          1,
          {
            bundleProductId: 1,
            bundleName: "Combo",
            components: [
              {
                productId: 20,
                name: "Drink",
                quantityPerBundle: 1,
                isAvailable: false,
              },
            ],
          },
        ],
      ]),
    );
    await expect(
      checkoutService.calculatePublicQuote({
        storeId: 1,
        items: [{ productId: 1, quantity: 1 }],
      }),
    ).rejects.toMatchObject({ code: "BUNDLE_DEFINITION_INVALID" });
  });
  it("rejects repeated customization IDs rather than charging them twice", async () => {
    vi.spyOn(publicQuoteRepository, "findStoreProducts").mockResolvedValue([
      availableStoreProduct,
    ]);
    vi.spyOn(
      publicQuoteRepository,
      "findProductCustomizationOptions",
    ).mockResolvedValue([]);
    await expect(
      checkoutService.calculatePublicQuote({
        storeId: 1,
        items: [{ productId: 1, quantity: 1, customizationOptionIds: [7, 7] }],
      }),
    ).rejects.toMatchObject({ code: "PRODUCT_CUSTOMIZATION_UNAVAILABLE" });
  });

  it("rejects an address ID when the quote is anonymous", async () => {
    const addressSpy = vi.spyOn(publicQuoteRepository, "findAddressState");

    await expect(
      checkoutService.calculatePublicQuote({
        storeId: 1,
        addressId: 12,
        items: [{ productId: 1, quantity: 1 }],
      }),
    ).rejects.toMatchObject({
      status: 401,
      code: "ADDRESS_AUTHENTICATION_REQUIRED",
    });
    expect(addressSpy).not.toHaveBeenCalled();
  });

  it("does not resolve an address that is outside the authenticated user scope", async () => {
    vi.spyOn(publicQuoteRepository, "findAddressState").mockResolvedValue(
      undefined,
    );

    await expect(
      checkoutService.calculatePublicQuote({
        storeId: 1,
        userId: 7,
        addressId: 12,
        items: [{ productId: 1, quantity: 1 }],
      }),
    ).rejects.toMatchObject({
      status: 404,
      message: "Delivery address not found",
    });
    expect(publicQuoteRepository.findAddressState).toHaveBeenCalledWith(12, 7);
  });

  it("rejects a product that is not mapped to the selected store", async () => {
    vi.spyOn(publicQuoteRepository, "findStoreProducts").mockResolvedValue([]);

    await expect(
      checkoutService.calculatePublicQuote({
        storeId: 1,
        destinationState: "Karnataka",
        items: [{ productId: 1, quantity: 1 }],
      }),
    ).rejects.toMatchObject({
      status: 409,
      code: "STORE_PRODUCT_UNAVAILABLE",
    });
  });

  it.each([
    { productIsAvailable: false, storeProductIsAvailable: true },
    { productIsAvailable: true, storeProductIsAvailable: false },
  ])(
    "rejects an unavailable catalogue or store product",
    async (availability) => {
      vi.spyOn(publicQuoteRepository, "findStoreProducts").mockResolvedValue([
        { ...availableStoreProduct, ...availability },
      ]);

      await expect(
        checkoutService.calculatePublicQuote({
          storeId: 1,
          destinationState: "Karnataka",
          items: [{ productId: 1, quantity: 1 }],
        }),
      ).rejects.toMatchObject({
        status: 409,
        code: "STORE_PRODUCT_UNAVAILABLE",
      });
    },
  );

  it("rejects a customization option that is not mapped to the product", async () => {
    vi.spyOn(publicQuoteRepository, "findStoreProducts").mockResolvedValue([
      availableStoreProduct,
    ]);
    vi.spyOn(
      publicQuoteRepository,
      "findProductCustomizationOptions",
    ).mockResolvedValue([]);

    await expect(
      checkoutService.calculatePublicQuote({
        storeId: 1,
        destinationState: "Karnataka",
        items: [
          {
            productId: 1,
            quantity: 1,
            customizationOptionIds: [101],
          },
        ],
      }),
    ).rejects.toMatchObject({
      status: 409,
      code: "PRODUCT_CUSTOMIZATION_UNAVAILABLE",
    });
  });

  it("rejects an unavailable customization option", async () => {
    vi.spyOn(publicQuoteRepository, "findStoreProducts").mockResolvedValue([
      availableStoreProduct,
    ]);
    vi.spyOn(
      publicQuoteRepository,
      "findProductCustomizationOptions",
    ).mockResolvedValue([
      {
        productId: 1,
        optionId: 101,
        optionName: "Extra Cheese",
        pricePaise: 5_000,
        isAvailable: false,
      },
    ]);

    await expect(
      checkoutService.calculatePublicQuote({
        storeId: 1,
        destinationState: "Karnataka",
        items: [
          {
            productId: 1,
            quantity: 1,
            customizationOptionIds: [101],
          },
        ],
      }),
    ).rejects.toMatchObject({
      status: 409,
      code: "PRODUCT_CUSTOMIZATION_UNAVAILABLE",
    });
  });

  it("accepts an anonymous destination-state quote at the store price", async () => {
    vi.spyOn(publicQuoteRepository, "findStoreProducts").mockResolvedValue([
      availableStoreProduct,
    ]);
    const buildQuoteSpy = vi
      .spyOn(pricingService, "buildQuote")
      .mockResolvedValue({ quote: validQuote });

    const result = await checkoutService.calculatePublicQuote({
      storeId: 1,
      destinationState: " Karnataka ",
      items: [{ productId: 1, quantity: 1 }],
    });

    expect(result).toEqual(validQuote);
    expect(buildQuoteSpy).toHaveBeenCalledWith({
      storeId: 1,
      userId: undefined,
      items: [
        {
          lineId: 1,
          productId: 1,
          productName: "Margherita",
          categoryId: 5,
          productType: "single",
          compareAtUnitPricePaise: null,
          bundleComponents: [],
          quantity: 1,
          baseUnitPricePaise: 42_000,
          customizations: [],
        },
      ],
      couponCode: undefined,
      destinationState: "Karnataka",
    });
  });
});

describe("CheckoutService calculatePublicQuote", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("validates a manual code using the owned cart store and v4 quote", async () => {
    vi.spyOn(publicQuoteRepository, "findOwnedCart").mockResolvedValue({
      storeId: 2, items: [{ id: 101, productId: 1, quantity: 1, customizationOptionIds: [] }],
    });
    const quote = vi.spyOn(checkoutService, "calculatePublicQuote").mockResolvedValue(validQuote);
    await expect(checkoutService.previewPromotionCoupon(7, "SAVE")).resolves.toEqual(validQuote);
    expect(quote).toHaveBeenCalledWith({ userId: 7, storeId: 2, couponCode: "SAVE" });
  });

  it.each([undefined, { storeId: 2, items: [] }])("rejects manual validation without an owned populated cart", async (cart) => {
    vi.spyOn(publicQuoteRepository, "findOwnedCart").mockResolvedValue(cart);
    const quote = vi.spyOn(checkoutService, "calculatePublicQuote");
    await expect(checkoutService.previewPromotionCoupon(7, "SAVE")).rejects.toMatchObject({ code: "CART_EMPTY", status: 400 });
    expect(quote).not.toHaveBeenCalled();
  });

  it("calculates authoritative quote from provided items and customization options", async () => {
    const mockQuote = validQuote;

    const buildQuoteSpy = vi
      .spyOn(pricingService, "buildQuote")
      .mockResolvedValue({
        quote: mockQuote,
      });

    vi.spyOn(publicQuoteRepository, "findStoreProducts").mockResolvedValue([
      {
        productId: 1,
        productName: "Margherita",
        pricePaise: 37_000,
        categoryId: 5,
        productType: "single",
        compareAtUnitPricePaise: null,
        productIsAvailable: true,
        storeProductIsAvailable: true,
      },
    ]);
    vi.spyOn(
      publicQuoteRepository,
      "findProductCustomizationOptions",
    ).mockResolvedValue([
      {
        productId: 1,
        optionId: 101,
        optionName: "Extra Cheese",
        pricePaise: 5_000,
        isAvailable: true,
      },
    ]);

    const result = await checkoutService.calculatePublicQuote({
      storeId: 1,
      couponCode: "SAVE50",
      destinationState: "Karnataka",
      items: [
        {
          productId: 1,
          quantity: 1,
          customizationOptionIds: [101],
        },
      ],
    });

    expect(result).toEqual(mockQuote);
    expect(buildQuoteSpy).toHaveBeenCalledWith({
      storeId: 1,
      userId: undefined,
      items: [
        {
          lineId: 1,
          productId: 1,
          productName: "Margherita",
          categoryId: 5,
          productType: "single",
          compareAtUnitPricePaise: null,
          bundleComponents: [],
          quantity: 1,
          baseUnitPricePaise: 37_000,
          customizations: [
            {
              customizationOptionId: 101,
              name: "Extra Cheese",
              pricePaise: 5_000,
            },
          ],
        },
      ],
      couponCode: "SAVE50",
      destinationState: "Karnataka",
    });
  });

  it("calculates authoritative quote from user cart when items are omitted", async () => {
    vi.spyOn(publicQuoteRepository, "findOwnedCart").mockResolvedValue({
      storeId: 2,
      items: [
        { id: 101, productId: 1, quantity: 2, customizationOptionIds: [] },
      ],
    });
    vi.spyOn(publicQuoteRepository, "findStoreProducts").mockResolvedValue([
      {
        productId: 1,
        productName: "Margherita",
        categoryId: 5,
        pricePaise: 25_000,
        productType: "single",
        compareAtUnitPricePaise: null,
        productIsAvailable: true,
        storeProductIsAvailable: true,
      },
    ]);
    const buildQuoteSpy = vi
      .spyOn(pricingService, "buildQuote")
      .mockResolvedValue({
        quote: validQuote,
      });

    const result = await checkoutService.calculatePublicQuote({
      storeId: 2,
      userId: 10,
    });

    expect(result.grandTotalPaise).toBe(validQuote.grandTotalPaise);
    expect(buildQuoteSpy).toHaveBeenCalledWith({
      storeId: 2,
      userId: 10,
      items: [
        {
          lineId: 101,
          productId: 1,
          productName: "Margherita",
          categoryId: 5,
          productType: "single",
          compareAtUnitPricePaise: null,
          bundleComponents: [],
          quantity: 2,
          baseUnitPricePaise: 25_000,
          customizations: [],
        },
      ],
      couponCode: undefined,
      destinationState: null,
    });
  });

  it("throws 400 when items are omitted and user has no active cart", async () => {
    vi.spyOn(publicQuoteRepository, "findOwnedCart").mockResolvedValue(
      undefined,
    );

    await expect(
      checkoutService.calculatePublicQuote({
        storeId: 1,
        userId: 10,
      }),
    ).rejects.toMatchObject({
      message: "Cart is empty",
      status: 400,
    });
  });
});
