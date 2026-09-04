import { Router } from "express";
import { authenticateUser } from "../../middleware/authenticateUser";
import { validateBody } from "../../middleware/validateBody";
import { asyncHandler } from "../../utils/error";
import { parseIntegerParam } from "../../utils/request";
import type { Auth } from "../../utils/types";
import { importSettlementSchema, settlementsQuerySchema } from "./settlement.schemas";
import settlementService from "./settlement.service";

export const settlementRoutes = Router();
settlementRoutes.use(authenticateUser);

settlementRoutes.get(
  "/settlements",
  asyncHandler(async (req: Auth, res) => {
    const query = settlementsQuerySchema.parse(req.query);
    const result = await settlementService.list(req.principal!, query);
    res.json({ data: result.items, meta: result.meta });
  })
);
settlementRoutes.get(
  "/settlements/:settlementId",
  asyncHandler(async (req: Auth, res) => {
    const id = parseIntegerParam(req.params.settlementId, "Settlement ID");
    res.json({ data: await settlementService.get(req.principal!, id) });
  })
);

settlementRoutes.post(
  "/settlements/import",
  validateBody(importSettlementSchema),
  asyncHandler(async (req: Auth, res) => {
    const result = await settlementService.importBatch(req.principal!, req.body);
    res.status(result.imported ? 201 : 200).json({ data: result.batch, imported: result.imported });
  })
);
