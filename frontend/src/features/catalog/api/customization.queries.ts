import { createMutation, createQuery } from "@/shared/api";
import { Group, Product, CustomizationGroup, CustomizationOption } from "../model/catalog.types";
import { catalogKeys } from "../model/catalog.keys";

export const useCreateCustomizationGroup = () => createMutation<{ data: CustomizationGroup }, { name: string; type: "single" | "multiple"; required: boolean }>(
  "/customize/group", "post", [[...catalogKeys.all]]
);
export const useCreateCustomizationOption = () => createMutation<{ data: CustomizationOption }, { groupId: number; name: string; pricePaise: number; isAvailable: boolean }>(
  "/customize/option", "post", [[...catalogKeys.all]]
);

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
      [...catalogKeys.all],
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
