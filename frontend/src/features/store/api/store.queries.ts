import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API } from "@/shared/api";
import type { DeliveryZone, Store, StorePayload, StoreProduct } from "../model/store.types";

export const storeKeys = {
  all: ["stores"] as const,
  list: () => ["stores", "list"] as const,
  detail: (id: number) => ["stores", "detail", id] as const,
  products: (id: number) => ["stores", id, "products"] as const,
  zones: (id: number) => ["stores", id, "delivery-zones"] as const,
};

export const useAdminStores = () => useQuery({
  queryKey: storeKeys.list(),
  queryFn: async () => {
    const { data } = await API.get<{ data: Store[] }>("/stores", { params: { limit: 100 } });
    return data.data;
  },
});

export const useStoreDetail = (storeId: number) => useQuery({
  queryKey: storeKeys.detail(storeId),
  queryFn: async () => {
    const { data } = await API.get<{ data: Store }>(`/stores/${storeId}`);
    return data.data;
  },
  enabled: Number.isInteger(storeId) && storeId > 0,
});

export const useCreateStore = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (payload: StorePayload) => (await API.post<{ data: Store; message: string }>("/stores", payload)).data,
    onSuccess: () => client.invalidateQueries({ queryKey: storeKeys.all }),
  });
};

export const useUpdateStore = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<StorePayload> }) =>
      (await API.put<{ data: Store; message: string }>(`/stores/${id}`, data)).data,
    onSuccess: (_, variables) => {
      client.invalidateQueries({ queryKey: storeKeys.all });
      client.invalidateQueries({ queryKey: storeKeys.detail(variables.id) });
    },
  });
};

export const useDeactivateStore = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => (await API.delete<{ message: string }>(`/stores/${id}`)).data,
    onSuccess: () => client.invalidateQueries({ queryKey: storeKeys.all }),
  });
};

export const useStoreProducts = (storeId: number) => useQuery({
  queryKey: storeKeys.products(storeId),
  queryFn: async () => (await API.get<{ data: StoreProduct[] }>(`/stores/${storeId}/products`)).data.data,
  enabled: storeId > 0,
});

export const useMapStoreProducts = (storeId: number) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (mappings: Array<{ productId: number; pricePaise: number; isAvailable: boolean }>) =>
      (await API.post(`/stores/${storeId}/products`, mappings)).data,
    onSuccess: () => client.invalidateQueries({ queryKey: storeKeys.products(storeId) }),
  });
};

export const useUpdateStoreProduct = (storeId: number) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, data }: { productId: number; data: { pricePaise?: number; isAvailable?: boolean } }) =>
      (await API.put(`/stores/${storeId}/products/${productId}`, data)).data,
    onSuccess: () => client.invalidateQueries({ queryKey: storeKeys.products(storeId) }),
  });
};

export const useRemoveStoreProduct = (storeId: number) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (productId: number) => (await API.delete(`/stores/${storeId}/products/${productId}`)).data,
    onSuccess: () => client.invalidateQueries({ queryKey: storeKeys.products(storeId) }),
  });
};

export const useDeliveryZones = (storeId: number) => useQuery({
  queryKey: storeKeys.zones(storeId),
  queryFn: async () => (await API.get<{ data: DeliveryZone[] }>(`/stores/${storeId}/delivery-zones`)).data.data,
  enabled: storeId > 0,
});

export const useAddDeliveryZones = (storeId: number) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (pincodes: string[]) => (await API.post<{ message: string; meta: { addedCount: number; skippedCount: number } }>(`/stores/${storeId}/delivery-zones`, { pincodes })).data,
    onSuccess: () => client.invalidateQueries({ queryKey: storeKeys.zones(storeId) }),
  });
};

export const useRemoveDeliveryZone = (storeId: number) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (zoneId: number) => (await API.delete(`/stores/${storeId}/delivery-zones/${zoneId}`)).data,
    onSuccess: () => client.invalidateQueries({ queryKey: storeKeys.zones(storeId) }),
  });
};
