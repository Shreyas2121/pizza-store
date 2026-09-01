import { Router, static as static_ } from "express";
import { userRoutes } from "./features/users/user.routes";
import { categoryRoutes } from "./features/category/category.routes";
import { productRoutes } from "./features/products/product.routes";

import path from "path";
import { customizationRoutes } from "./features/customization/customize.routes";
import { menuRoutes } from "./features/menu/menu.routes";
import { cartRoutes } from "./features/cart/cart.routes";
import { authenticateUser } from "./middleware/authenticateUser";
import { orderRoutes } from "./features/order/order.routes";
import { paymentRoutes } from "./features/payments/payment.routes";
import { couponRoutes } from "./features/coupon/coupon.routes";
import { dashRoutes } from "./features/dashboard/dashboard.routes";
import { chatRoutes } from "./features/chat/chat.routes";
import { storeRoutes } from "./features/stores/stores.routes";
import { inventoryRoutes } from "./features/inventory/inventory.routes";
import { systemMaintenanceRoutes } from "./features/system-maintenance/system-maintenance.routes";
import { accessRoutes } from "./features/access/access.routes";
import { staffInvitationRoutes, staffRoutes } from "./features/staff/staff.routes";
import { globalAuditRoutes, storeAuditRoutes } from "./features/audit/audit.routes";
import { checkoutRoutes } from "./features/checkout/checkout.routes";

export const mainRoutes = Router();

mainRoutes.use("/user", userRoutes);
mainRoutes.use("/access", accessRoutes);
mainRoutes.use("/category", categoryRoutes);
mainRoutes.use("/product", productRoutes);
mainRoutes.use("/customize", customizationRoutes);
mainRoutes.use("/menu", menuRoutes);
mainRoutes.use("/cart", authenticateUser, cartRoutes);
mainRoutes.use("/checkout", checkoutRoutes);
mainRoutes.use("/order", orderRoutes);
mainRoutes.use("/payments", paymentRoutes);
mainRoutes.use("/coupon", couponRoutes);
mainRoutes.use("/dashboard", dashRoutes);
mainRoutes.use("/chat", chatRoutes);
mainRoutes.use("/stores", staffRoutes);
mainRoutes.use("/stores", storeAuditRoutes);
mainRoutes.use("/stores", storeRoutes);
mainRoutes.use("/store", storeRoutes);
mainRoutes.use("/inventory", inventoryRoutes);
mainRoutes.use("/admin/system", systemMaintenanceRoutes);
mainRoutes.use("/audit", globalAuditRoutes);
mainRoutes.use("/staff-invitations", staffInvitationRoutes);

mainRoutes.use("/uploads", static_(path.resolve(__dirname, "../uploads")));
