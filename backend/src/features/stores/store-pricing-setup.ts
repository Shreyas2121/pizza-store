import { eq } from "drizzle-orm";
import { deliveryPricingRulesTable, taxRulesTable } from "../../db/schema";
import type { TransactionType } from "../../utils/types";
import { AppError } from "../../utils/error";
import { businessDateFor } from "../../utils/business-date";

export const DEFAULT_CHECKOUT_PRICING = {
  deliveryFeePaise: 4_000,
  freeDeliveryThresholdPaise: 50_000,
  itemTaxRateBps: 500,
  deliveryTaxRateBps: 500,
  itemHsnSacCode: "21069099-DEMO",
  deliveryHsnSacCode: "996331-DEMO",
} as const;

interface DatedRule {
  version: number;
  effectiveFrom: string;
  effectiveTo: string | null;
}

// Quote selection uses inclusive date bounds. Fill only the gap containing today;
// never replace history or extend a default into an already scheduled version.
export function planMissingPricingRule(rules: DatedRule[], businessDate: string) {
  const applicable = rules.filter((rule) => rule.effectiveFrom <= businessDate &&
    (rule.effectiveTo === null || rule.effectiveTo >= businessDate));
  if (applicable.length > 1) {
    throw new AppError("Overlapping checkout pricing rules must be resolved before initialization", 409, "PRICING_RULES_OVERLAP");
  }
  if (applicable.length === 1) return null;
  const next = rules.filter((rule) => rule.effectiveFrom > businessDate)
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))[0];
  let effectiveTo: string | null = null;
  if (next) {
    const previousDay = new Date(`${next.effectiveFrom}T00:00:00.000Z`);
    previousDay.setUTCDate(previousDay.getUTCDate() - 1);
    effectiveTo = previousDay.toISOString().slice(0, 10);
  }
  return {
    version: Math.max(0, ...rules.map((rule) => rule.version)) + 1,
    effectiveFrom: businessDate,
    effectiveTo,
  };
}

export async function initializeCheckoutPricing(
  tx: TransactionType,
  store: { id: number; timezone: string },
  now = new Date(),
) {
  const businessDate = businessDateFor(now, store.timezone);
  const deliveryRules = await tx.select().from(deliveryPricingRulesTable)
    .where(eq(deliveryPricingRulesTable.storeId, store.id));
  const taxRules = await tx.select().from(taxRulesTable)
    .where(eq(taxRulesTable.storeId, store.id));
  // Plan all components before writing. Caller holds the store-row lock so two
  // initializers cannot both observe the same missing rule/version.
  const delivery = planMissingPricingRule(deliveryRules, businessDate);
  const itemTax = planMissingPricingRule(taxRules.filter((rule) => rule.component === "item"), businessDate);
  const deliveryTax = planMissingPricingRule(taxRules.filter((rule) => rule.component === "delivery"), businessDate);
  if (delivery) await tx.insert(deliveryPricingRulesTable).values({
    storeId: store.id, ...delivery,
    deliveryFeePaise: DEFAULT_CHECKOUT_PRICING.deliveryFeePaise,
    freeDeliveryThresholdPaise: DEFAULT_CHECKOUT_PRICING.freeDeliveryThresholdPaise,
  });
  for (const [component, plan] of [["item", itemTax], ["delivery", deliveryTax]] as const) {
    if (plan) await tx.insert(taxRulesTable).values({
      storeId: store.id, component, ...plan,
      rateBps: component === "item" ? DEFAULT_CHECKOUT_PRICING.itemTaxRateBps : DEFAULT_CHECKOUT_PRICING.deliveryTaxRateBps,
      hsnSacCode: component === "item" ? DEFAULT_CHECKOUT_PRICING.itemHsnSacCode : DEFAULT_CHECKOUT_PRICING.deliveryHsnSacCode,
    });
  }
  return { businessDate, initialized: { delivery: !!delivery, itemTax: !!itemTax, deliveryTax: !!deliveryTax } };
}

export async function readCheckoutPricing(tx: TransactionType, store: { id: number; timezone: string }, now = new Date()) {
  const businessDate = businessDateFor(now, store.timezone);
  const delivery = await tx.select().from(deliveryPricingRulesTable).where(eq(deliveryPricingRulesTable.storeId, store.id));
  const taxes = await tx.select().from(taxRulesTable).where(eq(taxRulesTable.storeId, store.id));
  const applicable = <T extends DatedRule>(rules: T[]) => rules.filter((rule) =>
    rule.effectiveFrom <= businessDate && (rule.effectiveTo === null || rule.effectiveTo >= businessDate));
  const deliveryRules = applicable(delivery);
  const itemTaxRules = applicable(taxes.filter((rule) => rule.component === "item"));
  const deliveryTaxRules = applicable(taxes.filter((rule) => rule.component === "delivery"));
  return { businessDate, timezone: store.timezone, defaults: DEFAULT_CHECKOUT_PRICING,
    ready: deliveryRules.length === 1 && itemTaxRules.length === 1 && deliveryTaxRules.length === 1,
    deliveryRules, itemTaxRules, deliveryTaxRules };
}
