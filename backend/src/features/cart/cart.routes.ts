import { Router } from "express";
import { AppError, asyncHandler } from "../../utils/error";
import cartService from "./cart.service";
import { Auth } from "../../utils/types";
import { authenticateUser } from "../../middleware/authenticateUser";
import { validateBody } from "../../middleware/validateBody";
import { addToCartSchema, updateCartCustomizationSchema, updateCartItemSchema } from "../../utils/zodSchema";
import { parseIntegerParam } from "../../utils/request";

export const cartRoutes = Router();

cartRoutes.post(
  "/add",
  validateBody(addToCartSchema),
  asyncHandler(async (req: Auth, res) => {
    const { productId, storeId, cIds } = req.body;

    const userId = req.user!.id;
    const newCids = cIds ? cIds : [];

    const result = await cartService.addToCart({
      userId,
      productId,
      storeId,
      cIds: newCids,
    });

    res.status(200).json({
      data: result,
      message: result.cartCleared
        ? "Your cart has been cleared because you changed your delivery area"
        : "Product added to cart",
    });
  }),
);

cartRoutes.get(
  "/count",
  asyncHandler(async (req: Auth, res) => {
    const userId = req.user!.id;
    const count = await cartService.getCartCount(userId);
    res.status(200).json({ data: count });
  }),
);

cartRoutes.get(
  "/",
  asyncHandler(async (req: Auth, res) => {
    const userId = req.user!.id;

    const cart = await cartService.getCart(userId);

    if (cart) {
      const newI = cart.items.map((item) => {
        if (item.product.hasCustomization) {
          const c = item.customizations.map((c) => ({
            optionId: c.customizationOptionId,
            price: c.price,
            name: c.customizationOption.name,
          }));
          return {
            ...item,
            customizations: c,
          };
        } else {
          return item;
        }
      });

      res.json({
        data: {
          ...cart,
          items: newI,
        },
      });
    } else {
      res.json({
        data: cart,
      });
    }
  }),
);

cartRoutes.get(
  "/checkout",
  authenticateUser,
  asyncHandler(async (req: Auth, res) => {
    const userId = req.user!.id;

    const cart = await cartService.getCart(userId);

    if (!cart) {
      throw new AppError("No Cart Found.");
    }

    const data = cart ? {
      ...cart,
      items: cart.items.map((item) => ({
        ...item,
        customizations: item.customizations.map((customization) => ({
          optionId: customization.customizationOptionId,
          price: customization.price,
          name: customization.customizationOption.name,
        })),
      })),
    } : null;
    res.json({ data });
  }),
);

cartRoutes.patch(
  "/update",
  authenticateUser,
  validateBody(updateCartItemSchema),
  asyncHandler(async (req: Auth, res) => {
    const userId = req.user!.id;
    const { cartItemId, productId, type } = req.body;

    await cartService.updateCartItemByType({
      cartItemId,
      productId,
      type,
      userId,
    });

    res.json({
      message: "Updated",
    });
  }),
);

cartRoutes.patch(
  "/customize",
  authenticateUser,
  validateBody(updateCartCustomizationSchema),
  asyncHandler(async (req: Auth, res) => {
    await cartService.updateCartItemCustomizations(req.body.cartItemId, req.user!.id, req.body.cIds);
    res.json({ message: "Customizations updated" });
  })
);

cartRoutes.delete(
  "/:id",
  authenticateUser,
  asyncHandler(async (req: Auth, res) => {
    const id = parseIntegerParam(req.params.id, "Cart item ID");
    const userId = req.user!.id;

    await cartService.assertCartItemOwner(id, userId);

    const count = await cartService.getCartCount(userId);

    if (count === 1) {
      await cartService.clearCart(userId);
    } else {
      await cartService.deleteCartItem(id);
    }

    res.json({
      message: "Deleted",
    });
  }),
);
