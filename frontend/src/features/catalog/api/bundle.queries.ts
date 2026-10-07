import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { API } from "@/shared/api";
import { storeKeys } from "@/features/store";
import { catalogKeys } from "../model/catalog.keys";
import type { BundleComponent } from "../model/catalog.types";
import type { BundleWrite } from "../model/bundle.schemas";

export type BundleDefinition = {
  bundleProductId: number;
  bundleName: string;
  components: BundleComponent[];
  storePrices: Array<BundleWrite["storePrices"][number]>;
};

type PublicBundle = {
  productId: number;
  productType: "bundle";
  name: string;
  description: string | null;
  imageUrl: string;
  storeId: number;
  sellingPricePaise: number;
  compareAtPricePaise: number;
  markdownPaise: number;
  isAvailable: boolean;
  unavailableComponentIds: number[];
  components: BundleComponent[];
};

export const useAdminBundle = (id: number) => useQuery({
  queryKey: catalogKeys.bundles.admin(id),
  enabled: Number.isInteger(id) && id > 0,
  retry: false,
  queryFn: async ({ signal }) => {
    try { return (await API.get<{ data: BundleDefinition }>(`/bundles/admin/${id}`, { signal })).data.data; }
    catch (cause) {
      if (isAxiosError(cause) && cause.response?.status === 404 && cause.response.data?.message === "Bundle definition not found") return null;
      throw cause;
    }
  },
});

export const useSaveBundle = (id: number, exists: boolean) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (payload: BundleWrite) => (await API[exists ? "put" : "post"]<{ data: BundleDefinition }>(`/bundles/admin/${id}`, payload)).data.data,
    onSuccess: async (definition) => {
      client.setQueryData(catalogKeys.bundles.admin(id), definition);
      await Promise.all([client.invalidateQueries({ queryKey: catalogKeys.all }), client.invalidateQueries({ queryKey: storeKeys.all })]);
    },
  });
};

export const usePublicBundle = (id: number, storeId: number, enabled: boolean) => useQuery({
  queryKey: catalogKeys.bundles.public(id, storeId),
  enabled: enabled && storeId > 0,
  queryFn: async ({ signal }) => (await API.get<{ data: PublicBundle }>(`/bundles/${id}`, { params: { storeId }, signal })).data.data,
});
