import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { API } from "@/shared/api";
import type { Product } from "@/features/catalog";
import type { PublicOffer } from "../model/offers.types";
import { orderOffers } from "../model/offers.helpers";

export const offersKeys = {
  list: (storeId: number | undefined, featured = false) => ["public-offers", storeId, featured] as const,
  products: (storeId: number | undefined, offerId: number) => ["offer-products", storeId, offerId] as const,
};
export const offersQueryOptions = (storeId: number | undefined, featured = false) => ({
  queryKey: offersKeys.list(storeId, featured),
  enabled: storeId !== undefined,
  staleTime: 0,
  refetchOnWindowFocus: true,
  queryFn: async ({ signal }: { signal: AbortSignal }) => {
    const response = await API.get<{ data: PublicOffer[] }>(featured ? "/promotions/featured" : "/promotions/offers", { params: { storeId }, signal });
    return orderOffers(response.data.data);
  },
});
export const useAvailableOffers = (storeId: number | undefined, featured = false) => useQuery(offersQueryOptions(storeId, featured));

type ProductPage = { data: Product[]; meta: { page: number; hasNextPage: boolean } };
export const useOfferProducts = (storeId: number | undefined, offerId: number, enabled: boolean) => useInfiniteQuery({
  queryKey: offersKeys.products(storeId, offerId),
  enabled: storeId !== undefined && enabled,
  initialPageParam: 1,
  queryFn: async ({ signal, pageParam }) => (await API.get<ProductPage>("/product/menu", { params: { storeId, page: pageParam, sortBy: "default" }, signal })).data,
  getNextPageParam: (last) => last.meta.hasNextPage ? last.meta.page + 1 : undefined,
});
