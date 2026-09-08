import { Router } from "express";
import { authenticateUser } from "../../middleware/authenticateUser";
import { validateBody } from "../../middleware/validateBody";
import { asyncHandler } from "../../utils/error";
import { parseIntegerParam } from "../../utils/request";
import type { Auth } from "../../utils/types";
import { auditHighRiskOperation as highRisk } from "../audit/high-risk-audit.middleware";
import refundService from "./refund.service";
import {
  approveRefundSchema,
  idempotencyKeySchema,
  reconcileRefundsSchema,
  refundsQuerySchema,
  rejectRefundSchema,
  requestRefundSchema,
  stuckRefundsQuerySchema,
} from "./refund.schemas";

export const refundRoutes = Router();
refundRoutes.use(authenticateUser);

refundRoutes.get(
  "/refunds",
  asyncHandler(async (req: Auth, res) => {
    const query = refundsQuerySchema.parse(req.query);
    const result = await refundService.list(req.principal!, query);
    res.json({ data: result.items, meta: result.meta });
  })
);

refundRoutes.get(
  "/refunds/stuck",
  asyncHandler(async (req: Auth, res) => {
    const query = stuckRefundsQuerySchema.parse(req.query);
    const result = await refundService.listStuck(req.principal!, query);
    res.json({ data: result.items, meta: result.meta });
  })
);

refundRoutes.post(
  "/refunds/reconcile",
  highRisk({ operation: "refund.reconcile", resourceType: "refund", resourceId: () => "stale-refunds", storeId: (req) => req.body?.storeId }),
  validateBody(reconcileRefundsSchema),
  asyncHandler(async (req: Auth, res) => {
    const data = await refundService.reconcileStaleRefunds(req.principal!, req.body);
    res.json({ data, message: "Refund reconciliation completed" });
  })
);

refundRoutes.post(
  "/orders/:orderId/refunds",
  highRisk({ operation: "refund.request", resourceType: "order", resourceId: (req) => req.params.orderId }),
  validateBody(requestRefundSchema),
  asyncHandler(async (req: Auth, res) => {
    const orderId = parseIntegerParam(req.params.orderId, "Order ID");
    const idempotencyKey = idempotencyKeySchema.parse(req.get("Idempotency-Key"));
    const data = await refundService.request(req.principal!, orderId, idempotencyKey, req.body);
    res.status(201).json({ data });
  })
);

refundRoutes.post(
  "/refunds/:refundId/approve",
  highRisk({ operation: "refund.approve", resourceType: "refund", resourceId: (req) => req.params.refundId }),
  validateBody(approveRefundSchema),
  asyncHandler(async (req: Auth, res) => {
    const refundId = parseIntegerParam(req.params.refundId, "Refund ID");
    const data = await refundService.approve(req.principal!, refundId, req.body);
    res.json({ data });
  })
);

refundRoutes.post(
  "/refunds/:refundId/reject",
  highRisk({ operation: "refund.reject", resourceType: "refund", resourceId: (req) => req.params.refundId }),
  validateBody(rejectRefundSchema),
  asyncHandler(async (req: Auth, res) => {
    const refundId = parseIntegerParam(req.params.refundId, "Refund ID");
    const data = await refundService.reject(req.principal!, refundId, req.body);
    res.json({ data });
  })
);

refundRoutes.post(
  "/refunds/:refundId/retry",
  highRisk({ operation: "refund.retry", resourceType: "refund", resourceId: (req) => req.params.refundId }),
  asyncHandler(async (req: Auth, res) => {
    const refundId = parseIntegerParam(req.params.refundId, "Refund ID");
    const data = await refundService.retry(req.principal!, refundId);
    res.json({ data });
  })
);
