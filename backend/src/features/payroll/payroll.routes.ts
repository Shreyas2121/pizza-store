import { Router } from "express";
import { authenticateUser } from "../../middleware/authenticateUser";
import { validateBody } from "../../middleware/validateBody";
import { asyncHandler } from "../../utils/error";
import { parseIntegerParam } from "../../utils/request";
import type { Auth } from "../../utils/types";
import payrollService from "./payroll.service";
import payRunService from "./pay-run.service";
import {
  createPayRunSchema,
  emptyPayRunCommandSchema,
  payPayRunSchema,
  payRunIdempotencyKeySchema,
  payRunsQuerySchema,
  reversePayRunSchema,
  voidPayRunSchema,
} from "./pay-run.schemas";
import {
  compensationVersionsQuerySchema,
  createCompensationVersionSchema,
  createPayrollProfileSchema,
  payrollProfilesQuerySchema,
  updatePayrollProfileSchema,
} from "./payroll.schemas";

export const payrollRoutes = Router();
payrollRoutes.use(authenticateUser);

payrollRoutes.get("/payroll/profiles", asyncHandler(async (req: Auth, res) => {
  const result = await payrollService.listProfiles(req.principal!, payrollProfilesQuerySchema.parse(req.query));
  res.json({ data: result.items, meta: result.meta, policy: result.policy });
}));

payrollRoutes.get("/payroll/profiles/:profileId", asyncHandler(async (req: Auth, res) => {
  res.json(await payrollService.getProfile(req.principal!, parseIntegerParam(req.params.profileId, "Payroll profile ID")));
}));

payrollRoutes.post("/payroll/profiles", validateBody(createPayrollProfileSchema), asyncHandler(async (req: Auth, res) => {
  res.status(201).json(await payrollService.createProfile(req.principal!, req.body));
}));

payrollRoutes.put("/payroll/profiles/:profileId", validateBody(updatePayrollProfileSchema), asyncHandler(async (req: Auth, res) => {
  res.json(await payrollService.updateProfile(req.principal!, parseIntegerParam(req.params.profileId, "Payroll profile ID"), req.body));
}));

payrollRoutes.get("/payroll/profiles/:profileId/compensation", asyncHandler(async (req: Auth, res) => {
  res.json(await payrollService.listCompensation(
    req.principal!,
    parseIntegerParam(req.params.profileId, "Payroll profile ID"),
    compensationVersionsQuerySchema.parse(req.query),
  ));
}));

payrollRoutes.post("/payroll/profiles/:profileId/compensation", validateBody(createCompensationVersionSchema), asyncHandler(async (req: Auth, res) => {
  res.status(201).json(await payrollService.createCompensation(
    req.principal!,
    parseIntegerParam(req.params.profileId, "Payroll profile ID"),
    req.body,
  ));
}));

const payRunId = (req: Auth) => parseIntegerParam(req.params.payRunId, "Pay run ID");
const idempotencyKey = (req: Auth) => payRunIdempotencyKeySchema.parse(req.get("Idempotency-Key"));

payrollRoutes.get("/payroll/pay-runs", asyncHandler(async (req: Auth, res) => {
  const result = await payRunService.list(req.principal!, payRunsQuerySchema.parse(req.query));
  res.json({ data: result.items, meta: result.meta, policy: result.policy });
}));

payrollRoutes.get("/payroll/pay-runs/:payRunId", asyncHandler(async (req: Auth, res) => {
  res.json(await payRunService.get(req.principal!, payRunId(req)));
}));

payrollRoutes.get("/payroll/pay-runs/:payRunId/export", asyncHandler(async (req: Auth, res) => {
  const result = await payRunService.exportCsv(req.principal!, payRunId(req));
  res.set({
    "Cache-Control": "private, no-store",
    "Content-Disposition": `attachment; filename="${result.filename}"`,
    "Content-Type": "text/csv; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  }).send(result.body);
}));

payrollRoutes.get("/payroll/pay-runs/:payRunId/statements/:employeeId", asyncHandler(async (req: Auth, res) => {
  res.set({ "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" }).json(await payRunService.statement(
    req.principal!, payRunId(req), parseIntegerParam(req.params.employeeId, "Pay-run employee ID"),
  ));
}));

payrollRoutes.post("/payroll/pay-runs", validateBody(createPayRunSchema), asyncHandler(async (req: Auth, res) => {
  res.status(201).json(await payRunService.create(req.principal!, idempotencyKey(req), req.body));
}));

payrollRoutes.post("/payroll/pay-runs/:payRunId/calculate", validateBody(emptyPayRunCommandSchema), asyncHandler(async (req: Auth, res) => {
  res.json(await payRunService.calculate(req.principal!, payRunId(req), idempotencyKey(req)));
}));

payrollRoutes.post("/payroll/pay-runs/:payRunId/approve", validateBody(emptyPayRunCommandSchema), asyncHandler(async (req: Auth, res) => {
  res.json(await payRunService.approve(req.principal!, payRunId(req), idempotencyKey(req)));
}));

payrollRoutes.post("/payroll/pay-runs/:payRunId/pay", validateBody(payPayRunSchema), asyncHandler(async (req: Auth, res) => {
  res.json(await payRunService.pay(req.principal!, payRunId(req), idempotencyKey(req), req.body));
}));

payrollRoutes.post("/payroll/pay-runs/:payRunId/post", validateBody(emptyPayRunCommandSchema), asyncHandler(async (req: Auth, res) => {
  res.json(await payRunService.post(req.principal!, payRunId(req), idempotencyKey(req)));
}));

payrollRoutes.post("/payroll/pay-runs/:payRunId/void", validateBody(voidPayRunSchema), asyncHandler(async (req: Auth, res) => {
  res.json(await payRunService.void(req.principal!, payRunId(req), idempotencyKey(req), req.body));
}));

payrollRoutes.post("/payroll/pay-runs/:payRunId/reverse", validateBody(reversePayRunSchema), asyncHandler(async (req: Auth, res) => {
  res.json(await payRunService.reverse(req.principal!, payRunId(req), idempotencyKey(req), req.body));
}));
