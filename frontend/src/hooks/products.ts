import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "../lib/constants";
import { API } from "../lib/axios";
import { Group, Product } from "../lib/types";

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
