import { Router } from "express";
import { authenticateUser } from "../../middleware/authenticateUser";
import { validateBody } from "../../middleware/validateBody";
import { asyncHandler } from "../../utils/error";
import { parseIntegerParam } from "../../utils/request";
import type { Auth } from "../../utils/types";
import payrollService from "./payroll.service";
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
