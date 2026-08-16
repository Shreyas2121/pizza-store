import { lazy } from "react";

// Non-lazy pages
export { default as Home } from "./home";
export { default as Profile } from "./profile/profile";
export { default as Address } from "./profile/address";
export { default as Orders } from "./profile/orders";
export { default as OrderDetails } from "./profile/order-details";
export { default as NotFound } from "./not-found";
export { CartPage as Cart } from "@/features/cart";

// Lazy-loaded pages
export const Checkout = lazy(() => import("./checkout"));
