import { z } from "zod";

export const payRunStatuses = ["draft", "calculated", "approved", "paid", "posted", "voided", "reversed"] as const;
const businessDate = z.iso.date();
const reason = z.string().trim().min(3).max(1000);

const isCalendarMonth = (start: string, end: string) => {
  if (!start.endsWith("-01") || start.slice(0, 7) !== end.slice(0, 7)) return false;
  const [year, month] = start.split("-").map(Number);
  const finalDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return end === `${start.slice(0, 7)}-${String(finalDay).padStart(2, "0")}`;
};

export const payRunsQuerySchema = z.object({
  storeId: z.coerce.number().int().positive(),
  status: z.enum(payRunStatuses).optional(),
  from: businessDate.optional(),
  to: businessDate.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).strict().refine((value) => !value.from || !value.to || value.from <= value.to, {
  path: ["from"], message: "from must not be after to",
});

export const createPayRunSchema = z.object({
  storeId: z.number().int().positive(),
  periodStart: businessDate,
  periodEnd: businessDate,
}).strict().refine((value) => isCalendarMonth(value.periodStart, value.periodEnd), {
  path: ["periodEnd"], message: "Pay run period must be one complete calendar month",
});

export const emptyPayRunCommandSchema = z.object({}).strict();
export const payPayRunSchema = z.object({
  paymentReference: z.string().trim().min(3).max(200),
}).strict();
export const voidPayRunSchema = z.object({ reason }).strict();
export const reversePayRunSchema = z.object({
  reason,
  effectiveBusinessDate: businessDate,
}).strict();
export const payRunIdempotencyKeySchema = z.string().trim().uuid("Idempotency-Key must be a UUID");

export type PayRunsQuery = z.infer<typeof payRunsQuerySchema>;
export type CreatePayRunInput = z.infer<typeof createPayRunSchema>;
export type PayPayRunInput = z.infer<typeof payPayRunSchema>;
export type VoidPayRunInput = z.infer<typeof voidPayRunSchema>;
export type ReversePayRunInput = z.infer<typeof reversePayRunSchema>;
