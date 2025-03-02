import { API } from "@/lib/axios";
import { QUERY_KEYS } from "@/lib/constants";
import { useQuery } from "@tanstack/react-query";

export const useGetCategoriesSelect = () => {
  return useQuery({
    queryKey: [QUERY_KEYS.category.select],
    queryFn: async () => {
      const { data } = await API.get("/category/select");
      return data.data as {
        label: string;
        value: string;
      }[];
    },
  });
};
