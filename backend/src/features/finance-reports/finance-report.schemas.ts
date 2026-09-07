import { z } from "zod";

const businessDate = z.iso.date();
const aggregatePaise = z.string().regex(/^-?\d+$/);
const period = z.object({ from: businessDate, to: businessDate }).strict();
const scope = z.object({ kind: z.enum(["store", "consolidated"]), storeIds: z.array(z.number().int().positive()) }).strict();

export const financeReportQuerySchema = z.object({
  from: businessDate,
  to: businessDate,
  storeId: z.coerce.number().int().positive().optional(),
}).strict().refine((value) => value.from <= value.to, { path: ["to"], message: "to must be on or after from" });

export const groupedFinanceReportQuerySchema = financeReportQuerySchema.safeExtend({
  groupBy: z.enum(["month", "quarter", "fiscal_year"]).default("month"),
});

export const financeExportTypeSchema = z.enum(["overview", "profit-and-loss", "sales", "margins"]);

const policySchema = z.object({
  currency: z.literal("INR"),
  timezone: z.string().min(1),
  dateBasis: z.literal("journal_business_date"),
  recognitionBasis: z.literal("delivery"),
  includedJournalStatuses: z.tuple([z.literal("posted"), z.literal("reversed")]),
  generatedAt: z.iso.datetime(),
  lastReconciledAt: z.iso.datetime().nullable(),
  scope,
}).strict();

const reportTotalsSchema = z.object({
  salesRevenuePaise: aggregatePaise,
  deliveryRevenuePaise: aggregatePaise,
  discountsPaise: aggregatePaise,
  refundsPaise: aggregatePaise,
  recognizedRevenuePaise: aggregatePaise,
  collectionsPaise: aggregatePaise,
  cogsPaise: aggregatePaise,
  grossProfitPaise: aggregatePaise,
  grossMarginBps: z.number().int().nullable(),
  operatingExpensesPaise: aggregatePaise,
  payrollCostPaise: aggregatePaise,
  operatingResultPaise: aggregatePaise,
  unsettledRazorpayPaise: aggregatePaise,
  cashVariancePaise: aggregatePaise,
}).strict();

const overviewKpisSchema = reportTotalsSchema.extend({ openReconciliationIssues: z.number().int().nonnegative().nullable() }).strict();
const baseReportSchema = z.object({ policy: policySchema, period, comparisonPeriod: period }).strict();

export const overviewResponseSchema = baseReportSchema.extend({
  kpis: overviewKpisSchema,
  comparison: z.object({ period, kpis: overviewKpisSchema }).strict(),
  drillDownUrls: z.record(z.string(), z.string()),
}).strict();

const salesPointSchema = z.object({
  period: z.string().min(1),
  salesRevenuePaise: aggregatePaise,
  deliveryRevenuePaise: aggregatePaise,
  discountsPaise: aggregatePaise,
  refundsPaise: aggregatePaise,
  recognizedRevenuePaise: aggregatePaise,
}).strict();

const marginPointSchema = z.object({
  period: z.string().min(1),
  recognizedRevenuePaise: aggregatePaise,
  cogsPaise: aggregatePaise,
  grossProfitPaise: aggregatePaise,
  grossMarginBps: z.number().int().nullable(),
}).strict();

const expenseLineSchema = z.object({ accountCode: z.string(), accountName: z.string(), amountPaise: aggregatePaise }).strict();

export const salesResponseSchema = baseReportSchema.extend({
  groupBy: z.enum(["month", "quarter", "fiscal_year"]),
  totals: reportTotalsSchema,
  series: z.array(salesPointSchema),
  comparison: z.object({ totals: reportTotalsSchema, series: z.array(salesPointSchema) }).strict(),
}).strict();

export const marginsResponseSchema = baseReportSchema.extend({
  groupBy: z.enum(["month", "quarter", "fiscal_year"]),
  totals: reportTotalsSchema,
  series: z.array(marginPointSchema),
  comparison: z.object({ totals: reportTotalsSchema, series: z.array(marginPointSchema) }).strict(),
}).strict();

const profitAndLossPointSchema = z.object({
  period: z.string().min(1),
  recognizedRevenuePaise: aggregatePaise,
  cogsPaise: aggregatePaise,
  grossProfitPaise: aggregatePaise,
  grossMarginBps: z.number().int().nullable(),
  operatingExpensesPaise: aggregatePaise,
  payrollCostPaise: aggregatePaise,
  operatingResultPaise: aggregatePaise,
}).strict();

export const profitAndLossResponseSchema = baseReportSchema.extend({
  groupBy: z.enum(["month", "quarter", "fiscal_year"]),
  totals: reportTotalsSchema,
  operatingExpenseLines: z.array(expenseLineSchema),
  periods: z.array(profitAndLossPointSchema),
  comparison: z.object({ totals: reportTotalsSchema, operatingExpenseLines: z.array(expenseLineSchema), periods: z.array(profitAndLossPointSchema) }).strict(),
}).strict();

export type FinanceReportQuery = z.infer<typeof financeReportQuerySchema>;
export type GroupedFinanceReportQuery = z.infer<typeof groupedFinanceReportQuerySchema>;
export type ReportTotalsDto = z.infer<typeof reportTotalsSchema>;
export type FinanceOverviewDto = z.infer<typeof overviewResponseSchema>;
export type FinanceProfitAndLossDto = z.infer<typeof profitAndLossResponseSchema>;
export type FinanceSalesDto = z.infer<typeof salesResponseSchema>;
export type FinanceMarginsDto = z.infer<typeof marginsResponseSchema>;
