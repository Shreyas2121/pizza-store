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
export * from "./payment.schema";
export * from "./order.schema";
export * from "./chat.schema";
export * from "./_relations";
