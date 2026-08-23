import type { User } from "@/features/auth";
import type { Address } from "@/features/account";
import type { Product, CustomizationOption } from "@/features/catalog";
import type { Coupon, Payment, PaymentType } from "@/features/checkout";

export type OrderStatus = "pending" | "preparing" | "delivered" | "delievered" | "cancelled";

export const orderStatus: { label: string; value: OrderStatus }[] = [
  { label: "Pending", value: "pending" },
  { label: "Preparing", value: "preparing" },
  { label: "Delivered", value: "delievered" },
  { label: "Cancelled", value: "cancelled" },
];

export type Order = {
  status: OrderStatus;
  id: number;
  createdAt: string;
  updatedAt: string;
  userId: number;
  totalPrice: number;
  orderDate: string | null;
  discountAmount: number;
  couponId: number | null;
  paymentType: PaymentType;
  paymentId: number | null;
  addressId: number | null;
};

export type OrderItem = {
  id: number;
  createdAt: string;
  updatedAt: string;
  price: number;
  productId: number;
  quantity: number;
  orderId: number;
};

export interface OrderItemRes extends OrderItem {
  product: Product;
  options: CustomizationOption[];
}

export interface OrderRes extends Order {
  address: Address;
  coupon: Coupon | null;
  payment: Payment | null;
  items: OrderItemRes[];
}

export interface OrdersAdmin extends Order {
  user: User;
}
