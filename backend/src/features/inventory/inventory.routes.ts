import { Router } from "express";
import { authenticateAdmin } from "../../middleware/authenticateUser";
import { asyncHandler } from "../../utils/error";
import { parseIntegerParam } from "../../utils/request";
import type { Auth } from "../../utils/types";
import {
  adjustInventorySchema,
  bulkRestockInventorySchema,
  inventoryListQuerySchema,
  inventoryMovementsQuerySchema,
  restockInventorySchema,
  updateInventoryThresholdSchema,
} from "./inventory.schemas";
import inventoryService from "./inventory.service";
import { io } from "../..";

export const inventoryRoutes = Router();

inventoryRoutes.use(authenticateAdmin);

inventoryRoutes.get(
  "/store/:storeId",
  asyncHandler(async (req, res) => {
    const storeId = parseIntegerParam(req.params.storeId, "Store ID");
    const query = inventoryListQuerySchema.parse(req.query);
    const result = await inventoryService.getStoreInventory(storeId, query);

    res.json({ data: result.items, meta: result.meta });
  })
);

inventoryRoutes.get(
  "/store/:storeId/product/:productId",
  asyncHandler(async (req, res) => {
    const storeId = parseIntegerParam(req.params.storeId, "Store ID");
    const productId = parseIntegerParam(req.params.productId, "Product ID");
    const data = await inventoryService.getProductInventory(storeId, productId);

    res.json({ data });
  })
);

inventoryRoutes.post(
  "/store/:storeId/restock/bulk",
  asyncHandler(async (req: Auth, res) => {
    const storeId = parseIntegerParam(req.params.storeId, "Store ID");
    const { items } = bulkRestockInventorySchema.parse(req.body);
    const data = await inventoryService.bulkRestockProducts(
      storeId,
      items,
      req.principal!.userId
    );

    res.json({ data, message: "Products restocked successfully" });
  })
);

inventoryRoutes.post(
  "/store/:storeId/product/:productId/restock",
  asyncHandler(async (req: Auth, res) => {
    const storeId = parseIntegerParam(req.params.storeId, "Store ID");
    const productId = parseIntegerParam(req.params.productId, "Product ID");
    const body = restockInventorySchema.parse(req.body);
    const data = await inventoryService.restockProduct(storeId, productId, {
      ...body,
      createdBy: req.principal!.userId,
    });

    res.json({ data, message: "Product restocked successfully" });
  })
);

inventoryRoutes.post(
  "/store/:storeId/product/:productId/adjustment",
  asyncHandler(async (req: Auth, res) => {
    const storeId = parseIntegerParam(req.params.storeId, "Store ID");
    const productId = parseIntegerParam(req.params.productId, "Product ID");
    const body = adjustInventorySchema.parse(req.body);
    const data = await inventoryService.adjustProduct(storeId, productId, {
      ...body,
      createdBy: req.principal!.userId,
    });

    if (data.alert) {
      io.emit("lowStock", data.alert);
    }

    res.json({ data, message: "Stock adjusted successfully" });
  })
);

inventoryRoutes.get(
  "/store/:storeId/movements",
  asyncHandler(async (req, res) => {
    const storeId = parseIntegerParam(req.params.storeId, "Store ID");
    const query = inventoryMovementsQuerySchema.parse(req.query);
    const result = await inventoryService.getMovements(storeId, query);

    res.json({ data: result.items, meta: result.meta });
  })
);

inventoryRoutes.patch(
  "/store/:storeId/product/:productId/threshold",
  asyncHandler(async (req, res) => {
    const storeId = parseIntegerParam(req.params.storeId, "Store ID");
    const productId = parseIntegerParam(req.params.productId, "Product ID");
    const { threshold } = updateInventoryThresholdSchema.parse(req.body);
    const data = await inventoryService.updateThreshold(
      storeId,
      productId,
      threshold
    );

    res.json({ data, message: "Low-stock threshold updated successfully" });
  })
);
