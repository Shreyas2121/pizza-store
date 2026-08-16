import { createQuery } from "@/shared/api";
import { catalogKeys } from "../model/catalog.keys";

export const useGetCategoriesSelect = () => {
  return createQuery<
    {
      label: string;
      value: string;
    }[]
  >(catalogKeys.category.select(), "/category/select", "data");
};
