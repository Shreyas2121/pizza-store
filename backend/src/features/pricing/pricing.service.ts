import { and, count, eq, inArray } from "drizzle-orm";
import { db } from "../../db";
import { couponRedemptionsTable, couponsTable } from "../../db/schema";
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

export const QUOTE_VERSION = "2026-08-31-01" as const;
export const PRICING_POLICY_VERSION = 1 as const;

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
  deliveryFeePaise: 0;
  roundingAdjustmentPaise: 0;
  grandTotalPaise: number;
  items: PricingQuoteItem[];
  coupon: {
    id: number;
    code: string;
    discountPaise: number;
    applied: true;
  } | null;
}

type CouponRecord = typeof couponsTable.$inferSelect;
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
}

export interface BuildPricingQuoteInput {
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
    const grandTotalPaise = subtractPaise(
      itemsSubtotalPaise,
      discountPaise,
      { domainCap: MONEY_CAPS.ORDER_AMOUNT }
    );

    return {
      quote: {
        quoteVersion: QUOTE_VERSION,
        currency: "INR",
        pricingPolicyVersion: PRICING_POLICY_VERSION,
        itemsSubtotalPaise,
        discountPaise,
        deliveryFeePaise: 0,
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
      },
      couponRecord,
    };
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
