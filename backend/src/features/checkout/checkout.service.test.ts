import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../utils/error";
import {
  orderItemCustomizationsTable,
  orderItemBundleComponentsTable,
  orderItemsTable,
  ordersTable,
} from "../../db/schema";
import type { TransactionType } from "../../utils/types";
import cartService from "../cart/cart.service";
import inventoryService from "../inventory/inventory.service";
import pricingService from "../pricing/pricing.service";
import { publicQuoteRepository } from "./checkout.repository";
import checkoutService from "./checkout.service";

describe("CheckoutService stock integration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("locks cart, validates available stock, and returns stockAllocations in quote", async () => {
    const mockCart = {
      id: 1,
      userId: 10,
      storeId: 1,
      store: {
        id: 1,
        name: "Main Store",
        isActive: true,
        opensAt: "00:00",
        closesAt: "23:59",
      },
      items: [
        {
          id: 101,
          productId: 1,
          quantity: 2,
          pricePaise: 20_000,
          product: { name: "Margherita" },
          customizations: [],
        },
      ],
    };

    vi.spyOn(cartService, "getCart").mockResolvedValue(mockCart as any);

    const mockAllocations = [
      {
        storeProductId: 10,
        productId: 1,
        productName: "Margherita",
        demandedQuantity: 2,
        isTracked: true,
        onHandQuantity: 10,
        reservedQuantity: 0,
        availableQuantity: 10,
        lowStockThreshold: 5,
      },
    ];

    vi.spyOn(inventoryService, "validateAndLockStock").mockResolvedValue(
      mockAllocations
    );
    vi.spyOn(pricingService, "buildQuote").mockResolvedValue({
      quote: {
        quoteVersion: "2026-09-01-02",
        currency: "INR",
        pricingPolicyVersion: 3,
        itemsSubtotalPaise: 40_000,
        discountPaise: 0,
        deliveryFeePaise: 4_000,
        roundingAdjustmentPaise: 0,
        grandTotalPaise: 44_000,
        taxableAmountPaise: 41_905,
        taxPaise: 2_095,
        items: [],
        coupon: null,
        deliveryPricing: {
          ruleId: 11,
          ruleVersion: 1,
          storeId: 1,
          businessDate: "2026-09-01",
          timezone: "Asia/Kolkata",
          standardFeePaise: 4_000,
          freeDeliveryThresholdPaise: 50_000,
          freeDeliveryApplied: false,
        },
        tax: {
          calculationPolicyVersion: 1,
          isDemo: true,
          disclaimer: "Portfolio demo — not a statutory tax invoice",
          placeOfSupplyState: "Maharashtra",
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
            rateBps: 500,
            hsnSacCode: "996331-DEMO",
            taxableAmountPaise: 3_810,
            taxPaise: 190,
          },
        },
      },
      couponRecord: null,
    } as any);

    const mockTx = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            for: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue([{ id: 1 }]), // locked cart
            })),
            limit: vi.fn().mockResolvedValue([
              { id: 1, pincode: "400001" }, // address or deliveryZone
            ]),
          })),
          innerJoin: vi.fn(() => ({
            where: vi.fn().mockResolvedValue([
              { productId: 1, isAvailable: true, productIsAvailable: true },
            ]),
          })),
        })),
      })),
    } as unknown as TransactionType;

    const quote = await checkoutService.buildQuote(
      { userId: 10, addressId: 1 },
      mockTx
    );

    expect(quote.stockAllocations).toEqual(mockAllocations);
    expect(quote.pricingQuote).toMatchObject({
      quoteVersion: "2026-09-01-02",
      itemsSubtotalPaise: 40_000,
      discountPaise: 0,
      deliveryFeePaise: 4_000,
      grandTotalPaise: 44_000,
      taxableAmountPaise: 41_905,
      taxPaise: 2_095,
    });
    expect(inventoryService.validateAndLockStock).toHaveBeenCalledWith(
      1,
      mockCart.items,
      mockTx
    );
  });

  it("propagates INSUFFICIENT_STOCK error when inventory validation fails", async () => {
    const mockCart = {
      id: 1,
      userId: 10,
      storeId: 1,
      store: {
        id: 1,
        name: "Main Store",
        isActive: true,
        opensAt: "00:00",
        closesAt: "23:59",
      },
      items: [
        {
          id: 101,
          productId: 1,
          quantity: 5,
          pricePaise: 20_000,
          product: { name: "Margherita" },
          customizations: [],
        },
      ],
    };

    vi.spyOn(cartService, "getCart").mockResolvedValue(mockCart as any);

    vi.spyOn(inventoryService, "validateAndLockStock").mockRejectedValue(
      new AppError(
        "Insufficient stock for one or more items",
        409,
        "INSUFFICIENT_STOCK",
        {
          items: [
            {
              productId: 1,
              productName: "Margherita",
              requestedQuantity: 5,
              availableQuantity: 2,
            },
          ],
        }
      )
    );

    const mockTx = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            for: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue([{ id: 1 }]),
            })),
            limit: vi.fn().mockResolvedValue([
              { id: 1, pincode: "400001" },
            ]),
          })),
          innerJoin: vi.fn(() => ({
            where: vi.fn().mockResolvedValue([
              { productId: 1, isAvailable: true, productIsAvailable: true },
            ]),
          })),
        })),
      })),
    } as unknown as TransactionType;

    await expect(
      checkoutService.buildQuote({ userId: 10, addressId: 1 }, mockTx)
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "INSUFFICIENT_STOCK",
        status: 409,
      })
    );
  });

  it("uses the canonical pricing policy for coupon preview", async () => {
    const mockCart = {
      id: 1,
      userId: 10,
      storeId: 1,
      items: [
        {
          id: 101,
          productId: 1,
          quantity: 1,
          pricePaise: 20_000,
          product: { name: "Margherita" },
          customizations: [],
        },
      ],
    };
    vi.spyOn(cartService, "getCart").mockResolvedValue(mockCart as any);
    const pricingResult = {
      quote: {
        quoteVersion: "2026-08-31-01",
        currency: "INR",
        pricingPolicyVersion: 1,
        itemsSubtotalPaise: 20_000,
        discountPaise: 2_000,
        deliveryFeePaise: 0,
        roundingAdjustmentPaise: 0,
        grandTotalPaise: 18_000,
        items: [],
        coupon: { id: 7, code: "SAVE10", discountPaise: 2_000, applied: true },
      },
      couponRecord: { id: 7, code: "SAVE10" },
    };
    const buildQuote = vi
      .spyOn(pricingService, "buildQuote")
      .mockResolvedValue(pricingResult as any);

    await expect(checkoutService.previewCoupon(10, "save10")).resolves.toBe(
      pricingResult
    );
    expect(buildQuote).toHaveBeenCalledWith({
      storeId: 1,
      items: [
        {
          lineId: 101,
          productId: 1,
          productName: "Margherita",
          quantity: 1,
          baseUnitPricePaise: 20_000,
          customizations: [],
        },
      ],
      couponCode: "save10",
    });
  });
});

describe("CheckoutService exact order snapshots", () => {
  const createInsertHarness = () => {
    const writes = new Map<unknown, unknown>();
    let orderItemId = 900;
    const tx = {
      insert: vi.fn((table: unknown) => ({
        values: vi.fn((values: unknown) => {
          writes.set(table, values);
          return {
            returning: vi.fn().mockResolvedValue(
              table === ordersTable
                ? [{ id: 42, storeId: 1, userId: 10, ...(values as object) }]
                : [{ id: orderItemId++, ...(values as object) }]
            ),
          };
        }),
      })),
    } as unknown as TransactionType;
    return { tx, writes };
  };

  const createQuote = (overrides: Record<string, unknown> = {}) => ({
    cart: { storeId: 1 },
    coupon: { id: 7 },
    pricingQuote: {
      quoteVersion: "2026-09-01-02",
      currency: "INR",
      pricingPolicyVersion: 3,
      itemsSubtotalPaise: 50_000,
      discountPaise: 10_000,
      deliveryFeePaise: 4_000,
      roundingAdjustmentPaise: 0,
      grandTotalPaise: 44_000,
      taxableAmountPaise: 41_905,
      taxPaise: 2_095,
      items: [
        {
          lineId: 101,
          productId: 1,
          productName: "Margherita",
          quantity: 2,
          unitPricePaise: 25_000,
          lineSubtotalPaise: 50_000,
          discountAllocationPaise: 10_000,
          taxRuleId: 21,
          taxRuleVersion: 2,
          taxRateBps: 500,
          taxableAmountPaise: 38_095,
          taxPaise: 1_905,
          lineTotalPaise: 40_000,
          hsnSacCode: "21069099-DEMO",
          customizations: [
            {
              customizationOptionId: 8,
              name: "Extra cheese",
              pricePaise: 5_000,
            },
          ],
        },
      ],
      coupon: { id: 7, code: "SAVE20", discountPaise: 10_000, applied: true },
      deliveryPricing: {
        ruleId: 11,
        ruleVersion: 3,
        storeId: 1,
        businessDate: "2026-09-01",
        timezone: "Asia/Kolkata",
        standardFeePaise: 4_000,
        freeDeliveryThresholdPaise: 50_000,
        freeDeliveryApplied: false,
      },
      tax: {
        calculationPolicyVersion: 1,
        isDemo: true,
        disclaimer: "Portfolio demo — not a statutory tax invoice",
        placeOfSupplyState: "Maharashtra",
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
          rateBps: 500,
          hsnSacCode: "996331-DEMO",
          taxableAmountPaise: 3_810,
          taxPaise: 190,
        },
      },
      ...overrides,
    },
  });

  it("persists customized and discounted values directly from the quote", async () => {
    const { tx, writes } = createInsertHarness();

    await checkoutService.createOrderSnapshot(
      createQuote() as any,
      {
        userId: 10,
        addressId: 3,
        paymentId: 5,
        paymentType: "cash",
        status: "pending",
      },
      tx
    );

    expect(writes.get(ordersTable)).toMatchObject({
      itemsSubtotalPaise: 50_000,
      discountPaise: 10_000,
      deliveryFeePaise: 4_000,
      taxableAmountPaise: 41_905,
      taxPaise: 2_095,
      grandTotalPaise: 44_000,
      currency: "INR",
      quoteVersion: "2026-09-01-02",
      pricingPolicyVersion: 3,
      deliveryPricingRuleId: 11,
      deliveryPricingRuleVersion: 3,
      pricingBusinessDate: "2026-09-01",
      pricingTimezone: "Asia/Kolkata",
      taxCalculationPolicyVersion: 1,
      taxDisclaimer: "Portfolio demo — not a statutory tax invoice",
      taxIsDemo: true,
      placeOfSupplyState: "Maharashtra",
      deliveryTaxRuleId: 22,
      deliveryTaxRuleVersion: 2,
      deliveryTaxRateBps: 500,
      deliveryTaxableAmountPaise: 3_810,
      deliveryTaxPaise: 190,
      deliveryHsnSacCode: "996331-DEMO",
    });
    expect(writes.get(ordersTable)).not.toHaveProperty("discountAmount");
    expect(writes.get(ordersTable)).not.toHaveProperty("totalPrice");
    expect(writes.get(orderItemsTable)).toMatchObject({
      productName: "Margherita",
      unitPricePaise: 25_000,
      lineSubtotalPaise: 50_000,
      discountAllocationPaise: 10_000,
      taxRuleId: 21,
      taxRuleVersion: 2,
      taxRateBps: 500,
      taxableAmountPaise: 38_095,
      taxPaise: 1_905,
      lineTotalPaise: 40_000,
      hsnSacCode: "21069099-DEMO",
    });
    expect(writes.get(orderItemsTable)).not.toHaveProperty("price");
    expect(writes.get(orderItemCustomizationsTable)).toEqual([
      expect.objectContaining({
        customizationName: "Extra cheese",
        pricePaise: 5_000,
      }),
    ]);
  });

  it("persists immutable bundle price, markdown, and multiplied component snapshots", async () => {
    const { tx, writes } = createInsertHarness();
    const quote = createQuote({
      itemsSubtotalPaise: 60_000,
      discountPaise: 0,
      grandTotalPaise: 64_000,
      items: [{
        lineId: 202,
        productId: 30,
        productName: "Pizza + Drink",
        productType: "bundle",
        quantity: 2,
        unitPricePaise: 30_000,
        compareAtUnitPricePaise: 36_000,
        bundleMarkdownPaise: 12_000,
        lineSubtotalPaise: 60_000,
        discountAllocationPaise: 0,
        taxRuleId: 21,
        taxRuleVersion: 2,
        taxRateBps: 500,
        taxableAmountPaise: 57_143,
        taxPaise: 2_857,
        lineTotalPaise: 60_000,
        hsnSacCode: "21069099-DEMO",
        customizations: [],
        bundleComponents: [
          { productId: 11, name: "Pizza", quantityPerBundle: 1, totalQuantity: 2, isAvailable: true },
          { productId: 20, name: "Cola", quantityPerBundle: 2, totalQuantity: 4, isAvailable: true },
        ],
      }],
      coupon: null,
    });

    await checkoutService.createOrderSnapshot(
      quote as any,
      { userId: 10, addressId: 3, paymentId: 5, paymentType: "cash", status: "pending" },
      tx
    );

    expect(writes.get(ordersTable)).toMatchObject({ discountPaise: 0 });
    expect(writes.get(orderItemsTable)).toMatchObject({
      productType: "bundle",
      unitPricePaise: 30_000,
      compareAtUnitPricePaise: 36_000,
      bundleMarkdownPaise: 12_000,
      discountAllocationPaise: 0,
    });
    expect(writes.get(orderItemBundleComponentsTable)).toEqual([
      { orderItemId: 900, componentProductId: 11, componentName: "Pizza", quantityPerBundle: 1, totalQuantity: 2 },
      { orderItemId: 900, componentProductId: 20, componentName: "Cola", quantityPerBundle: 2, totalQuantity: 4 },
    ]);
  });

  it.each([
    {
      label: "zero-total",
      subtotal: 20_000,
      discount: 20_000,
      total: 0,
      unit: 20_000,
      quantity: 1,
    },
    {
      label: "order-boundary",
      subtotal: 500_000,
      discount: 0,
      total: 500_000,
      unit: 100_000,
      quantity: 5,
    },
  ])("persists the $label exact boundary", async (testCase) => {
    const { tx, writes } = createInsertHarness();
    const quote = createQuote({
      itemsSubtotalPaise: testCase.subtotal,
      discountPaise: testCase.discount,
      deliveryFeePaise: 0,
      taxableAmountPaise: testCase.total,
      taxPaise: 0,
      grandTotalPaise: testCase.total,
      tax: {
        ...createQuote().pricingQuote.tax,
        deliveryRule: {
          ...createQuote().pricingQuote.tax.deliveryRule,
          rateBps: 0,
          taxableAmountPaise: 0,
          taxPaise: 0,
        },
      },
      items: [
        {
          lineId: 101,
          productId: 1,
          productName: "Boundary Pizza",
          quantity: testCase.quantity,
          unitPricePaise: testCase.unit,
          lineSubtotalPaise: testCase.subtotal,
          discountAllocationPaise: testCase.discount,
          taxRuleId: 21,
          taxRuleVersion: 2,
          taxRateBps: 0,
          taxableAmountPaise: testCase.total,
          taxPaise: 0,
          lineTotalPaise: testCase.total,
          hsnSacCode: "21069099-DEMO",
          customizations: [],
        },
      ],
    });

    await checkoutService.createOrderSnapshot(
      quote as any,
      {
        userId: 10,
        addressId: 3,
        paymentId: 5,
        paymentType: "cash",
        status: "pending",
      },
      tx
    );

    expect(writes.get(ordersTable)).toMatchObject({
      itemsSubtotalPaise: testCase.subtotal,
      discountPaise: testCase.discount,
      taxableAmountPaise: testCase.total,
      grandTotalPaise: testCase.total,
    });
    expect(writes.get(orderItemsTable)).toMatchObject({
      unitPricePaise: testCase.unit,
      lineSubtotalPaise: testCase.subtotal,
      discountAllocationPaise: testCase.discount,
      lineTotalPaise: testCase.total,
    });
  });
});

describe("CheckoutService calculatePublicQuote", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calculates authoritative quote from provided items and customization options", async () => {
    const mockQuote = {
      quoteVersion: "2026-09-01-02",
      currency: "INR",
      pricingPolicyVersion: 3,
      itemsSubtotalPaise: 45_000,
      discountPaise: 5_000,
      deliveryFeePaise: 4_000,
      roundingAdjustmentPaise: 0,
      grandTotalPaise: 44_000,
      taxableAmountPaise: 41_905,
      taxPaise: 2_095,
      items: [],
      coupon: {
        id: 1,
        code: "SAVE50",
        discountPaise: 5_000,
        applied: true,
      },
      deliveryPricing: {
        ruleId: 11,
        ruleVersion: 1,
        storeId: 1,
        businessDate: "2026-09-01",
        timezone: "Asia/Kolkata",
        standardFeePaise: 4_000,
        freeDeliveryThresholdPaise: 50_000,
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

    const buildQuoteSpy = vi
      .spyOn(pricingService, "buildQuote")
      .mockResolvedValue({
        quote: mockQuote as any,
        couponRecord: null,
      });

    vi.spyOn(publicQuoteRepository, "findStoreProducts").mockResolvedValue([
      {
        productId: 1,
        productName: "Margherita",
        pricePaise: 37_000,
        productIsAvailable: true,
        storeProductIsAvailable: true,
      },
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
      items: [
        {
          lineId: 1,
          productId: 1,
          productName: "Margherita",
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
    const mockCart = {
      id: 1,
      userId: 10,
      storeId: 2,
      items: [
        {
          id: 101,
          productId: 1,
          quantity: 2,
          pricePaise: 20_000,
          product: { name: "Margherita" },
          customizations: [],
        },
      ],
    };

    vi.spyOn(cartService, "getCart").mockResolvedValue(mockCart as any);
    const buildQuoteSpy = vi
      .spyOn(pricingService, "buildQuote")
      .mockResolvedValue({
        quote: { grandTotalPaise: 44_000 } as any,
        couponRecord: null,
      });

    const result = await checkoutService.calculatePublicQuote({
      storeId: 2,
      userId: 10,
    });

    expect(result.grandTotalPaise).toBe(44_000);
    expect(buildQuoteSpy).toHaveBeenCalledWith({
      storeId: 2,
      items: [
        {
          lineId: 101,
          productId: 1,
          productName: "Margherita",
          quantity: 2,
          baseUnitPricePaise: 20_000,
          customizations: [],
        },
      ],
      couponCode: undefined,
      destinationState: null,
    });
  });

  it("throws 400 when items are omitted and user has no active cart", async () => {
    vi.spyOn(cartService, "getCart").mockResolvedValue(null);

    await expect(
      checkoutService.calculatePublicQuote({
        storeId: 1,
        userId: 10,
      })
    ).rejects.toMatchObject({
      message: "Cart is empty",
      status: 400,
    });
  });
});
