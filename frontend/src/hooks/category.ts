import { QUERY_KEYS } from "@/lib";
import { createQuery } from "./useApi";

const useGetCategoriesSelect = () => {
  return createQuery<
    {
      label: string;
      value: string;
    }[]
  >([QUERY_KEYS.category.select], "/category/select", "data");
};

export const CATEGORY_API_HOOKS = {
  useGetCategoriesSelect,
};
