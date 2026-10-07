import type { User } from "@/features/auth";
import type { Address } from "@/features/account";
import type { Payment, PaymentType } from "@/features/checkout";

export type OrderPromotion = {
  id: number; applicationId: number;
  kind: "offer" | "coupon"; name: string; code: string | null;
  discountType: "percentage" | "fixed_amount" | "buy_x_get_y" | "free_delivery" | "tiered";
  definitionVersion: number; status: "reserved" | "consumed" | "released";
  itemDiscountPaise: number; deliveryDiscountPaise: number; totalSavingsPaise: number;
  standardDeliveryFeePaise: number; chargedDeliveryFeePaise: number;
  allocations: { orderItemId: number | null; component: "item" | "delivery"; unitIndex: number | null; amountPaise: number }[];
};

export type OrderStatus =
  | "awaiting_payment"
  | "pending"
  | "preparing"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export const orderStatus: { label: string; value: OrderStatus }[] = [
  { label: "Awaiting Payment", value: "awaiting_payment" },
  { label: "Pending", value: "pending" },
  { label: "Preparing", value: "preparing" },
  { label: "Out for Delivery", value: "out_for_delivery" },
  { label: "Delivered", value: "delivered" },
  { label: "Cancelled", value: "cancelled" },
];

export type Order = {
  status: OrderStatus;
  id: number;
  createdAt: string;
  updatedAt: string;
  userId: number;
  totalPrice: number;
  grandTotalPaise: number;
  orderDate: string | null;
  discountAmount: number;
  discountMode: "none" | "automatic_deals" | "coupon";
  itemsSubtotalPaise: number; itemDiscountPaise: number;
  chargedDeliveryFeePaise: number; deliveryDiscountPaise: number;
  promotionSavingsPaise: number; bundleMarkdownPaise: number; totalDisplayedSavingsPaise: number;
  promotions: OrderPromotion[];
  paymentType: PaymentType;
  paymentId: number | null;
  addressId: number | null;
};

export type OrderItem = {
  id: number;
  createdAt: string;
  updatedAt: string;
  price: number;
  unitPricePaise: number;
  productName: string;
  productType: "single" | "bundle";
  compareAtUnitPricePaise: number | null;
  bundleMarkdownPaise: number;
  bundleComponents: { componentProductId: number; name: string; quantityPerBundle: number; totalQuantity: number }[];
  lineSubtotalPaise: number;
  productId: number;
  quantity: number;
  orderId: number;
};

export interface OrderItemRes extends OrderItem {
  product: { id: number; name: string; image: string | null };
  options: { id: number; name: string; pricePaise: number; price: number }[];
}

export interface OrderRes extends Order {
  address: Pick<Address, "id" | "type" | "street" | "city" | "state" | "pincode" | "phone"> | null;
  payment: Pick<Payment, "id" | "provider" | "status" | "providerStatus" | "amountPaise" | "currency" | "paidAt" | "failedAt"> | null;
  items: OrderItemRes[];
}

export interface OrdersAdmin extends Order {
  user: Pick<User, "id" | "fname" | "lname" | "email">;
}
