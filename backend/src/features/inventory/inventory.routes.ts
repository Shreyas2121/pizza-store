import { Router } from "express";
import { authenticateUser } from "../../middleware/authenticateUser";
import { fromParam, requireStorePermission } from "../access/access.middleware";
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
import { RealtimeRooms } from "../realtime/realtime-rooms";

export const inventoryRoutes = Router();

inventoryRoutes.use(authenticateUser);

inventoryRoutes.get(
  "/store/:storeId",
  requireStorePermission("inventory.read", fromParam("storeId")),
  asyncHandler(async (req: Auth, res) => {
    const storeId = parseIntegerParam(req.params.storeId, "Store ID");
    const query = inventoryListQuerySchema.parse(req.query);
    const result = await inventoryService.getStoreInventory(storeId, query, req.principal!);

    res.json({ data: result.items, meta: result.meta });
  })
);

inventoryRoutes.get(
  "/store/:storeId/product/:productId",
  requireStorePermission("inventory.read", fromParam("storeId")),
  asyncHandler(async (req: Auth, res) => {
    const storeId = parseIntegerParam(req.params.storeId, "Store ID");
    const productId = parseIntegerParam(req.params.productId, "Product ID");
    const data = await inventoryService.getProductInventory(storeId, productId, req.principal!);

    res.json({ data });
  })
);

inventoryRoutes.post(
  "/store/:storeId/restock/bulk",
  requireStorePermission("inventory.restock", fromParam("storeId")),
  asyncHandler(async (req: Auth, res) => {
    const storeId = parseIntegerParam(req.params.storeId, "Store ID");
    const { items } = bulkRestockInventorySchema.parse(req.body);
    const data = await inventoryService.bulkRestockProducts(
      storeId,
      items,
      req.principal!
    );

    res.json({ data, message: "Products restocked successfully" });
  })
);

inventoryRoutes.post(
  "/store/:storeId/product/:productId/restock",
  requireStorePermission("inventory.restock", fromParam("storeId")),
  asyncHandler(async (req: Auth, res) => {
    const storeId = parseIntegerParam(req.params.storeId, "Store ID");
    const productId = parseIntegerParam(req.params.productId, "Product ID");
    const body = restockInventorySchema.parse(req.body);
    const data = await inventoryService.restockProduct(storeId, productId, body, req.principal!);

    res.json({ data, message: "Product restocked successfully" });
  })
);

inventoryRoutes.post(
  "/store/:storeId/product/:productId/adjustment",
  requireStorePermission("inventory.adjust", fromParam("storeId")),
  asyncHandler(async (req: Auth, res) => {
    const storeId = parseIntegerParam(req.params.storeId, "Store ID");
    const productId = parseIntegerParam(req.params.productId, "Product ID");
    const body = adjustInventorySchema.parse(req.body);
    const data = await inventoryService.adjustProduct(storeId, productId, body, req.principal!);

    if (data.alert) {
      io.to([
        RealtimeRooms.storeInventory(storeId),
        RealtimeRooms.platformAdmin(),
      ]).emit("lowStock", data.alert);
    }

    res.json({ data, message: "Stock adjusted successfully" });
  })
);

inventoryRoutes.get(
  "/store/:storeId/movements",
  requireStorePermission("inventory.read", fromParam("storeId")),
  asyncHandler(async (req: Auth, res) => {
    const storeId = parseIntegerParam(req.params.storeId, "Store ID");
    const query = inventoryMovementsQuerySchema.parse(req.query);
    const result = await inventoryService.getMovements(storeId, query, req.principal!);

    res.json({ data: result.items, meta: result.meta });
  })
);

inventoryRoutes.patch(
  "/store/:storeId/product/:productId/threshold",
  requireStorePermission("inventory.threshold.update", fromParam("storeId")),
  asyncHandler(async (req: Auth, res) => {
    const storeId = parseIntegerParam(req.params.storeId, "Store ID");
    const productId = parseIntegerParam(req.params.productId, "Product ID");
    const { threshold } = updateInventoryThresholdSchema.parse(req.body);
    const data = await inventoryService.updateThreshold(
      storeId,
      productId,
      threshold,
      req.principal!
    );

    res.json({ data, message: "Low-stock threshold updated successfully" });
  })
);
