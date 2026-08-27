import { Router } from "express";
import { z } from "zod";
import { authenticateAdmin, authenticateUser } from "../../middleware/authenticateUser";
import { asyncHandler } from "../../utils/error";
import { parseIntegerParam } from "../../utils/request";
import type { Auth } from "../../utils/types";
import { fromParam, requireStorePermission } from "../access/access.middleware";
import auditService from "./audit.service";

const optionalPositiveInteger = z.preprocess(
  (value) => value === undefined ? undefined : Number(value),
  z.number().int().positive().optional()
);
const auditQuerySchema = z.object({
  page: z.preprocess((value) => value === undefined ? 1 : Number(value), z.number().int().positive()),
  limit: z.preprocess((value) => value === undefined ? 25 : Number(value), z.number().int().min(1).max(100)),
  storeId: optionalPositiveInteger,
  actorUserId: optionalPositiveInteger,
  action: z.string().trim().min(1).max(100).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
}).strict();

export const storeAuditRoutes = Router();
storeAuditRoutes.get(
  "/:storeId/audit",
  authenticateUser,
  requireStorePermission("store.audit.read", fromParam("storeId")),
  asyncHandler(async (req: Auth, res) => {
    const storeId = parseIntegerParam(req.params.storeId, "Store ID");
    const query = auditQuerySchema.omit({ storeId: true }).parse(req.query);
    const result = await auditService.listStore(req.principal!, storeId, query);
    res.json({ data: result.items, meta: result.meta });
  })
);

export const globalAuditRoutes = Router();
globalAuditRoutes.get(
  "/",
  authenticateAdmin,
  asyncHandler(async (req: Auth, res) => {
    const query = auditQuerySchema.parse(req.query);
    const result = await auditService.listGlobal(req.principal!, query);
    res.json({ data: result.items, meta: result.meta });
  })
);
