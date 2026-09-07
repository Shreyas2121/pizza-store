import { z } from "zod";
import dotenv from "dotenv";
dotenv.config({ quiet: true });

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.string().min(4).max(4),
  DATABASE_URL: z.string().optional(),
  DB_HOST: z.string().optional(),
  DB_PORT: z.string().optional(),
  DB_USER: z.string().optional(),
  DB_PASSWORD: z.string().optional(),
  DB_NAME: z.string().optional(),
  JWT_SECRET: z.string(),
  JWT_ALGORITHM: z.literal("HS256").default("HS256"),
  JWT_ISSUER: z.string().min(1).default("pizzastore-api"),
  JWT_AUDIENCE: z.string().min(1).default("pizzastore-web"),
  JWT_EXPIRES_IN: z.enum(["4h", "6h", "8h"]).default("6h"),
  STAFF_INVITATION_EXPIRY_HOURS: z.coerce.number().int().min(1).max(168).default(48),
  FE_URL: z.string(),
  RAZORPAY_KEY_ID: z.string().min(1).optional(),
  RAZORPAY_KEY_SECRET: z.string().min(1).optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(1).optional(),
  RAZORPAY_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  PAYMENT_PROVIDER_MODE: z
    .enum(["simulator", "razorpay_test", "razorpay_live"])
    .default("simulator"),
  REFUND_MANAGER_APPROVAL_LIMIT_PAISE: z.coerce.number()
    .int().positive().max(2_147_483_647).default(500_000),
  EXPENSE_MANAGER_APPROVAL_LIMIT_PAISE: z.coerce.number()
    .int().positive().max(50_000_000).default(500_000),
  PAYROLL_ENCRYPTION_KEY: z.string().min(32).optional(),
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

  if (
    (value.RAZORPAY_ENABLED || value.PAYMENT_PROVIDER_MODE === "razorpay_test") &&
    configuredValues !== razorpayValues.length
  ) {
    ctx.addIssue({
      code: "custom",
      message: "Razorpay credentials are required for enabled Test Mode",
      path: ["RAZORPAY_ENABLED"],
    });
  }

  if (value.PAYMENT_PROVIDER_MODE === "razorpay_live") {
    ctx.addIssue({
      code: "custom",
      message: "Live payment processing is unsupported; use simulator or razorpay_test",
      path: ["PAYMENT_PROVIDER_MODE"],
    });
  }

  if (value.RAZORPAY_KEY_ID?.startsWith("rzp_live_")) {
    ctx.addIssue({
      code: "custom",
      message: "Live Razorpay credentials are not accepted by this portfolio application",
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

const normalizedEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Invalid email format"));

export const registerSchema = z.object({
  fname: z.string().min(1, "First name is required"),
  lname: z.string().min(1, "Last name is required"),
  email: normalizedEmailSchema,
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const loginSchema = z.object({
  email: normalizedEmailSchema,
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
  paymentType: z.literal("cash").default("cash"),
  couponCode: z
    .string()
    .trim()
    .min(1, "Coupon code cannot be empty")
    .max(100, "Coupon code is too long")
    .transform((code) => code.toUpperCase())
    .nullable()
    .optional(),
}).strict();

export const initiateRazorpayOrderSchema = z
  .object({
    addressId: z.number().int().positive("Valid address ID is required"),
    couponCode: z
      .string()
      .trim()
      .min(1, "Coupon code cannot be empty")
      .max(100, "Coupon code is too long")
      .transform((code) => code.toUpperCase())
      .nullable()
      .optional(),
    clientRequestId: z.uuid("A valid client request ID is required"),
  })
  .strict();

export const verifyRazorpayPaymentSchema = z
  .object({
    localOrderId: z.number().int().positive("Valid local order ID is required"),
    razorpay_order_id: z
      .string()
      .max(100)
      .regex(/^order_[A-Za-z0-9]+$/, "Invalid Razorpay order ID"),
    razorpay_payment_id: z
      .string()
      .max(100)
      .regex(/^pay_[A-Za-z0-9]+$/, "Invalid Razorpay payment ID"),
    razorpay_signature: z
      .string()
      .regex(/^[A-Fa-f0-9]{64}$/, "Invalid Razorpay signature"),
  })
  .strict();

export const reconcileRazorpayPaymentsSchema = z
  .object({
    olderThanMinutes: z.number().int().min(1).max(1440).default(15),
    limit: z.number().int().min(1).max(50).default(25),
  })
  .strict();

export const runPaymentSimulatorSchema = z
  .object({
    scenario: z
      .enum(["successful", "failed", "delayed", "duplicate", "out_of_order"])
      .optional(),
  })
  .strict();

export const validateCouponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1, "Coupon code is required")
      .max(100, "Coupon code is too long")
      .transform((code) => code.toUpperCase()),
  })
  .strict();

export const checkoutQuoteItemSchema = z
  .object({
    productId: z.number().int().positive("Product ID must be a positive integer"),
    quantity: z.number().int().positive("Quantity must be a positive integer"),
    customizationOptionIds: z
      .array(z.number().int().positive("Customization option ID must be positive"))
      .optional()
      .default([]),
  })
  .strict();

export const checkoutQuoteSchema = z
  .object({
    storeId: z.number().int().positive("Store ID must be a positive integer"),
    couponCode: z
      .string()
      .trim()
      .min(1, "Coupon code cannot be empty")
      .max(100, "Coupon code is too long")
      .transform((code) => code.toUpperCase())
      .nullable()
      .optional(),
    destinationState: z.string().trim().min(1).max(100).nullable().optional(),
    addressId: z.number().int().positive("Address ID must be a positive integer").nullable().optional(),
    items: z.array(checkoutQuoteItemSchema).optional(),
  })
  .strict();

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

export const managerUpdateStoreSchema = z
  .object({
    name: z.string().min(1, "Store name is required").optional(),
    address: z.string().min(1, "Address is required").optional(),
    city: z.string().min(1, "City is required").optional(),
    state: z.string().min(1, "State is required").optional(),
    pincode: z.string().min(1, "Pincode is required").optional(),
    phone: z.string().min(1, "Phone number is required").optional(),
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
      .regex(timeRegex, "Opening time must be in HH:MM format (24h)")
      .optional(),
    closesAt: z
      .string()
      .regex(timeRegex, "Closing time must be in HH:MM format (24h)")
      .optional(),
  })
  .strict();

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
