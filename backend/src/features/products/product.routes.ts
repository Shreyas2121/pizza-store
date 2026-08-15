import { Router } from "express";
import {
  authenticateAdmin,
  authenticateUser,
} from "../../middleware/authenticeUser";
import { upload } from "../../utils/multer";
import { AppError, asyncHandler } from "../../utils/error";
import { filterImage, generateSlug } from "../../utils";
import productService from "./product.service";
import { Auth, Product } from "../../utils/types";
import orderService from "../order/order.service";

export const productRoutes = Router();

productRoutes.post(
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

    const [product] = await productService.createProduct({
      ...data,
      image: filteredImage,
      slug: generateSlug(data.name),
    });

    res.status(201).json({ data: product });
  })
);

// By Menu Id

productRoutes.get(
  "/menu",
  asyncHandler(async (req, res) => {
    const query = req.query;
    const menuSlug = (query?.menuSlug ?? null) as string | null;
    const page = query.page ? parseInt(query.page as any) : 1;
    const limit = 10;
    const offset = (page - 1) * limit;

    const sortBy = query.sortBy ? (query.sortBy as string) : "default";

    let products: Product[] = [];

    if (menuSlug) {
      products = await productService.getProductsByMenuSlug({
        menuSlug,
        limit,
        offset,
        sortBy,
      });
    } else {
      products = await productService.getProducts({
        limit,
        offset,
        sortBy,
      });
    }

    res.json({
      data: products,
      meta: {
        hasNextPage: products.length === limit,
        page,
        limit,
      },
    });
  })
);

// admin
productRoutes.get(
  "/admin",
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const products = await productService.getProductsA();
    res.json({ data: products });
  })
);

// products by cat

productRoutes.get(
  "/category/:id",
  asyncHandler(async (req, res) => {
    const categoryId = parseInt(req.params.id);

    if (!Number.isInteger(categoryId)) {
      throw new AppError("ID must be a number", 400);
    }

    const data = await productService.getProductsByCategory(categoryId);

    res.json({ data });
  })
);

// products by group id

productRoutes.get(
  "/group/:id",
  asyncHandler(async (req, res) => {
    const groupId = parseInt(req.params.id);

    if (!Number.isInteger(groupId)) {
      throw new AppError("ID must be a number", 400);
    }

    const data = await productService.getProductsByGroupId(groupId);
    res.json({ data: data.map((d) => d.product) });
  })
);
