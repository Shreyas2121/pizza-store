import { lazy } from "react";

// Non-lazy page re-exports from features
export { AdminOrdersPage as AdminOrders, AdminOrderDetailsPage as AdminOrderDetails } from "@/features/orders";
export { AdminSupportPage as AdminSupport, AdminChatPage as AdminChat } from "@/features/support";
export { AdminDashboardPage as AdminHome } from "@/features/admin-dashboard";

// Lazy-loaded pages
export const AdminProducts = lazy(() => import("./products"));
export const AdminNewProduct = lazy(() => import("./products/new-product"));
export const AdminMenu = lazy(() => import("./menu"));
export const AdminCustomization = lazy(() => import("./customization"));
