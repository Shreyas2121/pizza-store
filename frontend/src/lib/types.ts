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
import type {
  Coupon,
  Payment,
  PaymentType,
  PaymentStatus,
  CouponType,
} from "@/features/checkout";
import type {
  Order,
  OrderItem,
  OrderItemRes,
  OrderRes,
  OrdersAdmin,
  OrderStatus,
} from "@/features/orders";

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
  Coupon,
  Payment,
  PaymentType,
  PaymentStatus,
  CouponType,
  Order,
  OrderItem,
  OrderItemRes,
  OrderRes,
  OrdersAdmin,
  OrderStatus,
};

export type ChatStatus = "open" | "close" | "rejected" | "pending";

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
