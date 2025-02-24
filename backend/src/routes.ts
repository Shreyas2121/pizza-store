import { Router, static as static_ } from "express";
import { userRoutes } from "./features/users/user.routes";
import { categoryRoutes } from "./features/category/category.routes";
import { productRoutes } from "./features/products/product.routes";

import path from "path";
import { customizationRoutes } from "./features/customization/customize.routes";
import { menuRoutes } from "./features/menu/menu.routes";
import { cartRoutes } from "./features/cart/cart.routes";
import { authenticateUser } from "./middleware/authenticeUser";
import { orderRoutes } from "./features/order/order.routes";
import { paymentRoutes } from "./features/payments/payment.routes";
import { couponRoutes } from "./features/coupon/coupon.routes";

export const mainRouts = Router();

mainRouts.use("/user", userRoutes);
mainRouts.use("/category", categoryRoutes);
mainRouts.use("/product", productRoutes);
mainRouts.use("/customize", customizationRoutes);
mainRouts.use("/menu", menuRoutes);
mainRouts.use("/cart", authenticateUser, cartRoutes);
mainRouts.use("/order", orderRoutes);
mainRouts.use("/payments", paymentRoutes);
mainRouts.use("/coupon", couponRoutes);

mainRouts.use("/uploads", static_(path.resolve(__dirname, "../uploads")));
