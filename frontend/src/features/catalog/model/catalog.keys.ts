const CATALOG_QUERY_ROOT = "catalog";
export const catalogKeys = {
  all: [CATALOG_QUERY_ROOT] as const,
  products: {
    all: [CATALOG_QUERY_ROOT, "products"] as const,
    allMenu: (menuSlug?: string | null, page?: string, sortBy?: string, storeId?: number) =>
      [CATALOG_QUERY_ROOT, "all-menu", menuSlug, page, sortBy, storeId] as const,
    admin: () => [CATALOG_QUERY_ROOT, "adminA"] as const,
    byCategory: (catId: number | null) => [CATALOG_QUERY_ROOT, "products-cat", catId] as const,
    byGroup: (groupId: number) => [CATALOG_QUERY_ROOT, "products-group", groupId] as const,
    customizations: (id: number) => [CATALOG_QUERY_ROOT, "group", id] as const,
  },
  menu: {
    all: () => [CATALOG_QUERY_ROOT, "menu-all"] as const,
  },
  category: {
    select: () => [CATALOG_QUERY_ROOT, "Select Category"] as const,
  },
  customizations: {
    admin: () => [CATALOG_QUERY_ROOT, "allCustomizationsA"] as const,
  },
};
