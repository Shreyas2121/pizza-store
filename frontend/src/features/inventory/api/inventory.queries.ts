import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { catalogKeys } from "@/features/catalog";
import { storeKeys } from "@/features/store";
import { API } from "@/shared/api";
import type {
  AdjustmentValues,
  RestockValues,
  ThresholdValues,
} from "../model/inventory.schemas";
import type {
  InventoryListParams,
  InventoryListResponse,
} from "../model/inventory.types";

export const inventoryKeys = {
  all: ["inventory"] as const,
  list: (params: InventoryListParams) => ["inventory", "list", params] as const,
};

export const useInventoryList = (params: InventoryListParams) =>
  useQuery({
    queryKey: inventoryKeys.list(params),
    queryFn: async () => {
      const { data } = await API.get<InventoryListResponse>(
        `/inventory/store/${params.storeId}`,
        {
          params: {
            status: params.status,
            search: params.search || undefined,
            page: params.page,
            limit: params.limit,
          },
        }
      );
      return data;
    },
    enabled: params.storeId !== null && params.storeId > 0,
    placeholderData: keepPreviousData,
  });

const useInventoryInvalidation = (storeId: number | null) => {
  const client = useQueryClient();

  return async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: inventoryKeys.all }),
      client.invalidateQueries({ queryKey: catalogKeys.all }),
      client.invalidateQueries({ queryKey: catalogKeys.products.admin() }),
      client.invalidateQueries({ queryKey: ["all-menu"] }),
      client.invalidateQueries({ queryKey: ["dash-home-cards"] }),
      client.invalidateQueries({ queryKey: ["dash-home-charts"] }),
      ...(storeId
        ? [client.invalidateQueries({ queryKey: storeKeys.products(storeId) })]
        : []),
    ]);
  };
};

export const useRestockInventory = (storeId: number | null) => {
  const invalidate = useInventoryInvalidation(storeId);
  return useMutation({
    mutationFn: async ({ productId, values }: { productId: number; values: RestockValues }) =>
      (
        await API.post(
          `/inventory/store/${storeId}/product/${productId}/restock`,
          {
            quantityAdded: values.quantityAdded,
            reason: values.reason.trim() || undefined,
          }
        )
      ).data,
    onSuccess: invalidate,
  });
};

export const useAdjustInventory = (storeId: number | null) => {
  const invalidate = useInventoryInvalidation(storeId);
  return useMutation({
    mutationFn: async ({ productId, values }: { productId: number; values: AdjustmentValues }) =>
      (
        await API.post(
          `/inventory/store/${storeId}/product/${productId}/adjustment`,
          values
        )
      ).data,
    onSuccess: invalidate,
  });
};

export const useUpdateInventoryThreshold = (storeId: number | null) => {
  const invalidate = useInventoryInvalidation(storeId);
  return useMutation({
    mutationFn: async ({ productId, values }: { productId: number; values: ThresholdValues }) =>
      (
        await API.patch(
          `/inventory/store/${storeId}/product/${productId}/threshold`,
          values
        )
      ).data,
    onSuccess: invalidate,
  });
};
