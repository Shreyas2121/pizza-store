import {
  taxRulesTable,
  DEMO_TAX_DISCLAIMER,
  type DemoTaxComponent,
} from "../../db/schema";
import { AppError } from "../../utils/error";
import {
  MAX_POSTGRES_INT,
  MONEY_CAPS,
  addPaise,
  calculateInclusiveTax,
  multiplyPaiseByQuantity,
  subtractPaise,
} from "../../utils/money";
import type { TransactionType } from "../../utils/types";
import {
  resolvePromotionSet,
  type CouponEligibility,
  type DiscountMode,
  type ResolvedPromotion,
} from "../promotions";
import {
  PromotionPricingRepository,
  type PromotionPricingData,
} from "../promotions/pricing";
import {
  DrizzlePricingRepository,
  type PricingExecutor,
  type PricingRepository,
} from "./pricing.repository";
import { promotionCodeSchema } from "../promotions";
export { buildRecognitionPricingSnapshot } from "./pricing.recognition";
export {
  DrizzlePricingRepository,
  type PricingRepository,
} from "./pricing.repository";

export const QUOTE_VERSION = "2026-10-10-01" as const;
export const PRICING_POLICY_VERSION = 5 as const;
export const TAX_CALCULATION_POLICY_VERSION = 1 as const;
type TaxRuleRecord = typeof taxRulesTable.$inferSelect;
interface TaxRuleSnapshot {
  ruleId: number;
  ruleVersion: number;
  rateBps: number;
  hsnSacCode: string;
}
export interface PricingCustomizationInput {
  customizationOptionId: number;
  name: string;
  pricePaise: number;
}
// These amounts and catalogue fields must come from server catalogue/cart loaders.
export interface PricingItemInput {
  lineId: number;
  productId: number;
  categoryId: number;
  productName: string;
  quantity: number;
  baseUnitPricePaise: number;
  customizations: PricingCustomizationInput[];
  productType?: "single" | "bundle";
  compareAtUnitPricePaise?: number | null;
  bundleComponents?: Array<{
    productId: number;
    name: string;
    quantityPerBundle: number;
    totalQuantity: number;
    isAvailable: boolean;
  }>;
}
export interface PricingQuoteItem {
  lineId: number;
  productId: number;
  productName: string;
  quantity: number;
  baseUnitPricePaise: number;
  customizationUnitPricePaise: number;
  unitPricePaise: number;
  lineSubtotalPaise: number;
  itemDiscountPaise: number;
  taxRuleId: number;
  taxRuleVersion: number;
  taxRateBps: number;
  taxableAmountPaise: number;
  taxPaise: number;
  hsnSacCode: string;
  lineTotalPaise: number;
  customizations: PricingCustomizationInput[];
  productType: "single" | "bundle";
  compareAtUnitPricePaise: number | null;
  bundleMarkdownPaise: number;
  bundleComponents: NonNullable<PricingItemInput["bundleComponents"]>;
}
export type QuotePromotion = Omit<
  ResolvedPromotion,
  "displayPriority" | "allocations"
> & {
  applied: true;
  allocations: Array<{
    lineId: number | null;
    component: "item" | "delivery";
    unitIndexes: number[];
    amountPaise: number;
  }>;
};
export interface PricingQuote {
  quoteVersion: typeof QUOTE_VERSION;
  currency: "INR";
  pricingPolicyVersion: typeof PRICING_POLICY_VERSION;
  discountMode: DiscountMode;
  itemsSubtotalPaise: number;
  itemDiscountPaise: number;
  standardDeliveryFeePaise: number;
  chargedDeliveryFeePaise: number;
  deliveryDiscountPaise: number;
  promotionSavingsPaise: number;
  bundleMarkdownPaise: number;
  totalDisplayedSavingsPaise: number;
  roundingAdjustmentPaise: 0;
  grandTotalPaise: number;
  taxableAmountPaise: number;
  taxPaise: number;
  items: PricingQuoteItem[];
  couponEligibility: CouponEligibility;
  promotions: QuotePromotion[];
  deliveryPricing: {
    ruleId: number;
    ruleVersion: number;
    storeId: number;
    businessDate: string;
    timezone: string;
    standardFeePaise: number;
    chargedFeePaise: number;
  };
  tax: {
    calculationPolicyVersion: typeof TAX_CALCULATION_POLICY_VERSION;
    isDemo: true;
    disclaimer: typeof DEMO_TAX_DISCLAIMER;
    placeOfSupplyState: string;
    placeOfSupplySource: "delivery_address" | "store_estimate";
    itemRule: TaxRuleSnapshot;
    deliveryRule: TaxRuleSnapshot & {
      taxableAmountPaise: number;
      taxPaise: number;
    };
  };
}
export interface BuildPricingQuoteInput {
  storeId: number;
  userId?: number | null;
  items: PricingItemInput[];
  couponCode?: string | null;
  destinationState?: string | null;
  now?: Date;
}
export type BuildPricingQuoteOptions =
  | { executor: TransactionType; lockPromotions: true }
  | { executor?: PricingExecutor; lockPromotions?: false };
export interface PromotionPricingSource {
  load(
    storeId: number,
    userId: number | null,
    code: string | null,
    now: Date,
    options: BuildPricingQuoteOptions,
  ): Promise<PromotionPricingData>;
}
const quotePromotion = (promotion: ResolvedPromotion): QuotePromotion => ({
  id: promotion.id,
  definitionVersion: promotion.definitionVersion,
  kind: promotion.kind,
  name: promotion.name,
  code: promotion.kind === "coupon" ? promotion.code : null,
  discountType: promotion.discountType,
  itemDiscountPaise: promotion.itemDiscountPaise,
  deliveryDiscountPaise: promotion.deliveryDiscountPaise,
  totalSavingsPaise: promotion.totalSavingsPaise,
  applied: true,
  allocations: promotion.allocations.map((allocation) => ({
    lineId: allocation.lineId,
    component: allocation.component,
    unitIndexes: allocation.unitIndex === null ? [] : [allocation.unitIndex],
    amountPaise: allocation.amountPaise,
  })),
});
export class PricingService {
  constructor(
    private readonly repository: PricingRepository = new DrizzlePricingRepository(),
    private readonly promotions: PromotionPricingSource = new PromotionPricingRepository(),
  ) {}
  async buildQuote(
    input: BuildPricingQuoteInput,
    options: BuildPricingQuoteOptions = {},
  ): Promise<{ quote: PricingQuote }> {
    if (options.lockPromotions && !options.executor)
      throw new AppError(
        "A caller transaction is required",
        500,
        "PRICING_TRANSACTION_REQUIRED",
      );
    const now = input.now ?? new Date();
    let code: string | null = null;
    if (input.couponCode !== undefined && input.couponCode !== null) {
      const parsed = promotionCodeSchema.safeParse(input.couponCode);
      if (!parsed.success)
        throw new AppError(
          "Invalid coupon code",
          400,
          "PROMOTION_INVALID_DEFINITION",
        );
      code = parsed.data;
    }
    try {
      const pricedItems = this.priceItems(input.items);
      const itemsSubtotalPaise = addPaise(
        pricedItems.map((item) => item.lineSubtotalPaise),
        MONEY_CAPS.ORDER_AMOUNT,
        "Item subtotal",
      );
      const context = await this.getPricingContext(input.storeId, now, options);
      const data = await this.promotions.load(
        input.storeId,
        input.userId ?? null,
        code,
        now,
        options,
      );
      const freeDeliveryThresholdPaise =
        context.deliveryPricingRule.freeDeliveryThresholdPaise;
      // Store delivery pricing applies before promotions. Meeting the threshold
      // makes delivery ordinarily free, not a promotional saving to allocate.
      const standardDeliveryFeePaise =
        freeDeliveryThresholdPaise !== null &&
        itemsSubtotalPaise >= freeDeliveryThresholdPaise
          ? 0
          : context.deliveryPricingRule.deliveryFeePaise;
      const result = resolvePromotionSet({
        promotions: data.promotions,
        couponCode: code,
        context: {
          now,
          timezone: context.store.timezone,
          userId: input.userId ?? null,
          qualifyingOrderCount: data.qualifyingOrderCount,
          deliveryFeePaise: standardDeliveryFeePaise,
          items: pricedItems,
          usageByPromotionId: data.usageByPromotionId,
        },
      });
      if (!result.ok)
        throw new AppError(
          "Promotion cannot be applied",
          result.errorCode === "PROMOTION_NOT_FOUND" ? 404 : 409,
          result.errorCode,
          {
            reasonCode: result.reasonCode,
            couponEligibility: result.couponEligibility,
          },
        );
      const discounts = new Map<number, number>();
      for (const promotion of result.promotions)
        for (const allocation of promotion.allocations) {
          if (allocation.component === "item")
            discounts.set(
              allocation.lineId,
              addPaise(
                [discounts.get(allocation.lineId) ?? 0, allocation.amountPaise],
                MONEY_CAPS.ORDER_AMOUNT,
              ),
            );
        }
      const items = pricedItems.map(
        ({ categoryId: _categoryId, ...item }): PricingQuoteItem => {
          const itemDiscountPaise = discounts.get(item.lineId) ?? 0;
          const lineTotalPaise = subtractPaise(
            item.lineSubtotalPaise,
            itemDiscountPaise,
            { domainCap: MONEY_CAPS.ORDER_AMOUNT },
          );
          return {
            ...item,
            itemDiscountPaise,
            lineTotalPaise,
            ...calculateInclusiveTax(
              lineTotalPaise,
              context.itemTaxRule.rateBps,
            ),
            taxRuleId: context.itemTaxRule.id,
            taxRuleVersion: context.itemTaxRule.version,
            taxRateBps: context.itemTaxRule.rateBps,
            hsnSacCode: context.itemTaxRule.hsnSacCode,
          };
        },
      );
      const chargedDeliveryFeePaise = subtractPaise(
        standardDeliveryFeePaise,
        result.deliveryDiscountPaise,
        { domainCap: MONEY_CAPS.DELIVERY_FEE },
      );
      const deliveryTax = calculateInclusiveTax(
        chargedDeliveryFeePaise,
        context.deliveryTaxRule.rateBps,
      );
      const bundleMarkdownPaise = addPaise(
        items.map((item) => item.bundleMarkdownPaise),
        MAX_POSTGRES_INT,
      );
      const grandTotalPaise = addPaise(
        [
          subtractPaise(itemsSubtotalPaise, result.itemDiscountPaise, {
            domainCap: MONEY_CAPS.ORDER_AMOUNT,
          }),
          chargedDeliveryFeePaise,
        ],
        MONEY_CAPS.ORDER_AMOUNT,
      );
      return {
        quote: {
          quoteVersion: QUOTE_VERSION,
          currency: "INR",
          pricingPolicyVersion: PRICING_POLICY_VERSION,
          discountMode: result.discountMode,
          itemsSubtotalPaise,
          itemDiscountPaise: result.itemDiscountPaise,
          standardDeliveryFeePaise,
          chargedDeliveryFeePaise,
          deliveryDiscountPaise: result.deliveryDiscountPaise,
          promotionSavingsPaise: result.promotionSavingsPaise,
          bundleMarkdownPaise,
          totalDisplayedSavingsPaise: addPaise(
            [result.promotionSavingsPaise, bundleMarkdownPaise],
            MAX_POSTGRES_INT,
          ),
          roundingAdjustmentPaise: 0,
          grandTotalPaise,
          taxableAmountPaise: addPaise(
            [
              ...items.map((item) => item.taxableAmountPaise),
              deliveryTax.taxableAmountPaise,
            ],
            MONEY_CAPS.ORDER_AMOUNT,
          ),
          taxPaise: addPaise(
            [...items.map((item) => item.taxPaise), deliveryTax.taxPaise],
            MONEY_CAPS.ORDER_AMOUNT,
          ),
          items,
          couponEligibility: result.couponEligibility,
          promotions: result.promotions.map(quotePromotion),
          deliveryPricing: {
            ruleId: context.deliveryPricingRule.id,
            ruleVersion: context.deliveryPricingRule.version,
            storeId: input.storeId,
            businessDate: context.businessDate,
            timezone: context.store.timezone,
            standardFeePaise: standardDeliveryFeePaise,
            chargedFeePaise: chargedDeliveryFeePaise,
          },
          tax: {
            calculationPolicyVersion: TAX_CALCULATION_POLICY_VERSION,
            isDemo: true,
            disclaimer: DEMO_TAX_DISCLAIMER,
            placeOfSupplyState:
              input.destinationState?.trim() || context.store.state,
            placeOfSupplySource: input.destinationState?.trim()
              ? "delivery_address"
              : "store_estimate",
            itemRule: this.taxRuleSnapshot(context.itemTaxRule),
            deliveryRule: {
              ...this.taxRuleSnapshot(context.deliveryTaxRule),
              ...deliveryTax,
            },
          },
        },
      };
    } catch (error) {
      if (error instanceof RangeError || error instanceof TypeError)
        throw new AppError(
          "Pricing values exceed supported limits or are invalid",
          409,
          "PRICING_ITEMS_INVALID",
        );
      throw error;
    }
  }
  private async getPricingContext(
    storeId: number,
    now: Date,
    options: BuildPricingQuoteOptions,
  ) {
    if (!Number.isSafeInteger(storeId) || storeId <= 0) {
      throw new AppError(
        "Store pricing context is invalid",
        400,
        "DELIVERY_PRICING_STORE_INVALID",
      );
    }
    const store = await this.repository.findStorePricingContext(
      storeId,
      options.executor,
    );
    if (!store) {
      throw new AppError("Store not found", 404, "STORE_NOT_FOUND");
    }
    const businessDate = this.businessDateFor(now, store.timezone);
    const deliveryRules = await this.repository.findDeliveryPricingRules(
      storeId,
      businessDate,
      {
        executor: options.executor,
        lock: options.lockPromotions ?? false,
      },
    );
    if (deliveryRules.length === 0) {
      throw new AppError(
        "Delivery pricing is not configured for this store and date",
        422,
        "DELIVERY_PRICING_RULE_NOT_FOUND",
      );
    }
    if (deliveryRules.length > 1) {
      throw new AppError(
        "Delivery pricing rules overlap for this store and date",
        500,
        "DELIVERY_PRICING_RULE_OVERLAP",
      );
    }
    const itemTaxRule = await this.getTaxRule(
      storeId,
      "item",
      businessDate,
      options,
    );
    const deliveryTaxRule = await this.getTaxRule(
      storeId,
      "delivery",
      businessDate,
      options,
    );
    return {
      store,
      businessDate,
      deliveryPricingRule: deliveryRules[0],
      itemTaxRule,
      deliveryTaxRule,
    };
  }

  private async getTaxRule(
    storeId: number,
    component: DemoTaxComponent,
    businessDate: string,
    options: BuildPricingQuoteOptions,
  ) {
    const rules = await this.repository.findTaxRules(
      storeId,
      component,
      businessDate,
      { executor: options.executor, lock: options.lockPromotions ?? false },
    );
    if (rules.length === 0) {
      throw new AppError(
        `Demo ${component} tax rule is not configured for this store and date`,
        422,
        "TAX_RULE_NOT_FOUND",
      );
    }
    if (rules.length > 1) {
      throw new AppError(
        `Demo ${component} tax rules overlap for this store and date`,
        500,
        "TAX_RULE_OVERLAP",
      );
    }
    const [rule] = rules;
    if (!rule.isDemo || rule.disclaimer !== DEMO_TAX_DISCLAIMER) {
      throw new AppError(
        "Demo tax rule metadata is invalid",
        500,
        "TAX_RULE_METADATA_INVALID",
      );
    }
    return rule;
  }

  private taxRuleSnapshot(rule: TaxRuleRecord): TaxRuleSnapshot {
    return {
      ruleId: rule.id,
      ruleVersion: rule.version,
      rateBps: rule.rateBps,
      hsnSacCode: rule.hsnSacCode,
    };
  }

  private businessDateFor(now: Date, timezone: string) {
    if (Number.isNaN(now.getTime())) {
      throw new AppError(
        "Pricing time is invalid",
        400,
        "PRICING_TIME_INVALID",
      );
    }
    try {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(now);
      const value = Object.fromEntries(
        parts.map((part) => [part.type, part.value]),
      );
      return `${value.year}-${value.month}-${value.day}`;
    } catch {
      throw new AppError(
        "Store timezone configuration is invalid",
        500,
        "STORE_TIMEZONE_INVALID",
      );
    }
  }

  private priceItems(items: PricingItemInput[]) {
    if (items.length === 0) {
      throw new AppError("Cart is empty", 400, "CART_EMPTY");
    }

    const lineIds = new Set<number>();
    return items.map((item) => {
      if (lineIds.has(item.lineId)) {
        throw new AppError(
          "Cart contains duplicate line identifiers",
          409,
          "PRICING_ITEMS_INVALID",
        );
      }
      lineIds.add(item.lineId);

      try {
        const customizationTotalPaise = addPaise(
          item.customizations.map((customization) => customization.pricePaise),
          MONEY_CAPS.ITEM_PRICE,
          "Customization total",
        );
        const unitPricePaise = addPaise(
          [item.baseUnitPricePaise, customizationTotalPaise],
          MONEY_CAPS.ITEM_PRICE,
          "Unit price",
        );
        const lineSubtotalPaise = multiplyPaiseByQuantity(
          unitPricePaise,
          item.quantity,
          MONEY_CAPS.ORDER_AMOUNT,
        );
        if (item.quantity <= 0) {
          throw new RangeError("Quantity must be positive");
        }
        const productType = item.productType ?? "single";
        const compareAtUnitPricePaise = item.compareAtUnitPricePaise ?? null;
        if (productType === "bundle") {
          if (
            item.customizations.length > 0 ||
            compareAtUnitPricePaise === null ||
            compareAtUnitPricePaise <= unitPricePaise ||
            !item.bundleComponents?.length ||
            item.bundleComponents.some((component) => !component.isAvailable)
          ) {
            throw new RangeError("Bundle pricing is invalid");
          }
        } else if (
          compareAtUnitPricePaise !== null ||
          item.bundleComponents?.length
        ) {
          throw new RangeError("Single product cannot contain bundle metadata");
        }
        const bundleMarkdownPaise =
          productType === "bundle"
            ? multiplyPaiseByQuantity(
                compareAtUnitPricePaise! - unitPricePaise,
                item.quantity,
              )
            : 0;
        return {
          lineId: item.lineId,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          baseUnitPricePaise: item.baseUnitPricePaise,
          customizationUnitPricePaise: customizationTotalPaise,
          categoryId: item.categoryId,
          unitPricePaise,
          lineSubtotalPaise,
          customizations: item.customizations.map((customization) => ({
            ...customization,
          })),
          productType,
          compareAtUnitPricePaise,
          bundleMarkdownPaise,
          bundleComponents: (item.bundleComponents ?? []).map((component) => ({
            ...component,
          })),
        };
      } catch (cause) {
        if (cause instanceof RangeError || cause instanceof TypeError) {
          throw new AppError(
            "Cart contains invalid pricing",
            409,
            "PRICING_ITEMS_INVALID",
          );
        }
        throw cause;
      }
    });
  }
}
export default new PricingService();
