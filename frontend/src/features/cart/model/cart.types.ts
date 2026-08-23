import type { Product } from "@/features/catalog";
import type { Store } from "@/features/store";

export type Cart = {
  id: number;
  createdAt: string;
  updatedAt: string;
  userId: number;
  totalPrice: number;
  storeId: number | null;
};

export type CartItem = {
  id: number;
  createdAt: string;
  updatedAt: string;
  cartId: number;
  price: number;
  productId: number;
  quantity: number;
};

export interface ItemRes extends CartItem {
  product: Product;
  customizations: {
    optionId: number;
    price: number;
    name: string;
  }[];
}

export interface CartRes extends Cart {
  items: ItemRes[];
  store: Store | null;
}
