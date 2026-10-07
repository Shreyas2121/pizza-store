import { createMutation, createQuery } from "@/shared/api";
import type { Category } from "../model/catalog.types";
import { catalogKeys } from "../model/catalog.keys";

export const useGetCategories = () => createQuery<Category[]>(catalogKeys.category.all(), "/category", "data");
export const useCreateCategory = () => createMutation<{ data: Category }, { name: string }>(
  "/category", "post", [[...catalogKeys.category.all()], [...catalogKeys.category.select()]]
);

export const useGetCategoriesSelect = () => {
  return createQuery<
    {
      label: string;
      value: string;
    }[]
  >(catalogKeys.category.select(), "/category/select", "data");
};
