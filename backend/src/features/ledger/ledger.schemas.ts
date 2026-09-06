import { z } from "zod";

const businessDate = z.iso.date();
const reason = z.string().trim().min(3).max(500);

export const ledgerStoreQuerySchema = z.object({ storeId: z.coerce.number().int().positive() }).strict();
export const ledgerIdempotencyKeySchema = z.string().trim().min(8).max(255);

export const journalsQuerySchema = ledgerStoreQuerySchema.extend({
  from: businessDate.optional(),
  to: businessDate.optional(),
  accountId: z.coerce.number().int().positive().optional(),
  cursor: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).strict().superRefine((value, context) => {
  if (value.from && value.to && value.from > value.to) context.addIssue({ code: "custom", path: ["to"], message: "to must be on or after from" });
});

export const trialBalanceQuerySchema = ledgerStoreQuerySchema.extend({ from: businessDate.optional(), to: businessDate.optional() }).strict().superRefine((value, context) => {
  if (value.from && value.to && value.from > value.to) context.addIssue({ code: "custom", path: ["to"], message: "to must be on or after from" });
});

export const createFiscalPeriodSchema = z.object({ storeId: z.number().int().positive(), name: z.string().trim().min(1).max(100), startDate: businessDate, endDate: businessDate, reason }).strict().refine((value) => value.startDate <= value.endDate, { path: ["endDate"], message: "endDate must be on or after startDate" });
export const periodTransitionSchema = z.object({ reason }).strict();

const manualLineSchema = z.object({ accountCode: z.string().regex(/^\d{4,10}$/), side: z.enum(["debit", "credit"]), amountPaise: z.number().int().positive().max(2_147_483_647), description: z.string().trim().min(1).max(500).optional() }).strict();
export const manualJournalSchema = z.object({ storeId: z.number().int().positive(), businessDate, description: z.string().trim().min(3).max(500), lines: z.array(manualLineSchema).min(2).max(100), softCloseOverrideReason: reason.optional() }).strict();
export const reverseJournalSchema = z.object({ businessDate, reason }).strict();

export type JournalsQuery = z.infer<typeof journalsQuerySchema>;
export type TrialBalanceQuery = z.infer<typeof trialBalanceQuerySchema>;
export type CreateFiscalPeriodInput = z.infer<typeof createFiscalPeriodSchema>;
export type ManualJournalInput = z.infer<typeof manualJournalSchema>;
export type ReverseJournalInput = z.infer<typeof reverseJournalSchema>;
