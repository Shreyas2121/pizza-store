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
import type {
  ChatStatus,
  ChatSession,
  ChatSessionWithUser,
  Message,
} from "@/features/support";

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
  ChatStatus,
  ChatSession,
  ChatSessionWithUser,
  Message,
};

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
