import type { User } from "@/features/auth";
import type { Address } from "@/features/account";
import type { Payment, PaymentType, PromotionSnapshot, DiscountMode } from "@/features/checkout";

export type OrderPromotion = PromotionSnapshot & {
  applicationId: number;
  status: "reserved" | "consumed" | "released";
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
  discountMode: DiscountMode;
  itemsSubtotalPaise: number; itemDiscountPaise: number;
  chargedDeliveryFeePaise: number; deliveryDiscountPaise: number;
  promotionSavingsPaise: number; bundleMarkdownPaise: number; totalDisplayedSavingsPaise: number;
  promotions: OrderPromotion[];
  roundingAdjustmentPaise: number;
  taxableAmountPaise: number;
  taxPaise: number;
  taxDisclaimer: string | null;
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
  discountAllocationPaise: number;
  lineTotalPaise: number;
  taxableAmountPaise: number;
  taxPaise: number;
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
