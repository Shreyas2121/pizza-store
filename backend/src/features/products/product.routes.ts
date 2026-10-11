import { Router } from "express";
import {
  authenticateAdmin,
  authenticateUser,
} from "../../middleware/authenticateUser";
import { upload } from "../../utils/multer";
import { AppError, asyncHandler } from "../../utils/error";
import { filterImage, generateSlug } from "../../utils";
import productService from "./product.service";
import { Product } from "../../utils/types";
import { parseIntegerParam } from "../../utils/request";
import { MONEY_CAPS, parsePaise } from "../../utils/money";

export const productRoutes = Router();

productRoutes.post(
  "/",
  authenticateAdmin,
  upload.single("image"),
  asyncHandler(async (req, res) => {
    const data = req.body;
    const image = req.file as Express.Multer.File;
    const productType = data.productType ?? "single";
    if (productType !== "single" && productType !== "bundle") {
      throw new AppError("Product type must be single or bundle", 400);
    }

    if (!image) {
      throw new AppError("Image is required", 400);
    }

    const filteredImage = await filterImage(image);

    const [product] = await productService.createProduct({
      ...data,
      productType,
      pricePaise: parsePaise(data.pricePaise, MONEY_CAPS.ITEM_PRICE, "Product price"),
      categoryId: Number(data.categoryId),
      veg: data.veg === "true" || data.veg === true,
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
    let storeId: number | undefined;
    if (query.storeId !== undefined) {
      if (typeof query.storeId !== "string") {
        throw new AppError("Store ID must be a positive integer", 400);
      }
      storeId = parseIntegerParam(query.storeId, "Store ID");
    }

    const sortBy = query.sortBy ? (query.sortBy as string) : "default";

    let products: Product[] = [];

    if (menuSlug) {
      products = await productService.getProductsByMenuSlug({
        menuSlug,
        limit,
        offset,
        sortBy,
        storeId,
      });
    } else {
      products = await productService.getProducts({
        limit,
        offset,
        sortBy,
        storeId,
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
    const categoryId = parseIntegerParam(req.params.id, "Category ID");

    const data = await productService.getProductsByCategory(categoryId);

    res.json({ data });
  })
);

// products by group id

productRoutes.get(
  "/group/:id",
  asyncHandler(async (req, res) => {
    const groupId = parseIntegerParam(req.params.id, "Group ID");

    const data = await productService.getProductsByGroupId(groupId);
    res.json({ data: data.map((d) => d.product) });
  })
);
