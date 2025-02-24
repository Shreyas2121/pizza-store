import { Router } from "express";
import { authenticateAdmin } from "../../middleware/authenticeUser";
import { upload } from "../../utils/multer";
import { AppError, asyncHandler } from "../../utils/error";
import { filterImage, generateSlug } from "../../utils";
import productService from "./product.service";
import { Product } from "../../utils/types";

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
