import { API } from "@/lib/axios";
import { QUERY_KEYS } from "@/lib/constants";
import { Group, Product } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";

interface Res extends Group {
  products: Product[];
}

export const useGetAllCustomizations = () => {
  return useQuery({
    queryKey: [QUERY_KEYS.customizations.admin],
    queryFn: async () => {
      const { data } = await API.get("/customize/admin");
      return data.data as Res[];
    },
  });
};
