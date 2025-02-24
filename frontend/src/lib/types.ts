export type AddressType = "Home" | "Work" | "Other";
export type Role = "admin" | "user";
export type CustomizationType = "single" | "multiple";
export type OrderStatus = "pending" | "preparing" | "delievered" | "cancelled";
export type PaymentStatus = "pending" | "processing" | "completed" | "failed";
export type PaymentType = "cash" | "online";
export type CouponType = "percentage" | "fixed";

export interface User {
  id: number;
  fname: string;
  lname: string;
  password: string;
  email: string;
  role: "user" | "admin";
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type Address = {
  type: AddressType;
  id: number;
  createdAt: Date;
  updatedAt: Date;
  userId: number;
  street: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
};

export type Category = {
  id: number;
  name: string;
  featured: boolean | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type Product = {
  id: number;
  name: string;
  description: string | null;
  slug: string;
  veg: boolean | null;
  hasCustomization: boolean;
  price: number;
  image: string;
  categoryId: number;
};

export type MenuItem = {
  id: number;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  slug: string;
  image: string;
  position: number;
};

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
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  razorpaySignature: string | null;
};

export type CustomizationGroup = {
  type: CustomizationType;
  id: number;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  required: boolean;
};

export type CustomizationOption = {
  id: number;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  price: number | null;
  groupId: number;
};

export interface Group extends CustomizationGroup {
  options: CustomizationOption[];
}

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
