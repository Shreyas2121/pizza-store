import { relations } from "drizzle-orm";
import {
  AnyPgColumn,
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import {
  AddressType,
  CouponType,
  CustomizationType,
  OrderStatus,
  PaymentStatus,
  PaymentType,
  Role,
} from "../utils/types";

const id = integer().primaryKey().generatedAlwaysAsIdentity();
const createdAt = timestamp("created_at", { withTimezone: true })
  .defaultNow()
  .notNull();
const updatedAt = timestamp("updated_at", { withTimezone: true })
  .defaultNow()
  .notNull()
  .$onUpdateFn(() => new Date());
const isActive = boolean("is_active").notNull().default(true);

export const usersTable = pgTable("users", {
  id,
  fname: text().notNull(),
  lname: text().notNull(),
  password: text().notNull(),
  email: text().unique().notNull(),
  role: text().$type<Role>().default("user").notNull(),
  isActive,
  createdAt,
  updatedAt,
});

export const usersRelations = relations(usersTable, ({ many, one }) => ({
  addresses: many(addressTable),
  cart: one(cartTable, {
    fields: [usersTable.id],
    references: [cartTable.userId],
  }),
  items: many(cartItemsTable),
  orders: many(ordersTable),
}));

export const addressTable = pgTable("addresses", {
  id,
  userId: integer("user_id")
    .references(() => usersTable.id)
    .notNull(),
  type: text("type").$type<AddressType>().notNull(),
  street: text("street").notNull(),
  city: text().notNull(),
  state: text().notNull(),
  pincode: text().notNull(),
  phone: text().notNull(),
  createdAt,
  updatedAt,
});

export const addressesRelations = relations(addressTable, ({ many, one }) => ({
  user: one(usersTable, {
    fields: [addressTable.userId],
    references: [usersTable.id],
  }),
  orders: many(ordersTable),
}));

export const categoriesTable = pgTable("categories", {
  id,
  name: text().unique().notNull(),
  featured: boolean("featured").default(false),
  isActive,
  createdAt,
  updatedAt,
});

export const categoriesRelations = relations(
  categoriesTable,
  ({ many, one }) => ({
    products: many(productsTable),
  })
);

export const productsTable = pgTable("products", {
  id,
  name: text().notNull(),
  description: text(),
  slug: text().unique().notNull(),
  veg: boolean("veg").default(false),
  hasCustomization: boolean("has_customization").default(false).notNull(),
  price: real().notNull(),
  image: text().notNull(),
  categoryId: integer("category_id")
    .references(() => categoriesTable.id)
    .notNull(),
  createdAt,
  updatedAt,
});

export const productsRelations = relations(productsTable, ({ many, one }) => ({
  category: one(categoriesTable, {
    fields: [productsTable.categoryId],
    references: [categoriesTable.id],
  }),
  customizationGroups: many(customizationGroupsTable),
  menuItems: many(menuItemsTable),
  cartItems: many(cartItemsTable),
  orderItems: many(orderItemsTable),
}));

export const customizationGroupsTable = pgTable("customization_groups", {
  id,
  name: text().notNull(),
  type: text().$type<CustomizationType>().notNull(),
  required: boolean("required").default(false).notNull(),
  createdAt,
  updatedAt,
});

export const customizationGroupsRelations = relations(
  customizationGroupsTable,
  ({ many, one }) => ({
    options: many(customizationOptionsTable),
    mapping: many(productCustomizationGroupMappingTable),
  })
);

export const customizationOptionsTable = pgTable("customization_options", {
  id,
  groupId: integer("group_id")
    .references(() => customizationGroupsTable.id)
    .notNull(),
  name: text().notNull(),
  price: real().default(0),
  createdAt,
  updatedAt,
});

export const customizationOptionsRelations = relations(
  customizationOptionsTable,
  ({ many, one }) => ({
    group: one(customizationGroupsTable, {
      fields: [customizationOptionsTable.groupId],
      references: [customizationGroupsTable.id],
    }),
    orderItemCustomizations: many(orderItemCustomizationsTable),
    cartItemCustomizations: many(cartItemCustomizationsTable),
  })
);

export const productCustomizationGroupMappingTable = pgTable(
  "product_customization_group_mapping",
  {
    productId: integer("product_id")
      .references(() => productsTable.id)
      .notNull(),
    groupId: integer("group_id")
      .references(() => customizationGroupsTable.id)
      .notNull(),
  }
);

export const productCustomizationGroupMappingRelations = relations(
  productCustomizationGroupMappingTable,
  ({ many, one }) => ({
    product: one(productsTable, {
      fields: [productCustomizationGroupMappingTable.productId],
      references: [productsTable.id],
    }),
    group: one(customizationGroupsTable, {
      fields: [productCustomizationGroupMappingTable.groupId],
      references: [customizationGroupsTable.id],
    }),
  })
);

export const menuItemsTable = pgTable("menu_items", {
  id,
  name: text().notNull(),
  position: integer().unique().notNull(),
  image: text().notNull(),
  slug: text().unique().notNull(),
  isActive,
  createdAt,
  updatedAt,
});

export const menuItemsTableRelations = relations(
  menuItemsTable,
  ({ many, one }) => ({
    products: many(productsTable),
  })
);

export const menuItemsMappingTable = pgTable("menu_items_mapping", {
  menuItemId: integer("menu_item_id")
    .references(() => menuItemsTable.id)
    .notNull(),
  productId: integer("product_id")
    .references(() => productsTable.id)
    .notNull(),
});

export const menuItemsMappingRelations = relations(
  menuItemsMappingTable,
  ({ many, one }) => ({
    menuItem: one(menuItemsTable, {
      fields: [menuItemsMappingTable.menuItemId],
      references: [menuItemsTable.id],
    }),
    product: one(productsTable, {
      fields: [menuItemsMappingTable.productId],
      references: [productsTable.id],
    }),
  })
);

export const cartTable = pgTable("cart", {
  id,
  userId: integer("user_id")
    .references(() => usersTable.id)
    .notNull(),
  totalPrice: doublePrecision("total_price").default(0).notNull(),
  createdAt,
  updatedAt,
});

export const cartTableRelations = relations(cartTable, ({ many, one }) => ({
  user: one(usersTable, {
    fields: [cartTable.userId],
    references: [usersTable.id],
  }),
  items: many(cartItemsTable),
}));

export const cartItemsTable = pgTable("cart_items", {
  id,
  cartId: integer("cart_id")
    .references(() => cartTable.id, {
      onDelete: "cascade",
    })
    .notNull(),
  productId: integer("product_id")
    .references(() => productsTable.id)
    .notNull(),
  quantity: integer().default(1).notNull(),
  price: doublePrecision("price").default(0).notNull(),
  createdAt,
  updatedAt,
});

export const cartItemsTableRelations = relations(
  cartItemsTable,
  ({ many, one }) => ({
    cart: one(cartTable, {
      fields: [cartItemsTable.cartId],
      references: [cartTable.id],
    }),
    product: one(productsTable, {
      fields: [cartItemsTable.productId],
      references: [productsTable.id],
    }),
    customizations: many(cartItemCustomizationsTable),
  })
);

export const cartItemCustomizationsTable = pgTable("cart_item_customizations", {
  id,
  cartItemId: integer("cart_item_id")
    .references(() => cartItemsTable.id, {
      onDelete: "cascade",
    })
    .notNull(),
  customizationOptionId: integer("customization_option_id")
    .references(() => customizationOptionsTable.id)
    .notNull(),
  price: doublePrecision("price").notNull(),
  createdAt,
  updatedAt,
});

export const cartItemCustomizationsRelations = relations(
  cartItemCustomizationsTable,
  ({ one }) => ({
    cartItem: one(cartItemsTable, {
      fields: [cartItemCustomizationsTable.cartItemId],
      references: [cartItemsTable.id],
    }),
    customizationOption: one(customizationOptionsTable, {
      fields: [cartItemCustomizationsTable.customizationOptionId],
      references: [customizationOptionsTable.id],
    }),
  })
);

export const couponsTable = pgTable("coupons", {
  id,
  code: text().notNull().unique(),
  discountType: text("discount_type").$type<CouponType>().notNull(),
  discountValue: doublePrecision("discount_value").notNull(),
  minOrderValue: doublePrecision("min_order_value").notNull(),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }).notNull(),
  isActive,
  redemptionCount: integer("redemption_count").default(0).notNull(),
  maxRedemptions: integer("max_redemptions").default(-1).notNull(),
  createdAt,
  updatedAt,
});

export const couponRelations = relations(couponsTable, ({ many, one }) => ({
  users: many(usersTable),
  orders: many(ordersTable),
}));

export const paymentsTable = pgTable("payments", {
  id,
  status: text().$type<PaymentStatus>().default("pending").notNull(),
  paymentDate: timestamp("payment_date", { withTimezone: true })
    .defaultNow()
    .notNull(),
  razorpayOrderId: text("razorpay_order_id").unique(),
  razorpayPaymentId: text("razorpay_payment_id").unique(),
  razorpaySignature: text("razorpay_signature"),
  createdAt,
  updatedAt,
});

export const paymentRelations = relations(paymentsTable, ({ many, one }) => ({
  order: one(ordersTable, {
    fields: [paymentsTable.id],
    references: [ordersTable.paymentId],
  }),
}));

export const ordersTable = pgTable("orders", {
  id,
  userId: integer("user_id")
    .references(() => usersTable.id)
    .notNull(),
  orderDate: timestamp("order_date", { withTimezone: true }).defaultNow(),
  discountAmount: doublePrecision("discount_amount").notNull(),
  couponId: integer("coupon_id").references(() => couponsTable.id),
  totalPrice: doublePrecision("total_price").default(0).notNull(),
  status: text().$type<OrderStatus>().default("pending").notNull(),
  paymentType: text("payment_type")
    .$type<PaymentType>()
    .default("cash")
    .notNull(),
  paymentId: integer("payment_id").references(() => paymentsTable.id),
  addressId: integer("address_id").references(() => addressTable.id),
  createdAt,
  updatedAt,
});

export const orderRelations = relations(ordersTable, ({ many, one }) => ({
  user: one(usersTable, {
    fields: [ordersTable.userId],
    references: [usersTable.id],
  }),
  payment: one(paymentsTable, {
    fields: [ordersTable.paymentId],
    references: [paymentsTable.id],
  }),
  coupon: one(couponsTable, {
    fields: [ordersTable.couponId],
    references: [couponsTable.id],
  }),
  items: many(orderItemsTable),
  address: one(addressTable, {
    fields: [ordersTable.addressId],
    references: [addressTable.id],
  }),
}));

export const orderItemsTable = pgTable("order_items", {
  id,
  orderId: integer("order_id")
    .references(() => ordersTable.id)
    .notNull(),
  productId: integer("product_id")
    .references(() => productsTable.id)
    .notNull(),
  quantity: integer().default(1).notNull(),
  price: doublePrecision("price").default(0).notNull(),
  createdAt,
  updatedAt,
});

export const orderItemsTableRelations = relations(
  orderItemsTable,
  ({ one, many }) => ({
    order: one(ordersTable, {
      fields: [orderItemsTable.orderId],
      references: [ordersTable.id],
    }),
    product: one(productsTable, {
      fields: [orderItemsTable.productId],
      references: [productsTable.id],
    }),
    orderItemCustomizations: many(orderItemCustomizationsTable),
  })
);

export const orderItemCustomizationsTable = pgTable(
  "order_item_customizations",
  {
    id,
    orderItemId: integer("order_item_id")
      .references(() => orderItemsTable.id)
      .notNull(),
    customizationOptionId: integer("customization_option_id")
      .references(() => customizationOptionsTable.id)
      .notNull(),
    price: doublePrecision("price").notNull(),
    createdAt,
    updatedAt,
  }
);

export const orderItemCustomizationsRelations = relations(
  orderItemCustomizationsTable,
  ({ one }) => ({
    orderItem: one(orderItemsTable, {
      fields: [orderItemCustomizationsTable.orderItemId],
      references: [orderItemsTable.id],
    }),
    customizationOption: one(customizationOptionsTable, {
      fields: [orderItemCustomizationsTable.customizationOptionId],
      references: [customizationOptionsTable.id],
    }),
  })
);

export const deliveryZonesTable = pgTable("delivery_zones", {
  id,
  pincode: text().unique().notNull(),
  createdAt,
  updatedAt,
});

export const deliveryPrice = pgTable("delivery_price", {
  id,
  deliveryCharge: doublePrecision("delivery_charge").notNull(),
  minOrder: doublePrecision("min_order").default(0).notNull(),
  createdAt,
  updatedAt,
});
