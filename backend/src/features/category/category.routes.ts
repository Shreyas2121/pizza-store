import { Router } from "express";
import { authenticateAdmin } from "../../middleware/authenticeUser";
import { asyncHandler } from "../../utils/error";
import categoryService from "./category.service";

export const categoryRoutes = Router();

categoryRoutes.post(
  "/",
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const { name } = req.body;
    const category = await categoryService.createCategory(name);
    res.status(201).json({
      data: category[0],
    });
  })
);

categoryRoutes.get(
  "/",
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const categories = await categoryService.getAllCategories();
    res.json({
      data: categories,
    });
  })
);
