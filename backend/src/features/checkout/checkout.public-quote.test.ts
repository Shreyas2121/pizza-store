import { beforeEach, describe, expect, it, vi } from "vitest";
import pricingService, { type PricingQuote } from "../pricing/pricing.service";
import { publicQuoteRepository } from "./checkout.repository";
import checkoutService from "./checkout.service";

const validQuote: PricingQuote = {
  quoteVersion: "2026-09-01-02",
  currency: "INR",
  pricingPolicyVersion: 3,
  itemsSubtotalPaise: 42_000,
  discountPaise: 0,
  deliveryFeePaise: 4_000,
  roundingAdjustmentPaise: 0,
  grandTotalPaise: 46_000,
  taxableAmountPaise: 42_966,
  taxPaise: 3_034,
  items: [],
  coupon: null,
  deliveryPricing: {
    ruleId: 11,
    ruleVersion: 1,
    storeId: 1,
    businessDate: "2026-09-11",
    timezone: "Asia/Kolkata",
    standardFeePaise: 4_000,
    freeDeliveryThresholdPaise: null,
    freeDeliveryApplied: false,
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
  productIsAvailable: true,
  storeProductIsAvailable: true,
};

describe("CheckoutService public quote authorization and catalogue validation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects an address ID when the quote is anonymous", async () => {
    const addressSpy = vi.spyOn(publicQuoteRepository, "findAddressState");

    await expect(
      checkoutService.calculatePublicQuote({
        storeId: 1,
        addressId: 12,
        items: [{ productId: 1, quantity: 1 }],
      })
    ).rejects.toMatchObject({
      status: 401,
      code: "ADDRESS_AUTHENTICATION_REQUIRED",
    });
    expect(addressSpy).not.toHaveBeenCalled();
  });

  it("does not resolve an address that is outside the authenticated user scope", async () => {
    vi.spyOn(publicQuoteRepository, "findAddressState").mockResolvedValue(
      undefined
    );

    await expect(
      checkoutService.calculatePublicQuote({
        storeId: 1,
        userId: 7,
        addressId: 12,
        items: [{ productId: 1, quantity: 1 }],
      })
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
      })
    ).rejects.toMatchObject({
      status: 409,
      code: "STORE_PRODUCT_UNAVAILABLE",
    });
  });

  it.each([
    { productIsAvailable: false, storeProductIsAvailable: true },
    { productIsAvailable: true, storeProductIsAvailable: false },
  ])("rejects an unavailable catalogue or store product", async (availability) => {
    vi.spyOn(publicQuoteRepository, "findStoreProducts").mockResolvedValue([
      { ...availableStoreProduct, ...availability },
    ]);

    await expect(
      checkoutService.calculatePublicQuote({
        storeId: 1,
        destinationState: "Karnataka",
        items: [{ productId: 1, quantity: 1 }],
      })
    ).rejects.toMatchObject({
      status: 409,
      code: "STORE_PRODUCT_UNAVAILABLE",
    });
  });

  it("rejects a customization option that is not mapped to the product", async () => {
    vi.spyOn(publicQuoteRepository, "findStoreProducts").mockResolvedValue([
      availableStoreProduct,
    ]);
    vi.spyOn(
      publicQuoteRepository,
      "findProductCustomizationOptions"
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
      })
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
      "findProductCustomizationOptions"
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
      })
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
      .mockResolvedValue({ quote: validQuote, couponRecord: null });

    const result = await checkoutService.calculatePublicQuote({
      storeId: 1,
      destinationState: " Karnataka ",
      items: [{ productId: 1, quantity: 1 }],
    });

    expect(result).toEqual(validQuote);
    expect(buildQuoteSpy).toHaveBeenCalledWith({
      storeId: 1,
      items: [
        {
          lineId: 1,
          productId: 1,
          productName: "Margherita",
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
