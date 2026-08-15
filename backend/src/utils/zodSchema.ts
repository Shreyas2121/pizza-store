import { z } from "zod";
import dotenv from "dotenv";
dotenv.config();

const envSchema = z.object({
  PORT: z.string().min(4).max(4),
  DATABASE_URL: z.string().optional(),
  DB_HOST: z.string().optional(),
  DB_PORT: z.string().optional(),
  DB_USER: z.string().optional(),
  DB_PASSWORD: z.string().optional(),
  DB_NAME: z.string().optional(),
  JWT_SECRET: z.string(),
  FE_URL: z.string(),
});

export const env = envSchema.parse(process.env);

export const userSchema = z.object({
  username: z.string().min(3).max(255),
  email: z.string().email(),
  password: z.string().min(6).max(255),
  bio: z.string().max(255).optional(),
  profilePicture: z.string().url().optional(),
});

export const registerSchema = z.object({
  fname: z.string().min(1, "First name is required"),
  lname: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

export const createAddressSchema = z.object({
  type: z.enum(["Home", "Work", "Other"]),
  street: z.string().min(1, "Street is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  pincode: z.string().min(1, "Pincode is required"),
  phone: z.string().min(1, "Phone is required"),
});

export const createOrderSchema = z.object({
  addressId: z.number().int().positive("Valid address ID is required"),
  totalPrice: z.number().nonnegative("Total price must be non-negative"),
  paymentType: z.enum(["cash"]).optional(),
  couponId: z.number().int().nullable().optional(),
  discountAmount: z.number().nonnegative().optional(),
});

export const addToCartSchema = z.object({
  productId: z.number().int().positive("Product ID is required"),
  cIds: z.array(z.number().int()).optional(),
});

export const updateCartItemSchema = z.object({
  cartItemId: z.number().int().positive("Cart item ID is required"),
  productId: z.number().int().positive("Product ID is required"),
  type: z.enum(["+", "-"]),
});

export const createCouponSchema = z.object({
  code: z.string().min(1, "Coupon code is required"),
  discountType: z.enum(["percentage", "fixed"]),
  discountValue: z.number().positive("Discount value must be positive"),
  minOrderValue: z.number().nonnegative().optional(),
  maxRedemptions: z.number().int().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});
