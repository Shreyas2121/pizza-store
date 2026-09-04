import { Router } from "express";
import { authenticateUser } from "../../middleware/authenticateUser";
import { validateBody } from "../../middleware/validateBody";
import { asyncHandler } from "../../utils/error";
import { parseIntegerParam } from "../../utils/request";
import type { Auth } from "../../utils/types";
import {
  importSettlementSchema,
  reconciliationIssuesQuerySchema,
  resolveReconciliationIssueSchema,
  settlementsQuerySchema,
} from "./settlement.schemas";
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

settlementRoutes.post(
  "/settlements/:settlementId/reconcile",
  asyncHandler(async (req: Auth, res) => {
    const id = parseIntegerParam(req.params.settlementId, "Settlement ID");
    res.json({ data: await settlementService.reconcile(req.principal!, id) });
  })
);

settlementRoutes.get(
  "/reconciliation/issues",
  asyncHandler(async (req: Auth, res) => {
    const query = reconciliationIssuesQuerySchema.parse(req.query);
    const result = await settlementService.listIssues(req.principal!, query);
    res.json({ data: result.items, meta: result.meta });
  })
);

settlementRoutes.post(
  "/reconciliation/issues/:issueId/resolve",
  validateBody(resolveReconciliationIssueSchema),
  asyncHandler(async (req: Auth, res) => {
    const id = parseIntegerParam(req.params.issueId, "Reconciliation issue ID");
    res.json({ data: await settlementService.resolveIssue(req.principal!, id, req.body) });
  })
);
