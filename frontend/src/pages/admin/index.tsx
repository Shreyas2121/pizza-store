import { lazy } from "react";

// Non-lazy page re-exports from features
export { AdminOrdersPage as AdminOrders, AdminOrderDetailsPage as AdminOrderDetails } from "@/features/orders";

// Lazy-loaded pages
export const AdminProducts = lazy(() => import("./products"));
export const AdminNewProduct = lazy(() => import("./products/new-product"));
export const AdminMenu = lazy(() => import("./menu"));
export const AdminCustomization = lazy(() => import("./customization"));
export const AdminHome = lazy(() => import("./home"));
export const AdminSupport = lazy(() => import("./support"));
export const AdminChat = lazy(() => import("./admin-chat"));
