import type { Product, BundleComponent } from "@/features/catalog";
import type { Store } from "@/features/store";

export type Cart = {
  id: number;
  createdAt: string;
  updatedAt: string;
  userId: number;
  totalPaise: number;
  storeId: number | null;
};

export type CartItem = {
  id: number;
  createdAt: string;
  updatedAt: string;
  cartId: number;
  pricePaise: number;
  productId: number;
  quantity: number;
};

export interface ItemRes extends CartItem {
  productType?: "single" | "bundle";
  compareAtUnitPricePaise?: number;
  bundleMarkdownPaise?: number;
  bundleComponents?: Array<BundleComponent & { totalQuantity: number }>;
  product: Product;
  customizations: {
    optionId: number;
    pricePaise: number;
    name: string;
  }[];
}

export interface CartRes extends Cart {
  items: ItemRes[];
  store: Store | null;
}
