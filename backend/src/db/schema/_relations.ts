import { relations } from "drizzle-orm";

// Tables — import from each domain module
import { usersTable, addressTable } from "./user.schema";
import { categoriesTable, productsTable } from "./catalog.schema";
import {
  storesTable,
  storeProductsTable,
  deliveryZonesTable,
  deliveryPricingRulesTable,
} from "./store.schema";
import {
  customizationGroupsTable,
  customizationOptionsTable,
  productCustomizationGroupMappingTable,
} from "./customization.schema";
import { menuItemsTable, menuItemsMappingTable } from "./menu.schema";
import {
  cartTable,
  cartItemsTable,
  cartItemCustomizationsTable,
} from "./cart.schema";
import { couponsTable } from "./coupon.schema";
import { couponRedemptionsTable } from "./coupon-redemption.schema";
import { paymentsTable } from "./payment.schema";
import {
  ordersTable,
  orderItemsTable,
  orderItemCustomizationsTable,
} from "./order.schema";
import {
  inventoryMovementsTable,
  inventoryReservationsTable,
} from "./inventory.schema";
import { chatSessionsTable, chatMessagesTable } from "./chat.schema";
import {
  storeMembershipsTable,
  storeStaffInvitationsTable,
} from "./access.schema";
import { auditLogsTable } from "./audit.schema";
import { taxRulesTable } from "./tax.schema";

/**
 * All Drizzle relations live here to avoid circular imports between
 * domain schema files. Relations inherently cross domain boundaries,
 * so keeping them in one place is the cleanest pattern.
 */

// ──────────────────────────────────────────────
// User relations
// ──────────────────────────────────────────────

export const usersRelations = relations(usersTable, ({ many, one }) => ({
  addresses: many(addressTable),
  cart: one(cartTable, {
    fields: [usersTable.id],
    references: [cartTable.userId],
  }),
  items: many(cartItemsTable),
  orders: many(ordersTable),
  couponRedemptions: many(couponRedemptionsTable),
  inventoryMovements: many(inventoryMovementsTable),
  storeMemberships: many(storeMembershipsTable, {
    relationName: "storeMembershipUser",
  }),
  createdStoreMemberships: many(storeMembershipsTable, {
    relationName: "storeMembershipCreatedBy",
  }),
  updatedStoreMemberships: many(storeMembershipsTable, {
    relationName: "storeMembershipUpdatedBy",
  }),
  invitedStaffInvitations: many(storeStaffInvitationsTable),
  auditLogs: many(auditLogsTable),
}));

export const addressesRelations = relations(addressTable, ({ many, one }) => ({
  user: one(usersTable, {
    fields: [addressTable.userId],
    references: [usersTable.id],
  }),
  orders: many(ordersTable),
}));

// ──────────────────────────────────────────────
// Catalog relations
// ──────────────────────────────────────────────

export const categoriesRelations = relations(
  categoriesTable,
  ({ many }) => ({
    products: many(productsTable),
  })
);

export const productsRelations = relations(productsTable, ({ many, one }) => ({
  category: one(categoriesTable, {
    fields: [productsTable.categoryId],
    references: [categoriesTable.id],
  }),
  customizationGroups: many(customizationGroupsTable),
  menuItems: many(menuItemsTable),
  cartItems: many(cartItemsTable),
  orderItems: many(orderItemsTable),
  stores: many(storeProductsTable),
}));

// ──────────────────────────────────────────────
// Store relations
// ──────────────────────────────────────────────

export const storesRelations = relations(storesTable, ({ many }) => ({
  products: many(storeProductsTable),
  deliveryZones: many(deliveryZonesTable),
  deliveryPricingRules: many(deliveryPricingRulesTable),
  taxRules: many(taxRulesTable),
  orders: many(ordersTable),
  carts: many(cartTable),
  memberships: many(storeMembershipsTable),
  staffInvitations: many(storeStaffInvitationsTable),
  auditLogs: many(auditLogsTable),
}));

export const storeProductsRelations = relations(
  storeProductsTable,
  ({ many, one }) => ({
    store: one(storesTable, {
      fields: [storeProductsTable.storeId],
      references: [storesTable.id],
    }),
    product: one(productsTable, {
      fields: [storeProductsTable.productId],
      references: [productsTable.id],
    }),
    inventoryMovements: many(inventoryMovementsTable),
    inventoryReservations: many(inventoryReservationsTable),
  })
);

export const deliveryZonesRelations = relations(
  deliveryZonesTable,
  ({ one }) => ({
    store: one(storesTable, {
      fields: [deliveryZonesTable.storeId],
      references: [storesTable.id],
    }),
  })
);

export const deliveryPricingRulesRelations = relations(
  deliveryPricingRulesTable,
  ({ one }) => ({
    store: one(storesTable, {
      fields: [deliveryPricingRulesTable.storeId],
      references: [storesTable.id],
    }),
  })
);

export const taxRulesRelations = relations(taxRulesTable, ({ one, many }) => ({
  store: one(storesTable, {
    fields: [taxRulesTable.storeId],
    references: [storesTable.id],
  }),
  deliveryOrders: many(ordersTable),
  orderItems: many(orderItemsTable),
}));

// ──────────────────────────────────────────────
// Customization relations
// ──────────────────────────────────────────────

export const customizationGroupsRelations = relations(
  customizationGroupsTable,
  ({ many }) => ({
    options: many(customizationOptionsTable),
    mapping: many(productCustomizationGroupMappingTable),
  })
);

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

export const productCustomizationGroupMappingRelations = relations(
  productCustomizationGroupMappingTable,
  ({ one }) => ({
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

// ──────────────────────────────────────────────
// Menu relations
// ──────────────────────────────────────────────

export const menuItemsTableRelations = relations(
  menuItemsTable,
  ({ many }) => ({
    products: many(productsTable),
  })
);

export const menuItemsMappingRelations = relations(
  menuItemsMappingTable,
  ({ one }) => ({
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

// ──────────────────────────────────────────────
// Cart relations
// ──────────────────────────────────────────────

export const cartTableRelations = relations(cartTable, ({ many, one }) => ({
  user: one(usersTable, {
    fields: [cartTable.userId],
    references: [usersTable.id],
  }),
  items: many(cartItemsTable),
  store: one(storesTable, {
    fields: [cartTable.storeId],
    references: [storesTable.id],
  }),
}));

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

// ──────────────────────────────────────────────
// Coupon relations
// ──────────────────────────────────────────────

export const couponRelations = relations(couponsTable, ({ many }) => ({
  users: many(usersTable),
  orders: many(ordersTable),
  redemptions: many(couponRedemptionsTable),
}));

export const couponRedemptionsRelations = relations(
  couponRedemptionsTable,
  ({ one }) => ({
    coupon: one(couponsTable, {
      fields: [couponRedemptionsTable.couponId],
      references: [couponsTable.id],
    }),
    order: one(ordersTable, {
      fields: [couponRedemptionsTable.orderId],
      references: [ordersTable.id],
    }),
    user: one(usersTable, {
      fields: [couponRedemptionsTable.userId],
      references: [usersTable.id],
    }),
  })
);

// ──────────────────────────────────────────────
// Payment relations
// ──────────────────────────────────────────────

export const paymentRelations = relations(paymentsTable, ({ one }) => ({
  order: one(ordersTable, {
    fields: [paymentsTable.id],
    references: [ordersTable.paymentId],
  }),
}));

// ──────────────────────────────────────────────
// Order relations
// ──────────────────────────────────────────────

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
  store: one(storesTable, {
    fields: [ordersTable.storeId],
    references: [storesTable.id],
  }),
  couponRedemption: one(couponRedemptionsTable, {
    fields: [ordersTable.id],
    references: [couponRedemptionsTable.orderId],
  }),
  deliveryPricingRule: one(deliveryPricingRulesTable, {
    fields: [ordersTable.deliveryPricingRuleId],
    references: [deliveryPricingRulesTable.id],
  }),
  deliveryTaxRule: one(taxRulesTable, {
    fields: [ordersTable.deliveryTaxRuleId],
    references: [taxRulesTable.id],
  }),
  inventoryMovements: many(inventoryMovementsTable),
  inventoryReservations: many(inventoryReservationsTable),
}));

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
    taxRule: one(taxRulesTable, {
      fields: [orderItemsTable.taxRuleId],
      references: [taxRulesTable.id],
    }),
    orderItemCustomizations: many(orderItemCustomizationsTable),
  })
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

// ──────────────────────────────────────────────
// Inventory relations
// ──────────────────────────────────────────────

export const inventoryMovementsRelations = relations(
  inventoryMovementsTable,
  ({ one }) => ({
    storeProduct: one(storeProductsTable, {
      fields: [inventoryMovementsTable.storeProductId],
      references: [storeProductsTable.id],
    }),
    order: one(ordersTable, {
      fields: [inventoryMovementsTable.orderId],
      references: [ordersTable.id],
    }),
    createdByUser: one(usersTable, {
      fields: [inventoryMovementsTable.createdBy],
      references: [usersTable.id],
    }),
  })
);

export const inventoryReservationsRelations = relations(
  inventoryReservationsTable,
  ({ one }) => ({
    order: one(ordersTable, {
      fields: [inventoryReservationsTable.orderId],
      references: [ordersTable.id],
    }),
    storeProduct: one(storeProductsTable, {
      fields: [inventoryReservationsTable.storeProductId],
      references: [storeProductsTable.id],
    }),
  })
);

// ──────────────────────────────────────────────
// Chat relations
// ──────────────────────────────────────────────

export const chatSessionsRelations = relations(
  chatSessionsTable,
  ({ one, many }) => ({
    user: one(usersTable, {
      fields: [chatSessionsTable.userId],
      references: [usersTable.id],
    }),
    messages: many(chatMessagesTable),
  })
);

export const chatMessagesRelations = relations(
  chatMessagesTable,
  ({ one }) => ({
    session: one(chatSessionsTable, {
      fields: [chatMessagesTable.sessionId],
      references: [chatSessionsTable.id],
    }),
    sender: one(usersTable, {
      fields: [chatMessagesTable.senderId],
      references: [usersTable.id],
    }),
  })
);

// ──────────────────────────────────────────────
// Access & Staff relations
// ──────────────────────────────────────────────

export const storeMembershipsRelations = relations(
  storeMembershipsTable,
  ({ one }) => ({
    user: one(usersTable, {
      fields: [storeMembershipsTable.userId],
      references: [usersTable.id],
      relationName: "storeMembershipUser",
    }),
    store: one(storesTable, {
      fields: [storeMembershipsTable.storeId],
      references: [storesTable.id],
    }),
    createdByUser: one(usersTable, {
      fields: [storeMembershipsTable.createdBy],
      references: [usersTable.id],
      relationName: "storeMembershipCreatedBy",
    }),
    updatedByUser: one(usersTable, {
      fields: [storeMembershipsTable.updatedBy],
      references: [usersTable.id],
      relationName: "storeMembershipUpdatedBy",
    }),
  })
);

export const storeStaffInvitationsRelations = relations(
  storeStaffInvitationsTable,
  ({ one }) => ({
    store: one(storesTable, {
      fields: [storeStaffInvitationsTable.storeId],
      references: [storesTable.id],
    }),
    invitedByUser: one(usersTable, {
      fields: [storeStaffInvitationsTable.invitedBy],
      references: [usersTable.id],
    }),
  })
);

// ──────────────────────────────────────────────
// Audit relations
// ──────────────────────────────────────────────

export const auditLogsRelations = relations(auditLogsTable, ({ one }) => ({
  actorUser: one(usersTable, {
    fields: [auditLogsTable.actorUserId],
    references: [usersTable.id],
  }),
  store: one(storesTable, {
    fields: [auditLogsTable.storeId],
    references: [storesTable.id],
  }),
}));
