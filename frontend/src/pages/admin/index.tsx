import { lazy } from "react";

// Lazy-loaded pages
export const AdminProducts = lazy(() => import("./products"));
export const AdminNewProduct = lazy(() => import("./products/new-product"));
export const AdminOrders = lazy(() => import("./orders"));
export const AdminOrderDetails = lazy(() => import("./orders/order-details"));
export const AdminMenu = lazy(() => import("./menu"));
export const AdminCustomization = lazy(() => import("./customization"));
export const AdminHome = lazy(() => import("./home"));
export const AdminSupport = lazy(() => import("./support"));
export const AdminChat = lazy(() => import("./admin-chat"));
