
import { Group, Product, QUERY_KEYS } from "@/lib";
import { createMutation, createQuery } from "./useApi";

interface Res extends Group {
  products: Product[];
}

const useGetAllCustomizations = () => {
  return createQuery<Res[]>(
    [QUERY_KEYS.customizations.admin],
    "/customize/admin",
    "data"
  );
};

const useUpdateGroupMapping = () => {
  return createMutation<{ message: string }>(
    "/customize/mapping",
    "post",
    [
      [QUERY_KEYS.customizations.admin],
      [QUERY_KEYS.products.group],
    ]
  );
};

export const CUSTOMIZATION_API_HOOKS = {
  useGetAllCustomizations,
  useUpdateGroupMapping,
};
