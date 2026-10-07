import type { AnalyticsFilters, PromotionFilters } from "./promotion.types";
// Principal and store are part of every private cache key. Never reuse placeholder data across them.
export const promotionKeys = {
  all: ["promotions", "governance"] as const,
  principal: (userId: number | undefined) =>
    [...promotionKeys.all, userId] as const,
  list: (userId: number | undefined, filters: PromotionFilters) =>
    [...promotionKeys.principal(userId), "admin", "list", filters] as const,
  detail: (userId: number | undefined, id: number) =>
    [...promotionKeys.principal(userId), "admin", "detail", id] as const,
  analytics: (
    userId: number | undefined,
    id: number,
    filters: AnalyticsFilters,
  ) =>
    [
      ...promotionKeys.principal(userId),
      "admin",
      "analytics",
      id,
      filters,
    ] as const,
  store: (
    userId: number | undefined,
    storeId: number,
    filters: PromotionFilters,
  ) => [...promotionKeys.principal(userId), "store", storeId, filters] as const,
};
