import type { Product } from "@/features/catalog";

export type Cart = {
  id: number;
  createdAt: Date;
  updatedAt: Date;
  userId: number;
  totalPrice: number;
};

export type CartItem = {
  id: number;
  createdAt: Date;
  updatedAt: Date;
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
}
