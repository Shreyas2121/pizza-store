/**
 * Barrel re-export — every domain schema module and the centralized
 * relations file are re-exported here so that existing imports
 * (`from "../db/schema"`) continue to work without any changes.
 */

export * from "./_helpers";
export * from "./user.schema";
export * from "./catalog.schema";
export * from "./store.schema";
export * from "./customization.schema";
export * from "./menu.schema";
export * from "./cart.schema";
export * from "./coupon.schema";
export * from "./coupon-redemption.schema";
export * from "./promotion.schema";
export * from "./promotion-rule.schema";
export * from "./store-promotion-setting.schema";
export * from "./promotion-application.schema";
export * from "./promotion-discount-allocation.schema";
export * from "./bundle-component.schema";
export * from "./payment.schema";
export * from "./payment-attempt.schema";
export * from "./payment-event.schema";
export * from "./refund.schema";
export * from "./settlement.schema";
export * from "./financial-outbox.schema";
export * from "./product-cost.schema";
export * from "./cash.schema";
export * from "./vendor.schema";
export * from "./expense.schema";
export * from "./ledger.schema";
export * from "./payroll.schema";
export * from "./order.schema";
export * from "./inventory.schema";
export * from "./chat.schema";
export * from "./access.schema";
export * from "./audit.schema";
export * from "./tax.schema";
export * from "./_relations";
