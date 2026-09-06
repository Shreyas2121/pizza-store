import { z } from "zod";
import type { FinancialOutboxEvent } from "../../db/schema";
import { AppError } from "../../utils/error";
import { credit, debit, type PostingCommand, type PostingSourceIdentity, type ReversalCommand } from "./ledger.types";

const positiveId = z.number().int().positive();
const positivePaise = z.number().int().positive().max(2_147_483_647);
const signedPaise = z.number().int().min(-2_147_483_647).max(2_147_483_647);
const sourceSchema = z.object({ sourceType: z.string().trim().min(1), sourceId: z.union([z.string().trim().min(1), positiveId]), eventType: z.string().trim().min(1), sourceVersion: positiveId });

const movementSchema = z.object({
  movementId: positiveId,
  sessionId: positiveId,
  type: z.enum(["cod_collection", "refund", "cash_in", "cash_out", "deposit", "adjustment"]),
  amountPaise: signedPaise.refine((value) => value !== 0),
  orderId: positiveId.nullable().optional(),
  refundId: positiveId.nullable().optional(),
  reversesMovementId: positiveId.nullable().optional(),
  reversesMovementType: z.enum(["cod_collection", "refund", "cash_in", "cash_out", "deposit", "adjustment"]).nullable().optional(),
  reason: z.string().trim().min(1).nullable().optional(),
});

const closureSchema = z.object({ sessionId: positiveId, variancePaise: signedPaise, closedAt: z.iso.datetime() });
const reopenSchema = z.object({ sessionId: positiveId, originalCloseSource: sourceSchema, priorVariancePaise: signedPaise, reason: z.string().trim().min(1), authorizedActorId: positiveId, reopenedAt: z.iso.datetime() });
const allocationSchema = z.object({ storeId: positiveId, categoryId: positiveId, ledgerAccountId: positiveId, ledgerAccountCode: z.string().regex(/^\d{4,10}$/), costCenter: z.string().trim().min(1).nullable(), amountPaise: positivePaise });
const expenseSchema = z.object({ expenseId: positiveId, totalPaise: positivePaise, paymentMethod: z.enum(["bank_transfer", "cash", "card", "upi", "other"]), paymentReference: z.string().trim().min(1).nullable(), paidAt: z.iso.datetime(), postedAt: z.iso.datetime(), allocations: z.array(allocationSchema).min(1) });
const expenseReversalSchema = z.object({ expenseId: positiveId, originalPostingSource: sourceSchema, reason: z.string().trim().min(1), authorizedActorId: positiveId, effectiveBusinessDate: z.iso.date() });

const invalid = (event: FinancialOutboxEvent, code = "INVALID_POSTING_EVENT") => new AppError(`Financial event ${event.eventType}.v${event.schemaVersion} has an invalid posting payload.`, 422, code);
const sourceOf = (event: FinancialOutboxEvent): PostingSourceIdentity => ({ sourceType: event.sourceType, sourceId: event.sourceId, eventType: event.eventType, sourceVersion: event.sourceVersion });
const base = (event: FinancialOutboxEvent, description: string) => ({ kind: "source" as const, storeId: event.storeId, currency: event.currency, businessDate: event.businessDate, occurredAt: event.occurredAt, description, postedBy: event.actorId, source: sourceOf(event) });
const reversal = (event: FinancialOutboxEvent, originalSource: PostingSourceIdentity, reason: string, actorId: number, businessDate: string): { originalSource: PostingSourceIdentity; reversal: Omit<ReversalCommand, "journalEntryId"> } => ({ originalSource, reversal: { storeId: event.storeId, businessDate, occurredAt: event.occurredAt, reason, actorId, correlationId: event.correlationId ?? `${event.eventType}:${event.eventId}`, source: sourceOf(event) } });

export const buildCashMovementPosting = (event: FinancialOutboxEvent): PostingCommand | { originalSource: PostingSourceIdentity; reversal: Omit<ReversalCommand, "journalEntryId"> } | null => {
  const parsed = movementSchema.safeParse(event.payload);
  if (!parsed.success || event.schemaVersion !== 1) throw invalid(event);
  const payload = parsed.data;
  if (payload.reversesMovementId) {
    if (!event.actorId || !payload.reason) throw invalid(event);
    if (payload.reversesMovementType === "cod_collection" || payload.reversesMovementType === "refund") return null;
    return reversal(event, { sourceType: "cash_movement", sourceId: payload.reversesMovementId, eventType: "cash.movement_recorded", sourceVersion: 1 }, payload.reason, event.actorId, event.businessDate);
  }
  if (payload.type === "cod_collection" || payload.type === "refund") return null;
  if (payload.type !== "deposit" || payload.amountPaise >= 0) throw invalid(event, "CASH_LEDGER_MAPPING_REQUIRED");
  const amount = -payload.amountPaise;
  const metadata = { sessionId: payload.sessionId, movementId: payload.movementId };
  return { ...base(event, `Cash deposit from session ${payload.sessionId}`), lines: [debit("1010", amount, { metadata }), credit("1000", amount, { metadata })] };
};

export const buildCashClosurePosting = (event: FinancialOutboxEvent): PostingCommand | null => {
  const parsed = closureSchema.safeParse(event.payload);
  if (!parsed.success || event.schemaVersion !== 1) throw invalid(event);
  const { sessionId, variancePaise } = parsed.data;
  if (variancePaise === 0) return null;
  const amount = Math.abs(variancePaise);
  const metadata = { sessionId };
  return { ...base(event, `Cash variance for session ${sessionId}`), lines: variancePaise < 0 ? [debit("6100", amount, { metadata }), credit("1000", amount, { metadata })] : [debit("1000", amount, { metadata }), credit("6100", amount, { metadata })] };
};

export const buildCashReopenReversal = (event: FinancialOutboxEvent) => {
  const parsed = reopenSchema.safeParse(event.payload);
  if (!parsed.success || event.schemaVersion !== 1 || event.actorId !== parsed.data.authorizedActorId) throw invalid(event);
  if (parsed.data.priorVariancePaise === 0) return null;
  return reversal(event, parsed.data.originalCloseSource, parsed.data.reason, parsed.data.authorizedActorId, event.businessDate);
};

export const buildExpensePosting = (event: FinancialOutboxEvent): PostingCommand => {
  const parsed = expenseSchema.safeParse(event.payload);
  if (!parsed.success || event.schemaVersion !== 1) throw invalid(event);
  const payload = parsed.data;
  const total = payload.allocations.reduce((sum, item) => sum + item.amountPaise, 0);
  if (total !== payload.totalPaise || payload.allocations.some((item) => item.storeId !== event.storeId)) throw invalid(event, "EXPENSE_LEDGER_MAPPING_REQUIRED");
  const dimensions = (allocation: typeof payload.allocations[number]) => ({ expenseId: payload.expenseId, metadata: { categoryId: allocation.categoryId, ledgerAccountId: allocation.ledgerAccountId, costCenter: allocation.costCenter } });
  return { ...base(event, `Posted expense ${payload.expenseId}`), lines: [...payload.allocations.map((item) => debit(item.ledgerAccountCode, item.amountPaise, dimensions(item))), credit(payload.paymentMethod === "cash" ? "1000" : "1010", payload.totalPaise, { expenseId: payload.expenseId, metadata: { paymentReference: payload.paymentReference } })] };
};

export const buildExpenseReversal = (event: FinancialOutboxEvent) => {
  const parsed = expenseReversalSchema.safeParse(event.payload);
  if (!parsed.success || event.schemaVersion !== 1 || event.actorId !== parsed.data.authorizedActorId) throw invalid(event);
  return reversal(event, parsed.data.originalPostingSource, parsed.data.reason, parsed.data.authorizedActorId, parsed.data.effectiveBusinessDate);
};
