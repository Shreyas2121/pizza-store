
import { Group, Product, QUERY_KEYS } from "@/lib";
import { createQuery } from "./useApi";

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

export const CUSTOMIZATION_API_HOOKS = {
  useGetAllCustomizations,
};
