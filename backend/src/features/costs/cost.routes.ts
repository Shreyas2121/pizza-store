import { Router } from "express";
import { authenticateUser } from "../../middleware/authenticateUser";
import { validateBody } from "../../middleware/validateBody";
import { asyncHandler } from "../../utils/error";
import type { Auth } from "../../utils/types";
import { costsQuerySchema, createCostVersionSchema } from "./cost.schemas";
import costService from "./cost.service";

export const costRoutes = Router();
costRoutes.use(authenticateUser);

costRoutes.get("/costs/products", asyncHandler(async (req: Auth, res) => {
  const query = costsQuerySchema.parse(req.query);
  res.json({ data: await costService.list(req.principal!, query) });
}));

costRoutes.post(
  "/costs/products",
  validateBody(createCostVersionSchema),
  asyncHandler(async (req: Auth, res) => {
    res.status(201).json({ data: await costService.create(req.principal!, req.body) });
  })
);
