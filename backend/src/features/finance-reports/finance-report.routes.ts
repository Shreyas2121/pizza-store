import { Router } from "express";
import { authenticateUser } from "../../middleware/authenticateUser";
import { asyncHandler } from "../../utils/error";
import type { Auth } from "../../utils/types";
import financeReportService from "./finance-report.service";
import { financeReportQuerySchema, groupedFinanceReportQuerySchema } from "./finance-report.schemas";

export const financeReportRoutes = Router();
financeReportRoutes.use(authenticateUser);

financeReportRoutes.get("/overview", asyncHandler(async (req: Auth, res) => {
  res.json({ data: await financeReportService.overview(req.principal!, financeReportQuerySchema.parse(req.query)) });
}));

financeReportRoutes.get("/profit-and-loss", asyncHandler(async (req: Auth, res) => {
  res.json({ data: await financeReportService.profitAndLoss(req.principal!, groupedFinanceReportQuerySchema.parse(req.query)) });
}));

financeReportRoutes.get("/sales", asyncHandler(async (req: Auth, res) => {
  res.json({ data: await financeReportService.sales(req.principal!, groupedFinanceReportQuerySchema.parse(req.query)) });
}));

financeReportRoutes.get("/margins", asyncHandler(async (req: Auth, res) => {
  res.json({ data: await financeReportService.margins(req.principal!, groupedFinanceReportQuerySchema.parse(req.query)) });
}));
