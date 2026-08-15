import { Router } from "express";
import { authenticateAdmin } from "../../middleware/authenticeUser";
import { upload } from "../../utils/multer";
import { AppError, asyncHandler } from "../../utils/error";
import { filterImage, generateSlug } from "../../utils";
import menuService from "./menu.service";

export const menuRoutes = Router();

menuRoutes.post(
  "/",
  //   authenticateAdmin,
  upload.single("image"),
  asyncHandler(async (req, res) => {
    const data = req.body;
    const image = req.file as Express.Multer.File;

    if (!image) {
      throw new AppError("Image is required", 400);
    }

    const filteredImage = filterImage(image);
    const [menu] = await menuService.createenuItem({
      ...data,
      image: filteredImage,
      slug: generateSlug(data.name),
    });

    res.status(201).json({
      data: menu,
    });
  })
);

menuRoutes.get(
  "/",
  asyncHandler(async (req, res) => {
    const menuItems = await menuService.getAllMenuItems();
    res.json({
      data: menuItems,
    });
  })
);

menuRoutes.post(
  "/mapping",
  asyncHandler(async (req, res) => {
    const { menuItemId, productIds } = req.body;
    await Promise.all(
      productIds.map(async (productId: number) => {
        await menuService.createMenuItemsMapping({
          menuItemId,
          productId,
        });
      })
    );
    res.status(200).json({ message: "Mapping successful" });
  })
);
