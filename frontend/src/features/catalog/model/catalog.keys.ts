export const catalogKeys = {
  all: ["catalog"] as const,
  products: {
    all: ["products"] as const,
    allMenu: (menuSlug?: string | null, page?: string, sortBy?: string, storeId?: number) =>
      ["all-menu", menuSlug, page, sortBy, storeId] as const,
    admin: () => ["adminA"] as const,
    byCategory: (catId: number | null) => ["products-cat", catId] as const,
    byGroup: (groupId: number) => ["products-group", groupId] as const,
    customizations: (id: number) => ["group", id] as const,
  },
  menu: {
    all: () => ["menu-all"] as const,
  },
  category: {
    select: () => ["Select Category"] as const,
  },
  customizations: {
    admin: () => ["allCustomizationsA"] as const,
  },
};
