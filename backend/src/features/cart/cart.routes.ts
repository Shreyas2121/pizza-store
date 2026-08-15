import { Router } from "express";
import { AppError, asyncHandler } from "../../utils/error";
import cartService from "./cart.service";
import { Auth } from "../../utils/types";
import { authenticateUser } from "../../middleware/authenticeUser";

export const cartRoutes = Router();

cartRoutes.post(
  "/add",
  asyncHandler(async (req: Auth, res) => {
    const { productId, cIds } = req.body;

    const userId = req.user!.id;
    const newCids = cIds ? cIds : [];

    await cartService.addToCart({
      userId,
      productId,
      cIds: newCids,
    });

    res.status(200).json({ message: "Product added to cart" });
  })
);

cartRoutes.get(
  "/count",
  asyncHandler(async (req: Auth, res) => {
    const userId = req.user!.id;
    const count = await cartService.getCartCount(userId);
    res.status(200).json({ data: count });
  })
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
  })
);

cartRoutes.get(
  "/checkout",
  authenticateUser,
  asyncHandler(async (req: Auth, res) => {
    const userId = req.user!.id;

    const cart = await cartService.getExistingCart(userId);

    if (!cart) {
      throw new AppError("No Cart Found.");
    }

    res.json({
      data: cart,
    });
  })
);

cartRoutes.patch(
  "/update",
  authenticateUser,
  asyncHandler(async (req: Auth, res) => {
    const userId = req.user!.id;
    const { cartItemId, productId, type } = req.body;

    await cartService.updateCartItemByType({
      cartItemId,
      productId,
      type,
    });

    res.json({
      message: "Updated",
    });
  })
);

cartRoutes.delete(
  "/:id",
  authenticateUser,
  asyncHandler(async (req: Auth, res) => {
    const id = req.params?.id;
    const userId = req.user!.id;

    if (!id) {
      throw new AppError("Error");
    }

    const count = await cartService.getCartCount(userId);

    if (count === 1) {
      await cartService.clearCart(userId);
    } else {
      await cartService.deleteCartItem(parseInt(id));
    }

    res.json({
      message: "Deleted",
    });
  })
);
