import { promotionDefinitionWriteSchema, type PromotionDefinitionWriteInput } from "../features/promotions";

export const PROMOTION_FIXTURE_DATE = new Date("2026-10-07T06:30:00.000Z");
export const PROMOTION_FIXTURE_VALIDITY = {
  startsAt: "2026-01-01T00:00:00.000Z", endsAt: "2030-01-01T00:00:00.000Z",
  activeDaysOfWeek: null, activeStartTime: null, activeEndTime: null,
};
export const PROMOTION_FIXTURE_BUNDLE = {
  name: "Pizza and Coke Combo", slug: "pizza-and-coke-combo", pricePaise: 32_900,
  compareAtPricePaise: 35_900, image: "/uploads/pizza-1.avif",
  description: "One Margherita pizza and one Coca-Cola. Fixed combo price; no customizations.",
  components: [{ slug: "margherita-pizza", quantity: 1 }, { slug: "coca-cola", quantity: 1 }],
};
export const PROMOTION_FIXTURE_MEDIA = {
  desktop: "00000000-0000-4000-8000-000000000014.webp",
  mobile: "00000000-0000-4000-8000-000000000015.webp",
  fallbackDesktop: "00000000-0000-4000-8000-000000000016.webp",
  alt: "Demo pizza offer: save 10 percent on Margherita base price. Checkout confirms eligibility.",
};
export const PROMOTION_FIXTURE_OPT_OUT_NAME = "Demo pizza 10 percent";
export const PROMOTION_FIXTURE_OPT_OUT_REASON = "Deterministic Bengaluru opt-out example";

// IDs come from the catalogue, never from assumptions about serial sequences.
export function promotionFixtures(ids: { pizzaId: number; pizzaCategoryId: number }): PromotionDefinitionWriteInput[] {
  const base: PromotionDefinitionWriteInput = {
    kind: "offer", name: PROMOTION_FIXTURE_OPT_OUT_NAME,
    description: "10 percent off Margherita base price. No coupon stacking.", code: null,
    discount: { type: "percentage", rateBps: 1_000, maxDiscountPaise: 10_000 }, scope: "product",
    includeCustomizationValue: false,
    eligibility: { minimumOrderPaise: 0, minimumCartQuantity: 0, firstOrderOnly: false },
    validity: PROMOTION_FIXTURE_VALIDITY,
    limits: { perUserRedemptions: null, globalRedemptions: 1_000, budgetPaise: 5_000_000 },
    display: { priority: 100, showOnHomepage: true }, isActive: true,
    rules: [{ type: "product_include", productId: ids.pizzaId }],
  };
  const unfeatured = { priority: 10, showOnHomepage: false };
  return [
    base,
    { ...base, name: "Demo pizza 20 rupees off", description: "Fixed saving on pizza base prices; desktop artwork also serves mobile fallback.",
      scope: "category", discount: { type: "fixed_amount", amountPaise: 2_000 }, display: { priority: 90, showOnHomepage: true },
      rules: [{ type: "category_include", categoryId: ids.pizzaCategoryId }] },
    { ...base, name: "Demo buy two get one pizza", description: "Buy two pizzas and get one eligible pizza free; add three pizzas.",
      scope: "category", discount: { type: "buy_x_get_y" }, display: unfeatured,
      rules: [{ type: "buy_x_get_y", buyQuantity: 2, getQuantity: 1, buyProductIds: [], getProductIds: [],
        buyCategoryIds: [ids.pizzaCategoryId], getCategoryIds: [ids.pizzaCategoryId] }] },
    { ...base, name: "Demo delivery saving", description: "Waive charged delivery from an item subtotal of 200 rupees.",
      scope: "delivery", discount: { type: "free_delivery" }, display: unfeatured, rules: [],
      eligibility: { ...base.eligibility, minimumOrderPaise: 20_000 } },
    { ...base, name: "Demo cart tiers", description: "Save 5 percent from 1000 rupees or 10 percent from 2000 rupees.",
      scope: "cart", discount: { type: "tiered" }, display: unfeatured,
      rules: [
        { type: "tier", minimumSubtotalPaise: 100_000, discount: { type: "percentage", rateBps: 500, maxDiscountPaise: 20_000 } },
        { type: "tier", minimumSubtotalPaise: 200_000, discount: { type: "percentage", rateBps: 1_000, maxDiscountPaise: 40_000 } },
      ] },
    ...([
      { name: "Demo manual 10 percent", code: "DEMO10", discount: { type: "percentage", rateBps: 1_000, maxDiscountPaise: 10_000 } },
      { name: "Demo manual 30 rupees", code: "DEMO30", discount: { type: "fixed_amount", amountPaise: 3_000 } },
      { name: "Demo first-order tiers", code: "DEMOFIRST", discount: { type: "tiered" } },
    ] satisfies Pick<PromotionDefinitionWriteInput, "name" | "code" | "discount">[]).map((coupon) => ({
      ...base, ...coupon, kind: "coupon" as const, scope: "cart" as const, display: unfeatured,
      description: "Manual code only, on an offer-free cart without a deal combo.",
      eligibility: { ...base.eligibility, firstOrderOnly: coupon.code === "DEMOFIRST" },
      limits: { ...base.limits, perUserRedemptions: 2 },
      rules: coupon.discount.type === "tiered" ? [{ type: "tier" as const, minimumSubtotalPaise: 10_000,
        discount: { type: "fixed_amount" as const, amountPaise: 1_000 } }] : [],
    })),
  ].map((definition) => promotionDefinitionWriteSchema.parse(definition));
}
