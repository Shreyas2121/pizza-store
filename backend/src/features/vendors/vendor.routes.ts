import { Router } from "express";
import { authenticateUser } from "../../middleware/authenticateUser";
import { validateBody } from "../../middleware/validateBody";
import { asyncHandler } from "../../utils/error";
import { parseIntegerParam } from "../../utils/request";
import type { Auth } from "../../utils/types";
import { createExpenseCategorySchema, createVendorSchema, masterListQuerySchema, updateExpenseCategorySchema, updateVendorSchema } from "./vendor.schemas";
import vendorService from "./vendor.service";

export const vendorRoutes = Router();
vendorRoutes.use(authenticateUser);

vendorRoutes.get("/vendors", asyncHandler(async (req: Auth, res) => {
  const result = await vendorService.listVendors(req.principal!, masterListQuerySchema.parse(req.query));
  res.json({ data: result.items, meta: result.meta });
}));

vendorRoutes.post("/vendors", validateBody(createVendorSchema), asyncHandler(async (req: Auth, res) => {
  res.status(201).json({ data: await vendorService.createVendor(req.principal!, req.body) });
}));

vendorRoutes.put("/vendors/:vendorId", validateBody(updateVendorSchema), asyncHandler(async (req: Auth, res) => {
  res.json({ data: await vendorService.updateVendor(req.principal!, parseIntegerParam(req.params.vendorId, "Vendor ID"), req.body) });
}));

vendorRoutes.get("/expenses/categories", asyncHandler(async (req: Auth, res) => {
  const result = await vendorService.listCategories(req.principal!, masterListQuerySchema.parse(req.query));
  res.json({ data: result.items, meta: result.meta });
}));

vendorRoutes.post("/expenses/categories", validateBody(createExpenseCategorySchema), asyncHandler(async (req: Auth, res) => {
  res.status(201).json({ data: await vendorService.createCategory(req.principal!, req.body) });
}));

vendorRoutes.put("/expenses/categories/:categoryId", validateBody(updateExpenseCategorySchema), asyncHandler(async (req: Auth, res) => {
  res.json({ data: await vendorService.updateCategory(req.principal!, parseIntegerParam(req.params.categoryId, "Expense category ID"), req.body) });
}));
