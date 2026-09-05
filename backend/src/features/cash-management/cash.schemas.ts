import { z } from "zod";
import { CASH_MOVEMENT_TYPES } from "../../utils/types";

const businessDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const paise = z.number().int().min(0).max(2_147_483_647);
const reason = z.string().trim().min(3).max(1000);

export const cashSessionsQuerySchema = z.object({
  storeId: z.coerce.number().int().positive(),
  status: z.enum(["open", "closed"]).optional(),
  businessDate: businessDate.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).strict();

export const openCashSessionSchema = z.object({
  storeId: z.number().int().positive(),
  openingFloatPaise: paise,
}).strict();

export const recordCashMovementSchema = z.object({
  type: z.enum(CASH_MOVEMENT_TYPES).refine((value) => !["cod_collection", "refund"].includes(value), {
    message: "COD collections and refunds are recorded by their source workflows",
  }),
  amountPaise: paise.min(1),
  direction: z.enum(["in", "out"]).optional(),
  reason,
}).strict().superRefine((value, ctx) => {
  if (value.type === "adjustment" && !value.direction) {
    ctx.addIssue({ code: "custom", path: ["direction"], message: "Adjustment direction is required" });
  }
});

export const closeCashSessionSchema = z.object({
  countedCashPaise: paise,
  materialVarianceAcknowledged: z.boolean().default(false),
}).strict();

export const reopenCashSessionSchema = z.object({ reason }).strict();
export const reverseCashMovementSchema = z.object({ reason }).strict();

export type CashSessionsQuery = z.infer<typeof cashSessionsQuerySchema>;
export type OpenCashSessionInput = z.infer<typeof openCashSessionSchema>;
export type RecordCashMovementInput = z.infer<typeof recordCashMovementSchema>;
export type CloseCashSessionInput = z.infer<typeof closeCashSessionSchema>;
