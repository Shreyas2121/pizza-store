import { Router } from "express";
import { authenticateUser } from "../../middleware/authenticateUser";
import { validateBody } from "../../middleware/validateBody";
import { asyncHandler } from "../../utils/error";
import { parseIntegerParam } from "../../utils/request";
import type { Auth } from "../../utils/types";
import cashService from "./cash.service";
import { cashSessionsQuerySchema, closeCashSessionSchema, openCashSessionSchema, recordCashMovementSchema, reopenCashSessionSchema, reverseCashMovementSchema } from "./cash.schemas";

export const cashRoutes = Router();
cashRoutes.use(authenticateUser);

cashRoutes.get("/cash/sessions", asyncHandler(async (req: Auth, res) => {
  const result = await cashService.list(req.principal!, cashSessionsQuerySchema.parse(req.query));
  res.json({ data: result.items, meta: result.meta });
}));

cashRoutes.get("/cash/sessions/:sessionId", asyncHandler(async (req: Auth, res) => {
  res.json({ data: await cashService.get(req.principal!, parseIntegerParam(req.params.sessionId, "Cash session ID")) });
}));

cashRoutes.post("/cash/sessions", validateBody(openCashSessionSchema), asyncHandler(async (req: Auth, res) => {
  res.status(201).json({ data: await cashService.open(req.principal!, req.body) });
}));

cashRoutes.post("/cash/sessions/:sessionId/movements", validateBody(recordCashMovementSchema), asyncHandler(async (req: Auth, res) => {
  res.status(201).json({ data: await cashService.recordManual(req.principal!, parseIntegerParam(req.params.sessionId, "Cash session ID"), req.body) });
}));

cashRoutes.post("/cash/sessions/:sessionId/close", validateBody(closeCashSessionSchema), asyncHandler(async (req: Auth, res) => {
  res.json({ data: await cashService.close(req.principal!, parseIntegerParam(req.params.sessionId, "Cash session ID"), req.body) });
}));

cashRoutes.post("/cash/sessions/:sessionId/reopen", validateBody(reopenCashSessionSchema), asyncHandler(async (req: Auth, res) => {
  res.json({ data: await cashService.reopen(req.principal!, parseIntegerParam(req.params.sessionId, "Cash session ID"), req.body.reason) });
}));

cashRoutes.post("/cash/movements/:movementId/reverse", validateBody(reverseCashMovementSchema), asyncHandler(async (req: Auth, res) => {
  res.status(201).json({ data: await cashService.reverseMovement(req.principal!, parseIntegerParam(req.params.movementId, "Cash movement ID"), req.body.reason) });
}));
