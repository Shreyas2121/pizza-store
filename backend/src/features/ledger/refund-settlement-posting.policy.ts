import { z } from "zod";
import type { FinancialOutboxEvent } from "../../db/schema";
import { AppError } from "../../utils/error";
import { credit, debit, type PostingCommand } from "./ledger.types";

const positiveId = z.number().int().positive();
const positivePaise = z.number().int().positive().max(2_147_483_647);
const nonnegativePaise = z.number().int().nonnegative().max(2_147_483_647);
const signedPaise = z.number().int().min(-2_147_483_647).max(2_147_483_647);

const refundAllocationSchema = z.object({
  kind: z.enum(["item", "delivery_fee"]),
  orderItemId: positiveId.nullable(),
  quantity: positiveId.nullable(),
  amountPaise: positivePaise,
  taxableAmountPaise: nonnegativePaise,
  taxPaise: nonnegativePaise,
  discountReversalPaise: nonnegativePaise,
}).superRefine((value, context) => {
  if (value.taxableAmountPaise + value.taxPaise !== value.amountPaise) {
    context.addIssue({ code: "custom", message: "Refund allocation components must equal its amount." });
  }
  if ((value.kind === "item") !== (value.orderItemId !== null && value.quantity !== null)) {
    context.addIssue({ code: "custom", message: "Refund allocation target is invalid." });
  }
});

const processedRefundSchema = z.object({
  refundId: positiveId,
  orderId: positiveId,
  paymentAttemptId: positiveId,
  totalPaise: positivePaise,
  provider: z.enum(["razorpay", "cod"]),
  providerReference: z.string().trim().min(1),
  processedAt: z.iso.datetime(),
  fulfilmentState: z.string().trim().min(1),
  recognizedAt: z.iso.datetime().nullable(),
  allocations: z.array(refundAllocationSchema).min(1),
});

const disbursedRefundSchema = z.object({
  refundId: positiveId,
  orderId: positiveId,
  method: z.enum(["razorpay", "cash"]),
  disbursedPaise: positivePaise,
  clearingReference: z.string().trim().min(1),
  disbursedAt: z.iso.datetime(),
});

const settlementSchema = z.object({
  batchId: positiveId,
  providerSettlementId: z.string().trim().min(1),
  grossAmountPaise: nonnegativePaise,
  netAmountPaise: nonnegativePaise,
  feePaise: nonnegativePaise,
  feeTaxPaise: nonnegativePaise,
  adjustmentPaise: signedPaise,
  refundDeductionPaise: nonnegativePaise,
  adjustments: z.array(z.object({
    settlementLineId: positiveId,
    amountPaise: signedPaise.refine((value) => value !== 0),
    providerEntityId: z.string().trim().min(1),
  })),
  lineMatches: z.array(z.object({
    settlementLineId: positiveId,
    matchStatus: z.enum(["matched", "unmatched", "mismatch", "ignored"]),
    paymentAttemptId: positiveId.nullable(),
    refundId: positiveId.nullable(),
  })),
  utr: z.string().trim().min(1).nullable(),
  providerReference: z.string().trim().min(1).nullable(),
  settledAt: z.iso.datetime(),
});

const invalidPayload = (event: FinancialOutboxEvent, code = "INVALID_POSTING_EVENT") => new AppError(
  `Financial event ${event.eventType}.v${event.schemaVersion} has an invalid posting payload.`, 422, code
);

const base = (event: FinancialOutboxEvent, description: string) => ({
  kind: "source" as const,
  storeId: event.storeId,
  currency: event.currency,
  businessDate: event.businessDate,
  occurredAt: event.occurredAt,
  description,
  postedBy: event.actorId,
  source: { sourceType: event.sourceType, sourceId: event.sourceId, eventType: event.eventType, sourceVersion: event.sourceVersion },
});

export const buildProcessedRefundPosting = (event: FinancialOutboxEvent): PostingCommand => {
  const parsed = processedRefundSchema.safeParse(event.payload);
  if (!parsed.success || event.schemaVersion !== 1) throw invalidPayload(event);
  const payload = parsed.data;
  const allocated = payload.allocations.reduce((sum, item) => sum + item.amountPaise, 0);
  const taxable = payload.allocations.reduce((sum, item) => sum + item.taxableAmountPaise, 0);
  const tax = payload.allocations.reduce((sum, item) => sum + item.taxPaise, 0);
  if (allocated !== payload.totalPaise || taxable + tax !== payload.totalPaise) throw invalidPayload(event);
  const dimensions = { orderId: payload.orderId, paymentAttemptId: payload.paymentAttemptId, refundId: payload.refundId };
  const lines = payload.recognizedAt
    ? [
        ...(taxable ? [debit("4110", taxable, dimensions)] : []),
        ...(tax ? [debit("2200", tax, dimensions)] : []),
        credit("2100", payload.totalPaise, dimensions),
      ]
    : [debit("2000", payload.totalPaise, dimensions), credit("2100", payload.totalPaise, dimensions)];
  return { ...base(event, `Finalized refund ${payload.refundId} for order ${payload.orderId}`), lines };
};

export const buildDisbursedRefundPosting = (event: FinancialOutboxEvent): PostingCommand => {
  const parsed = disbursedRefundSchema.safeParse(event.payload);
  if (!parsed.success || event.schemaVersion !== 1) throw invalidPayload(event);
  const payload = parsed.data;
  const dimensions = { orderId: payload.orderId, refundId: payload.refundId, metadata: { clearingReference: payload.clearingReference } };
  return {
    ...base(event, `Disbursement of refund ${payload.refundId}`),
    lines: [debit("2100", payload.disbursedPaise, dimensions), credit(payload.method === "cash" ? "1000" : "1100", payload.disbursedPaise, dimensions)],
  };
};

export const buildSettlementPosting = (event: FinancialOutboxEvent): PostingCommand => {
  const parsed = settlementSchema.safeParse(event.payload);
  if (!parsed.success || event.schemaVersion !== 1) throw invalidPayload(event);
  const payload = parsed.data;
  if (payload.lineMatches.some((line) => line.matchStatus !== "matched")) {
    throw invalidPayload(event, "SETTLEMENT_MATCH_REQUIRED");
  }
  if (payload.adjustments.length || payload.adjustmentPaise !== -payload.refundDeductionPaise) {
    throw invalidPayload(event, "SETTLEMENT_ADJUSTMENT_MAPPING_REQUIRED");
  }
  const clearingPaise = payload.grossAmountPaise - payload.refundDeductionPaise;
  if (!Number.isSafeInteger(clearingPaise) || clearingPaise <= 0 ||
      payload.netAmountPaise !== clearingPaise - payload.feePaise - payload.feeTaxPaise) {
    throw invalidPayload(event, "SETTLEMENT_TOTAL_MISMATCH");
  }
  const metadata = { batchId: payload.batchId, providerSettlementId: payload.providerSettlementId, utr: payload.utr, providerReference: payload.providerReference };
  return {
    ...base(event, `Razorpay settlement ${payload.providerSettlementId}`),
    lines: [
      ...(payload.netAmountPaise ? [debit("1010", payload.netAmountPaise, { metadata })] : []),
      ...(payload.feePaise ? [debit("6000", payload.feePaise, { metadata })] : []),
      ...(payload.feeTaxPaise ? [debit("6010", payload.feeTaxPaise, { metadata })] : []),
      credit("1100", clearingPaise, { metadata }),
    ],
  };
};
