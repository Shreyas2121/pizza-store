import type { PromotionDefinition, PromotionDiscount, PromotionRule } from "@/features/promotions";

// Customer contract: deliberately excludes codes, budgets, usage and administration fields.
export interface PublicOffer {
  id: number;
  definitionVersion: number;
  kind: "offer";
  name: string;
  description: string | null;
  discount: PromotionDiscount;
  scope: PromotionDefinition["scope"];
  eligibilitySummary: PromotionDefinition["eligibility"] & PromotionDefinition["validity"] & { timezone: string };
  targets: { productIds: number[]; categoryIds: number[] };
  rules: PromotionRule[];
  display: { priority: number; imageUrl: string | null; mobileImageUrl: string | null; imageAlt: string | null };
}
