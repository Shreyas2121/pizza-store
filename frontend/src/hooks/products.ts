import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "../lib/constants";
import { API } from "../lib/axios";
import { Group, Product, ProductWithCategory } from "../lib/types";

export const useGetProducts = ({
  menuSlug,
  page,
  sortBy,
}: {
  menuSlug?: string | null;
  page: string;
  sortBy: string;
}) => {
  return useQuery({
    queryKey: [QUERY_KEYS.products.allMenu, menuSlug, page, sortBy],
    queryFn: async () => {
      const { data } = await API.get(`/product/menu`, {
        params: {
          menuSlug,
          page,
          sortBy,
        },
      });
      return data as {
        data: Product[];
        meta: {
          page: number;
          limit: number;
          hasNextPage: boolean;
        };
      };
    },
  });
};

export const useGetProductCustomization = (id: number) => {
  return useQuery({
    queryKey: [QUERY_KEYS.products.groupC, id],
    queryFn: async () => {
      const { data } = await API.get(`/customize/product/${id}`);
      return data.data as {
        group: Group;
      }[];
    },
    enabled: !!id,
  });
};

export const useGetProductsA = () => {
  return useQuery({
    queryKey: [QUERY_KEYS.products.adminA],
    queryFn: async () => {
      const { data } = await API.get("/product/admin");
      return data.data as ProductWithCategory[];
    },
  });
};

export const useGetProductByCat = (categoryId: number | null) => {
  return useQuery({
    queryKey: [QUERY_KEYS.products.cat, categoryId],
    queryFn: async () => {
      const { data } = await API.get(`/product/category/${categoryId}`);
      return data.data as Product[];
    },
    enabled: !!categoryId,
  });
};

export const useGetProductsByGroup = (groupId: number) => {
  return useQuery({
    queryKey: [QUERY_KEYS.products.group, groupId],
    queryFn: async () => {
      const { data } = await API.get(`/product/group/${groupId}`);
      return data.data as {
        id: number;
        name: string;
      }[];
    },
    enabled: !!groupId,
  });
};
