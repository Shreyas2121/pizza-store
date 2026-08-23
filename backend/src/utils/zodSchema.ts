import { z } from "zod";
import dotenv from "dotenv";
dotenv.config({ quiet: true });

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
  RAZORPAY_KEY_ID: z.string().min(1).optional(),
  RAZORPAY_KEY_SECRET: z.string().min(1).optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(1).optional(),
}).superRefine((value, ctx) => {
  const razorpayValues = [
    value.RAZORPAY_KEY_ID,
    value.RAZORPAY_KEY_SECRET,
    value.RAZORPAY_WEBHOOK_SECRET,
  ];
  const configuredValues = razorpayValues.filter(Boolean).length;

  if (configuredValues > 0 && configuredValues < razorpayValues.length) {
    ctx.addIssue({
      code: "custom",
      message:
        "RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, and RAZORPAY_WEBHOOK_SECRET must be configured together",
      path: ["RAZORPAY_KEY_ID"],
    });
  }
});

export const env = envSchema.parse(process.env);

export const userSchema = z.object({
  username: z.string().min(3).max(255),
  email: z.email(),
  password: z.string().min(6).max(255),
  bio: z.string().max(255).optional(),
  profilePicture: z.url().optional(),
});

export const registerSchema = z.object({
  fname: z.string().min(1, "First name is required"),
  lname: z.string().min(1, "Last name is required"),
  email: z.email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const loginSchema = z.object({
  email: z.email("Invalid email format"),
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
  storeId: z.number().int().positive("Store ID is required"),
  cIds: z.array(z.number().int()).optional(),
});

export const updateCartItemSchema = z.object({
  cartItemId: z.number().int().positive("Cart item ID is required"),
  productId: z.number().int().positive("Product ID is required"),
  type: z.enum(["+", "-"]),
});

export const updateCartCustomizationSchema = z.object({
  cartItemId: z.number().int().positive("Cart item ID is required"),
  cIds: z.array(z.number().int().positive()).default([]),
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

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const createStoreSchema = z.object({
  name: z.string().min(1, "Store name is required"),
  slug: z.string().min(1).optional(),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  pincode: z.string().min(1, "Pincode is required"),
  phone: z.string().min(1, "Phone number is required"),
  email: z
    .string()
    .email("Invalid email format")
    .optional()
    .nullable()
    .or(z.literal("")),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  opensAt: z
    .string()
    .regex(timeRegex, "Opening time must be in HH:MM format (24h)"),
  closesAt: z
    .string()
    .regex(timeRegex, "Closing time must be in HH:MM format (24h)"),
  isActive: z.boolean().optional().default(true),
});

export const updateStoreSchema = createStoreSchema.partial();

const deliveryPincodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Pincode must contain exactly 6 digits");

export const resolveStoreSchema = z.object({
  pincode: deliveryPincodeSchema,
});

export const addDeliveryZonesSchema = z.object({
  pincodes: z
    .array(deliveryPincodeSchema)
    .min(1, "At least one pincode is required")
    .max(100, "A maximum of 100 pincodes can be added at once")
    .transform((pincodes) => [...new Set(pincodes)]),
});

const storeProductMappingSchema = z.object({
  productId: z.number().int().positive("Product ID must be a positive integer"),
  price: z.number().nonnegative("Price must be non-negative"),
  isAvailable: z.boolean().optional().default(true),
});

export const mapStoreProductsSchema = z
  .array(storeProductMappingSchema)
  .min(1, "At least one product mapping is required")
  .max(100, "A maximum of 100 products can be mapped at once")
  .superRefine((mappings, context) => {
    const seenProductIds = new Set<number>();

    mappings.forEach((mapping, index) => {
      if (seenProductIds.has(mapping.productId)) {
        context.addIssue({
          code: "custom",
          path: [index, "productId"],
          message: `Product ID ${mapping.productId} appears more than once`,
        });
      }
      seenProductIds.add(mapping.productId);
    });
  });

export const updateStoreProductSchema = z
  .object({
    price: z.number().nonnegative("Price must be non-negative").optional(),
    isAvailable: z.boolean().optional(),
  })
  .refine(
    (data) => data.price !== undefined || data.isAvailable !== undefined,
    "Price or availability is required"
  );
