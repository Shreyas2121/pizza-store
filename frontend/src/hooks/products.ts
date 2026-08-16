import { Group, Product, ProductWithCategory, QUERY_KEYS } from "@/lib";
import { createMutation, createQuery } from "./useApi";

const useGetProducts = ({
  menuSlug,
  page,
  sortBy,
}: {
  menuSlug?: string | null;
  page: string;
  sortBy: string;
}) => {
  return createQuery<{
    data: Product[];
    meta: {
      page: number;
      limit: number;
      hasNextPage: boolean;
    };
  }>(
    [QUERY_KEYS.products.allMenu, menuSlug, page, sortBy],
    `/product/menu`,
    undefined,
    {
      menuSlug,
      page,
      sortBy,
    }
  );
};

const useGetProductCustomization = (id: number) => {
  return createQuery<
    {
      group: Group;
    }[]
  >(
    [QUERY_KEYS.products.groupC, id],
    `/customize/product/${id}`,
    "data",
    {},
    {
      enabled: !!id,
    }
  );
};

const useGetProductsA = () => {
  return createQuery<ProductWithCategory[]>(
    [QUERY_KEYS.products.adminA],
    "/product/admin",
    "data"
  );
};

const useCreateProduct = () =>
  createMutation<{ data: Product }>("/product", "post", [
    [QUERY_KEYS.products.adminA],
    [QUERY_KEYS.products.allMenu],
  ]);

const useGetProductByCat = (categoryId: number | null) => {
  return createQuery<Product[]>(
    [QUERY_KEYS.products.cat, categoryId],
    `/product/category/${categoryId}`,
    "data",
    {},
    {
      enabled: !!categoryId,
    }
  );
};

const useGetProductsByGroup = (groupId: number) => {
  return createQuery<
    {
      id: number;
      name: string;
    }[]
  >(
    [QUERY_KEYS.products.group, groupId],
    `/product/group/${groupId}`,
    "data",
    {},
    {
      enabled: !!groupId,
    }
  );
};

export const PRODUCTS_HOOKS = {
  useGetProductByCat,
  useGetProductCustomization,
  useGetProducts,
  useGetProductsA,
  useGetProductsByGroup,
  useCreateProduct,
};
