import { Router } from "express";
import { authenticateAdmin } from "../../middleware/authenticateUser";
import { asyncHandler } from "../../utils/error";
import categoryService from "./category.service";
import { cap } from "../../utils";
import { validateBody } from "../../middleware/validateBody";
import { categoryCreateSchema } from "./category.schemas";

export const categoryRoutes = Router();

categoryRoutes.post(
  "/",
  authenticateAdmin,
  validateBody(categoryCreateSchema),
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

categoryRoutes.get(
  "/select",
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const categories = await categoryService.getAllCategories();
    res.json({
      data: categories.map((c) => ({
        value: c.id.toString(),
        label: cap(c.name),
      })),
    });
  })
);
