import { useQuery } from "@tanstack/react-query";
import { API } from "@/shared/api";
import { useUser } from "@/features/auth";
import {
  isPlatformAdmin,
  useAccessMe,
  useStaffActiveStore,
} from "@/features/access";
import {
  canManageStorePromotions,
  retryPromotionQuery,
} from "../model/promotion.helpers";
import { promotionKeys } from "../model/promotion.keys";
import type {
  AnalyticsFilters,
  Promotion,
  PromotionAnalytics,
  PromotionFilters,
  PromotionPage,
  StorePromotion,
} from "../model/promotion.types";

export const usePromotionAccess = () => {
  const { user, isLoggedIn } = useUser();
  const access = useAccessMe();
  const { activeStoreId } = useStaffActiveStore();
  return {
    userId: user?.id,
    activeStoreId,
    access,
    admin: isLoggedIn && !access.isError && isPlatformAdmin(access.data),
    manager:
      isLoggedIn &&
      !access.isError &&
      canManageStorePromotions(access.data, activeStoreId) === true,
  };
};

export const usePromotionStoreContext = (storeId: number) => {
  const { userId, admin, manager, activeStoreId } = usePromotionAccess();
  return useQuery({
    retry: retryPromotionQuery,
    queryKey: [...promotionKeys.principal(userId), "store-context", storeId],
    enabled: storeId > 0 && storeId === activeStoreId && (admin || manager),
    queryFn: async ({ signal }) =>
      (
        await API.get<{ data: { id: number; name: string; timezone: string } }>(
          `/stores/${storeId}`,
          { signal },
        )
      ).data.data,
  });
};
export const usePromotions = (filters: PromotionFilters) => {
  const { userId, admin } = usePromotionAccess();
  return useQuery({
    retry: retryPromotionQuery,
    queryKey: promotionKeys.list(userId, filters),
    enabled: admin,
    queryFn: async ({ signal }) =>
      (
        await API.get<{ data: PromotionPage<Promotion> }>("/promotions", {
          params: filters,
          signal,
        })
      ).data.data,
  });
};
export const usePromotion = (id: number) => {
  const { userId, admin } = usePromotionAccess();
  return useQuery({
    retry: retryPromotionQuery,
    queryKey: promotionKeys.detail(userId, id),
    enabled: admin && id > 0,
    queryFn: async ({ signal }) =>
      (await API.get<{ data: Promotion }>(`/promotions/${id}`, { signal })).data
        .data,
  });
};
export const usePromotionAnalytics = (
  id: number,
  filters: AnalyticsFilters,
  valid = true,
) => {
  const { userId, admin } = usePromotionAccess();
  return useQuery({
    retry: retryPromotionQuery,
    queryKey: promotionKeys.analytics(userId, id, filters),
    enabled: admin && id > 0 && valid,
    queryFn: async ({ signal }) =>
      (
        await API.get<{ data: PromotionAnalytics }>(
          `/promotions/${id}/analytics`,
          { params: filters, signal },
        )
      ).data.data,
  });
};
export const useStorePromotions = (
  storeId: number,
  filters: PromotionFilters,
) => {
  const { userId, manager, activeStoreId } = usePromotionAccess();
  return useQuery({
    retry: retryPromotionQuery,
    queryKey: promotionKeys.store(userId, storeId, filters),
    enabled: manager && storeId === activeStoreId,
    queryFn: async ({ signal }) =>
      (
        await API.get<{ data: PromotionPage<StorePromotion> }>(
          `/stores/${storeId}/promotions`,
          { params: filters, signal },
        )
      ).data.data,
  });
};
