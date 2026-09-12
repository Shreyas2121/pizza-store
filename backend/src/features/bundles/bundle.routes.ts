import { Router } from "express";
import { authenticateAdmin } from "../../middleware/authenticateUser";
import { validateBody } from "../../middleware/validateBody";
import { asyncHandler } from "../../utils/error";
import { parseIntegerParam } from "../../utils/request";
import bundleService from "./bundle.service";
import { bundleDefinitionWriteSchema } from "./bundle.schemas";

export const bundleRoutes = Router();

bundleRoutes.post(
  "/admin/:id",
  authenticateAdmin,
  validateBody(bundleDefinitionWriteSchema),
  asyncHandler(async (req, res) => {
    const data = await bundleService.createDefinition(
      parseIntegerParam(req.params.id, "Bundle product ID"),
      req.body
    );
    res.status(201).json({ data });
  })
);

bundleRoutes.put(
  "/admin/:id",
  authenticateAdmin,
  validateBody(bundleDefinitionWriteSchema),
  asyncHandler(async (req, res) => {
    const data = await bundleService.replaceDefinition(
      parseIntegerParam(req.params.id, "Bundle product ID"),
      req.body
    );
    res.json({ data });
  })
);

bundleRoutes.get(
  "/admin/:id",
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const data = await bundleService.getAdminDefinition(
      parseIntegerParam(req.params.id, "Bundle product ID")
    );
    res.json({ data });
  })
);

bundleRoutes.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const storeId = parseIntegerParam(String(req.query.storeId ?? ""), "Store ID");
    const data = await bundleService.getPublicBundle(
      parseIntegerParam(req.params.id, "Bundle product ID"),
      storeId
    );
    res.json({ data });
  })
);
