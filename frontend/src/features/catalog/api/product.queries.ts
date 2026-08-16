import { createMutation, createQuery } from "@/shared/api";
import { Product, ProductWithCategory } from "../model/catalog.types";
import { catalogKeys } from "../model/catalog.keys";

export const useGetProducts = ({
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
    catalogKeys.products.allMenu(menuSlug, page, sortBy),
    `/product/menu`,
    undefined,
    {
      menuSlug,
      page,
      sortBy,
    }
  );
};

export const useGetProductsA = () => {
  return createQuery<ProductWithCategory[]>(
    catalogKeys.products.admin(),
    "/product/admin",
    "data"
  );
};

export const useCreateProduct = () =>
  createMutation<{ data: Product }>("/product", "post", [
    catalogKeys.products.admin() as unknown as string[],
  ]);

export const useGetProductByCat = (categoryId: number | null) => {
  return createQuery<Product[]>(
    catalogKeys.products.byCategory(categoryId),
    `/product/category/${categoryId}`,
    "data",
    {},
    {
      enabled: !!categoryId,
    }
  );
};

export const useGetProductsByGroup = (groupId: number) => {
  return createQuery<
    {
      id: number;
      name: string;
    }[]
  >(
    catalogKeys.products.byGroup(groupId),
    `/product/group/${groupId}`,
    "data",
    {},
    {
      enabled: !!groupId,
    }
  );
};
