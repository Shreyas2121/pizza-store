import { z } from "zod";
import type { FinancialOutboxEvent } from "../../db/schema";
import { AppError } from "../../utils/error";
import { credit, debit, type PostingCommand, type PostingSourceIdentity, type ReversalCommand } from "./ledger.types";

const positiveId = z.number().int().positive();
const nonNegativePaise = z.number().int().min(0).max(2_147_483_647);
const positivePaise = nonNegativePaise.positive();
const sourceSchema = z.object({
  sourceType: z.string().trim().min(1), sourceId: z.union([z.string().trim().min(1), positiveId]),
  eventType: z.string().trim().min(1), sourceVersion: positiveId,
});
const postedSchema = z.object({
  payRunId: positiveId,
  periodStart: z.iso.date(),
  periodEnd: z.iso.date(),
  grossPayPaise: positivePaise,
  deductionPaise: nonNegativePaise,
  netPayPaise: nonNegativePaise,
  employerCostPaise: nonNegativePaise,
  totalEmployerCostPaise: positivePaise,
  paymentReferenceRecorded: z.literal(true),
  postedAt: z.iso.datetime(),
});
const reversedSchema = z.object({
  payRunId: positiveId,
  originalPostingSource: sourceSchema,
  reason: z.string().trim().min(1),
  authorizedActorId: positiveId,
  effectiveBusinessDate: z.iso.date(),
});

const invalid = (event: FinancialOutboxEvent, code = "INVALID_POSTING_EVENT") =>
  new AppError(`Financial event ${event.eventType}.v${event.schemaVersion} has an invalid posting payload.`, 422, code);
const sourceOf = (event: FinancialOutboxEvent): PostingSourceIdentity => ({
  sourceType: event.sourceType, sourceId: event.sourceId, eventType: event.eventType, sourceVersion: event.sourceVersion,
});

export const buildPayRunPosting = (event: FinancialOutboxEvent): PostingCommand => {
  const parsed = postedSchema.safeParse(event.payload);
  if (!parsed.success || event.schemaVersion !== 1) throw invalid(event);
  const value = parsed.data;
  if (
    value.netPayPaise !== value.grossPayPaise - value.deductionPaise
    || value.totalEmployerCostPaise !== value.grossPayPaise + value.employerCostPaise
    || value.payRunId !== Number(event.sourceId)
  ) throw invalid(event, "PAY_RUN_LEDGER_MAPPING_REQUIRED");
  const liabilityPaise = value.deductionPaise + value.employerCostPaise;
  const dimensions = { payRunId: value.payRunId };
  return {
    kind: "source", storeId: event.storeId, currency: event.currency, businessDate: event.businessDate,
    occurredAt: event.occurredAt, postedBy: event.actorId, source: sourceOf(event),
    description: `Posted payroll run ${value.payRunId} for ${value.periodStart} to ${value.periodEnd}`,
    lines: [
      debit("6200", value.totalEmployerCostPaise, dimensions),
      ...(value.netPayPaise ? [credit("2300", value.netPayPaise, dimensions)] : []),
      ...(liabilityPaise ? [credit("2310", liabilityPaise, dimensions)] : []),
      ...(value.netPayPaise ? [debit("2300", value.netPayPaise, dimensions), credit("1010", value.netPayPaise, dimensions)] : []),
    ],
  };
};

export const buildPayRunReversal = (event: FinancialOutboxEvent): {
  originalSource: PostingSourceIdentity;
  reversal: Omit<ReversalCommand, "journalEntryId">;
} => {
  const parsed = reversedSchema.safeParse(event.payload);
  if (!parsed.success || event.schemaVersion !== 1 || event.actorId !== parsed.data.authorizedActorId) throw invalid(event);
  return {
    originalSource: parsed.data.originalPostingSource,
    reversal: {
      storeId: event.storeId, businessDate: parsed.data.effectiveBusinessDate, occurredAt: event.occurredAt,
      reason: parsed.data.reason, actorId: parsed.data.authorizedActorId,
      correlationId: event.correlationId ?? `${event.eventType}:${event.eventId}`, source: sourceOf(event),
    },
  };
};
