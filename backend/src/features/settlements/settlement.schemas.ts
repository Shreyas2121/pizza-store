import { z } from "zod";
import { SETTLEMENT_BATCH_STATUSES } from "../../utils/types";

const providerSettlementId = z.string().trim().min(1).max(255);

export const importSettlementSchema = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("fixture"),
    providerSettlementId,
  }).strict(),
  z.object({
    source: z.literal("test_provider"),
    storeId: z.number().int().positive(),
    providerSettlementId,
  }).strict(),
]);

export const settlementsQuerySchema = z.object({
  storeId: z.coerce.number().int().positive(),
  status: z.enum(SETTLEMENT_BATCH_STATUSES).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).strict();

export const reconciliationIssuesQuerySchema = z.object({
  storeId: z.coerce.number().int().positive().optional(),
  status: z.enum(["open", "resolved"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).strict();

export const resolveReconciliationIssueSchema = z.object({
  reason: z.string().trim().min(3).max(1000),
}).strict();

export type ImportSettlementInput = z.infer<typeof importSettlementSchema>;
export type ReconciliationIssuesQuery = z.infer<typeof reconciliationIssuesQuerySchema>;
export type ResolveReconciliationIssueInput = z.infer<typeof resolveReconciliationIssueSchema>;
