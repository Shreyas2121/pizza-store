import { and, count, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import { db } from "../../db";
import {
  couponRedemptionsTable,
  couponsTable,
  deliveryPricingRulesTable,
  storesTable,
} from "../../db/schema";
import { AppError } from "../../utils/error";
import {
  MONEY_CAPS,
  addPaise,
  allocateProportional,
  calculateBasisPoints,
  multiplyPaiseByQuantity,
  roundHalfAwayFromZero,
  rupeesToPaise,
  subtractPaise,
} from "../../utils/money";
import type { DatabaseType, TransactionType } from "../../utils/types";

export const QUOTE_VERSION = "2026-09-01-01" as const;
export const PRICING_POLICY_VERSION = 2 as const;

export interface PricingCustomizationInput {
  customizationOptionId: number;
  name: string;
  pricePaise: number;
}

export interface PricingItemInput {
  lineId: number;
  productId: number;
  productName: string;
  quantity: number;
  baseUnitPricePaise: number;
  customizations: PricingCustomizationInput[];
}

export interface PricingQuoteItem {
  lineId: number;
  productId: number;
  productName: string;
  quantity: number;
  unitPricePaise: number;
  lineSubtotalPaise: number;
  discountAllocationPaise: number;
  lineTotalPaise: number;
  customizations: PricingCustomizationInput[];
}

export interface PricingQuote {
  quoteVersion: typeof QUOTE_VERSION;
  currency: "INR";
  pricingPolicyVersion: typeof PRICING_POLICY_VERSION;
  itemsSubtotalPaise: number;
  discountPaise: number;
  deliveryFeePaise: number;
  roundingAdjustmentPaise: 0;
  grandTotalPaise: number;
  items: PricingQuoteItem[];
  coupon: {
    id: number;
    code: string;
    discountPaise: number;
    applied: true;
  } | null;
  deliveryPricing: {
    ruleId: number;
    ruleVersion: number;
    storeId: number;
    businessDate: string;
    timezone: string;
    standardFeePaise: number;
    freeDeliveryThresholdPaise: number | null;
    freeDeliveryApplied: boolean;
  };
}

type CouponRecord = typeof couponsTable.$inferSelect;
type DeliveryPricingRuleRecord = typeof deliveryPricingRulesTable.$inferSelect;
type PricingExecutor = DatabaseType | TransactionType;

export interface PricingRepository {
  findCoupon(
    code: string,
    options: { executor?: PricingExecutor; lock: boolean }
  ): Promise<CouponRecord | undefined>;
  countActiveCouponUses(
    couponId: number,
    executor?: PricingExecutor
  ): Promise<number>;
  findStoreTimezone(
    storeId: number,
    executor?: PricingExecutor
  ): Promise<string | undefined>;
  findDeliveryPricingRules(
    storeId: number,
    businessDate: string,
    options: { executor?: PricingExecutor; lock: boolean }
  ): Promise<DeliveryPricingRuleRecord[]>;
}

export class DrizzlePricingRepository implements PricingRepository {
  async findCoupon(
    code: string,
    options: { executor?: PricingExecutor; lock: boolean }
  ) {
    const executor = options.executor ?? db;
    const query = executor
      .select()
      .from(couponsTable)
      .where(eq(couponsTable.code, code));
    const [coupon] = options.lock
      ? await query.for("update").limit(1)
      : await query.limit(1);
    return coupon;
  }

  async countActiveCouponUses(
    couponId: number,
    executor: PricingExecutor = db
  ) {
    const [usage] = await executor
      .select({ active: count(couponRedemptionsTable.id) })
      .from(couponRedemptionsTable)
      .where(
        and(
          eq(couponRedemptionsTable.couponId, couponId),
          inArray(couponRedemptionsTable.status, ["reserved", "consumed"])
        )
      );
    return Number(usage.active);
  }

  async findStoreTimezone(storeId: number, executor: PricingExecutor = db) {
    const [store] = await executor
      .select({ timezone: storesTable.timezone })
      .from(storesTable)
      .where(eq(storesTable.id, storeId))
      .limit(1);
    return store?.timezone;
  }

  async findDeliveryPricingRules(
    storeId: number,
    businessDate: string,
    options: { executor?: PricingExecutor; lock: boolean }
  ) {
    const executor = options.executor ?? db;
    const query = executor
      .select()
      .from(deliveryPricingRulesTable)
      .where(
        and(
          eq(deliveryPricingRulesTable.storeId, storeId),
          lte(deliveryPricingRulesTable.effectiveFrom, businessDate),
          or(
            isNull(deliveryPricingRulesTable.effectiveTo),
            gte(deliveryPricingRulesTable.effectiveTo, businessDate)
          )
        )
      );
    return options.lock
      ? await query.for("update").limit(2)
      : await query.limit(2);
  }
}

export interface BuildPricingQuoteInput {
  storeId: number;
  items: PricingItemInput[];
  couponCode?: string | null;
  now?: Date;
}

export type BuildPricingQuoteOptions =
  | { executor: TransactionType; lockCoupon: true }
  | { executor?: PricingExecutor; lockCoupon?: false };

export class PricingService {
  constructor(private readonly repository: PricingRepository = new DrizzlePricingRepository()) {}

  async buildQuote(
    input: BuildPricingQuoteInput,
    options: BuildPricingQuoteOptions = {}
  ): Promise<{ quote: PricingQuote; couponRecord: CouponRecord | null }> {
    if (options.lockCoupon && !options.executor) {
      throw new AppError(
        "A caller transaction is required to lock coupon pricing",
        500,
        "PRICING_TRANSACTION_REQUIRED"
      );
    }
    const pricedItems = this.priceItems(input.items);
    let itemsSubtotalPaise: number;
    try {
      itemsSubtotalPaise = addPaise(
        pricedItems.map((item) => item.lineSubtotalPaise),
        MONEY_CAPS.ORDER_AMOUNT,
        "Order subtotal"
      );
    } catch (cause) {
      if (cause instanceof RangeError || cause instanceof TypeError) {
        throw new AppError("Cart total is too large", 400);
      }
      throw cause;
    }

    const couponRecord = input.couponCode
      ? await this.getApplicableCoupon(
          input.couponCode,
          itemsSubtotalPaise,
          input.now ?? new Date(),
          options
        )
      : null;
    const discountPaise = couponRecord
      ? this.calculateDiscountPaise(couponRecord, itemsSubtotalPaise)
      : 0;
    const deliveryPricing = await this.getDeliveryPricing(
      input.storeId,
      input.now ?? new Date(),
      options
    );
    const allocations = allocateProportional(
      discountPaise,
      pricedItems.map((item) => ({
        id: item.lineId,
        weight: item.lineSubtotalPaise,
      }))
    );
    const allocationsByLine = new Map(
      allocations.map((allocation) => [allocation.id, allocation.allocatedPaise])
    );
    const items = pricedItems.map((item): PricingQuoteItem => {
      const discountAllocationPaise = allocationsByLine.get(item.lineId) ?? 0;
      return {
        ...item,
        discountAllocationPaise,
        lineTotalPaise: subtractPaise(
          item.lineSubtotalPaise,
          discountAllocationPaise,
          { domainCap: MONEY_CAPS.ORDER_AMOUNT }
        ),
      };
    });
    const netItemsPaise = subtractPaise(
      itemsSubtotalPaise,
      discountPaise,
      { domainCap: MONEY_CAPS.ORDER_AMOUNT }
    );
    const freeDeliveryApplied =
      deliveryPricing.rule.freeDeliveryThresholdPaise !== null
      && netItemsPaise >= deliveryPricing.rule.freeDeliveryThresholdPaise;
    const deliveryFeePaise = freeDeliveryApplied
      ? 0
      : deliveryPricing.rule.deliveryFeePaise;
    let grandTotalPaise: number;
    try {
      grandTotalPaise = addPaise(
        [netItemsPaise, deliveryFeePaise],
        MONEY_CAPS.ORDER_AMOUNT,
        "Order grand total"
      );
    } catch (cause) {
      if (cause instanceof RangeError || cause instanceof TypeError) {
        throw new AppError("Cart total is too large", 400);
      }
      throw cause;
    }

    return {
      quote: {
        quoteVersion: QUOTE_VERSION,
        currency: "INR",
        pricingPolicyVersion: PRICING_POLICY_VERSION,
        itemsSubtotalPaise,
        discountPaise,
        deliveryFeePaise,
        roundingAdjustmentPaise: 0,
        grandTotalPaise,
        items,
        coupon: couponRecord
          ? {
              id: couponRecord.id,
              code: couponRecord.code,
              discountPaise,
              applied: true,
            }
          : null,
        deliveryPricing: {
          ruleId: deliveryPricing.rule.id,
          ruleVersion: deliveryPricing.rule.version,
          storeId: input.storeId,
          businessDate: deliveryPricing.businessDate,
          timezone: deliveryPricing.timezone,
          standardFeePaise: deliveryPricing.rule.deliveryFeePaise,
          freeDeliveryThresholdPaise:
            deliveryPricing.rule.freeDeliveryThresholdPaise,
          freeDeliveryApplied,
        },
      },
      couponRecord,
    };
  }

  private async getDeliveryPricing(
    storeId: number,
    now: Date,
    options: BuildPricingQuoteOptions
  ) {
    if (!Number.isSafeInteger(storeId) || storeId <= 0) {
      throw new AppError(
        "Store pricing context is invalid",
        400,
        "DELIVERY_PRICING_STORE_INVALID"
      );
    }
    const timezone = await this.repository.findStoreTimezone(
      storeId,
      options.executor
    );
    if (!timezone) {
      throw new AppError("Store not found", 404, "STORE_NOT_FOUND");
    }
    const businessDate = this.businessDateFor(now, timezone);
    const rules = await this.repository.findDeliveryPricingRules(
      storeId,
      businessDate,
      {
        executor: options.executor,
        lock: options.lockCoupon ?? false,
      }
    );
    if (rules.length === 0) {
      throw new AppError(
        "Delivery pricing is not configured for this store and date",
        422,
        "DELIVERY_PRICING_RULE_NOT_FOUND"
      );
    }
    if (rules.length > 1) {
      throw new AppError(
        "Delivery pricing rules overlap for this store and date",
        500,
        "DELIVERY_PRICING_RULE_OVERLAP"
      );
    }
    return { rule: rules[0], businessDate, timezone };
  }

  private businessDateFor(now: Date, timezone: string) {
    if (Number.isNaN(now.getTime())) {
      throw new AppError("Pricing time is invalid", 400, "PRICING_TIME_INVALID");
    }
    try {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(now);
      const value = Object.fromEntries(
        parts.map((part) => [part.type, part.value])
      );
      return `${value.year}-${value.month}-${value.day}`;
    } catch {
      throw new AppError(
        "Store timezone configuration is invalid",
        500,
        "STORE_TIMEZONE_INVALID"
      );
    }
  }

  private priceItems(items: PricingItemInput[]) {
    if (items.length === 0) {
      throw new AppError("Cart is empty", 400);
    }

    const lineIds = new Set<number>();
    return items.map((item) => {
      if (lineIds.has(item.lineId)) {
        throw new AppError("Cart contains duplicate line identifiers", 409);
      }
      lineIds.add(item.lineId);

      try {
        const customizationTotalPaise = addPaise(
          item.customizations.map((customization) => customization.pricePaise),
          MONEY_CAPS.ITEM_PRICE,
          "Customization total"
        );
        const unitPricePaise = addPaise(
          [item.baseUnitPricePaise, customizationTotalPaise],
          MONEY_CAPS.ITEM_PRICE,
          "Unit price"
        );
        const lineSubtotalPaise = multiplyPaiseByQuantity(
          unitPricePaise,
          item.quantity,
          MONEY_CAPS.ORDER_AMOUNT
        );
        if (item.quantity <= 0) {
          throw new RangeError("Quantity must be positive");
        }
        return {
          lineId: item.lineId,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPricePaise,
          lineSubtotalPaise,
          customizations: item.customizations.map((customization) => ({
            ...customization,
          })),
        };
      } catch (cause) {
        if (cause instanceof RangeError || cause instanceof TypeError) {
          throw new AppError("Cart contains invalid pricing", 409);
        }
        throw cause;
      }
    });
  }

  private async getApplicableCoupon(
    code: string,
    itemsSubtotalPaise: number,
    now: Date,
    options: BuildPricingQuoteOptions
  ) {
    const normalizedCode = code.trim().toUpperCase();
    const coupon = await this.repository.findCoupon(normalizedCode, {
      executor: options.executor,
      lock: options.lockCoupon ?? false,
    });
    if (!coupon) throw new AppError("Coupon not found", 404);
    if (!coupon.isActive) throw new AppError("Coupon is not active", 400);
    if (now < coupon.startDate || now > coupon.endDate) {
      throw new AppError("Coupon is expired or not yet valid", 400);
    }
    if (!Number.isFinite(coupon.minOrderValue) || coupon.minOrderValue < 0) {
      throw new AppError("Coupon has an invalid minimum order value", 400);
    }

    let minimumPaise: number;
    try {
      minimumPaise = rupeesToPaise(coupon.minOrderValue);
    } catch {
      throw new AppError("Coupon has an invalid minimum order value", 400);
    }
    if (itemsSubtotalPaise < minimumPaise) {
      throw new AppError(
        `Minimum order value of ${coupon.minOrderValue} not met`,
        400
      );
    }

    const activeUses = await this.repository.countActiveCouponUses(
      coupon.id,
      options.executor
    );
    const effectiveUses = Math.max(coupon.redemptionCount, activeUses);
    if (coupon.maxRedemptions >= 0 && effectiveUses >= coupon.maxRedemptions) {
      throw new AppError("Coupon maximum redemption limit reached", 400);
    }
    return coupon;
  }

  private calculateDiscountPaise(
    coupon: CouponRecord,
    itemsSubtotalPaise: number
  ) {
    if (!Number.isFinite(coupon.discountValue) || coupon.discountValue <= 0) {
      throw new AppError("Coupon has an invalid discount", 400);
    }

    let rawDiscount: number;
    try {
      if (coupon.discountType === "percentage") {
        const scaledRate = coupon.discountValue * 100;
        const rateBps = roundHalfAwayFromZero(scaledRate);
        if (Math.abs(scaledRate - rateBps) > 1e-8) {
          throw new RangeError("Percentage supports at most two decimals");
        }
        rawDiscount = calculateBasisPoints(itemsSubtotalPaise, rateBps);
      } else if (coupon.discountType === "fixed") {
        rawDiscount = rupeesToPaise(coupon.discountValue);
      } else {
        throw new AppError("Coupon has an invalid discount type", 400);
      }
    } catch (cause) {
      if (cause instanceof AppError) throw cause;
      throw new AppError("Coupon has an invalid discount", 400);
    }

    return Math.min(rawDiscount, itemsSubtotalPaise);
  }
}

export default new PricingService();
