import type { User, Role } from "@/features/auth";
import type { Address, AddressType } from "@/features/account";
import type {
  Category,
  Product,
  MenuItem,
  CustomizationGroup,
  CustomizationOption,
  Option,
  Group,
  ProductWithCategory,
  CustomizationType,
} from "@/features/catalog";
import type { Cart, CartItem, ItemRes, CartRes } from "@/features/cart";

export type {
  User,
  Role,
  Address,
  AddressType,
  Category,
  Product,
  MenuItem,
  CustomizationGroup,
  CustomizationOption,
  Option,
  Group,
  ProductWithCategory,
  CustomizationType,
  Cart,
  CartItem,
  ItemRes,
  CartRes,
};

export type OrderStatus = "pending" | "preparing" | "delivered" | "delievered" | "cancelled";
export type PaymentStatus = "pending" | "processing" | "completed" | "failed";
export type PaymentType = "cash";
export type CouponType = "percentage" | "fixed";
export type ChatStatus = "open" | "close" | "rejected" | "pending";

export type Order = {
  status: OrderStatus;
  id: number;
  createdAt: Date;
  updatedAt: Date;
  userId: number;
  totalPrice: number;
  orderDate: Date | null;
  discountAmount: number;
  couponId: number | null;
  paymentType: PaymentType;
  paymentId: number | null;
  addressId: number | null;
};

export type OrderItem = {
  id: number;
  createdAt: Date;
  updatedAt: Date;
  price: number;
  productId: number;
  quantity: number;
  orderId: number;
};

export type Payment = {
  status: PaymentStatus;
  id: number;
  createdAt: Date;
  updatedAt: Date;
  paymentDate: Date;
};

export type Coupon = {
  id: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  code: string;
  discountType: CouponType;
  discountValue: number;
  minOrderValue: number;
  startDate: Date;
  endDate: Date;
  redemptionCount: number;
  maxRedemptions: number;
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

export interface DashCard {
  label: string;
  data: {
    current: string;
    previous: string;
    percentage: string;
    isLow: boolean;
    icon: {
      name: string;
      color: string;
    };
  };
}

export type GroupT = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

export interface ChatSession {
  status: ChatStatus;
  id: number;
  createdAt: Date;
  updatedAt: Date;
  userId: number;
  subject: string | null;
}

export interface ChatSessionWithUser extends ChatSession {
  user: User;
}

export interface Message {
  type: Role;
  timestamp: string;
  message: string;
  id: number;
}
