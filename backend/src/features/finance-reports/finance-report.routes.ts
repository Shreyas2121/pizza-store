import { Router, type NextFunction, type Request, type Response } from "express";
import { authenticateUser } from "../../middleware/authenticateUser";
import { asyncHandler } from "../../utils/error";
import type { Auth } from "../../utils/types";
import financeReportService from "./finance-report.service";
import { financeExportTypeSchema, financeReportQuerySchema, groupedFinanceReportQuerySchema } from "./finance-report.schemas";
import { financeMetrics, REPORT_TYPES, type FinanceReportType } from "../observability/finance-metrics";

export const financeReportRoutes = Router();
financeReportRoutes.use(authenticateUser);

const observeReport = (fixedType?: FinanceReportType) => (req: Request, res: Response, next: NextFunction) => {
  const startedAt = performance.now();
  res.once("finish", () => {
    const routeType = String(req.params.reportType ?? "").replace(/-/g, "_");
    const reportType = fixedType ?? (REPORT_TYPES.includes(routeType as FinanceReportType) ? routeType as FinanceReportType : "overview");
    financeMetrics.recordReport(reportType, req.query.storeId === undefined ? "consolidated" : "store", res.statusCode < 400 ? "success" : "failure", (performance.now() - startedAt) / 1000);
  });
  next();
};

financeReportRoutes.get("/overview", observeReport("overview"), asyncHandler(async (req: Auth, res) => {
  res.json({ data: await financeReportService.overview(req.principal!, financeReportQuerySchema.parse(req.query)) });
}));

financeReportRoutes.get("/profit-and-loss", observeReport("profit_and_loss"), asyncHandler(async (req: Auth, res) => {
  res.json({ data: await financeReportService.profitAndLoss(req.principal!, groupedFinanceReportQuerySchema.parse(req.query)) });
}));

financeReportRoutes.get("/sales", observeReport("sales"), asyncHandler(async (req: Auth, res) => {
  res.json({ data: await financeReportService.sales(req.principal!, groupedFinanceReportQuerySchema.parse(req.query)) });
}));

financeReportRoutes.get("/margins", observeReport("margins"), asyncHandler(async (req: Auth, res) => {
  res.json({ data: await financeReportService.margins(req.principal!, groupedFinanceReportQuerySchema.parse(req.query)) });
}));

financeReportRoutes.get("/exports/:reportType", observeReport(), asyncHandler(async (req: Auth, res) => {
  const reportType = financeExportTypeSchema.parse(req.params.reportType);
  const result = await financeReportService.exportCsv(req.principal!, reportType, groupedFinanceReportQuerySchema.parse(req.query));
  res.set({
    "Cache-Control": "private, no-store",
    "Content-Disposition": `attachment; filename="${result.filename}"`,
    "Content-Type": "text/csv; charset=utf-8",
  }).send(result.body);
}));
