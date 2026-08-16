import { createMutation, createQuery } from "@/shared/api";
import { Group, Product } from "../model/catalog.types";
import { catalogKeys } from "../model/catalog.keys";

interface CustomizationGroupWithProducts extends Group {
  products: Product[];
}

export const useGetAllCustomizations = () => {
  return createQuery<CustomizationGroupWithProducts[]>(
    catalogKeys.customizations.admin(),
    "/customize/admin",
    "data"
  );
};

export const useUpdateGroupMapping = () => {
  return createMutation<{ message: string }>(
    "/customize/mapping",
    "post",
    [
      catalogKeys.customizations.admin() as unknown as string[],
    ]
  );
};

export const useGetProductCustomization = (id: number) => {
  return createQuery<
    {
      group: Group;
    }[]
  >(
    catalogKeys.products.customizations(id),
    `/customize/product/${id}`,
    "data",
    {},
    {
      enabled: !!id,
    }
  );
};
