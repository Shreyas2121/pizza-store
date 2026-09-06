import { z } from "zod";
import type { FinancialOutboxEvent } from "../../db/schema";
import { AppError } from "../../utils/error";
import { credit, debit, type PostingCommand, type PostingSourceIdentity, type ReversalCommand } from "./ledger.types";

const positivePaise = z.number().int().positive().max(2_147_483_647);
const nonnegativePaise = z.number().int().nonnegative().max(2_147_483_647);
const signedPaise = z.number().int().min(-2_147_483_647).max(2_147_483_647);
const positiveId = z.number().int().positive();

const capturedPaymentSchema = z.object({
  paymentAttemptId: positiveId,
  orderId: positiveId,
  provider: z.enum(["razorpay", "cod"]),
  method: z.enum(["cash", "card", "upi", "netbanking", "wallet", "other"]),
  capturedPaise: positivePaise,
  capturedAt: z.iso.datetime(),
  providerReference: z.string().trim().min(1).nullable().optional(),
  cashSessionId: positiveId.nullable().optional(),
}).superRefine((value, context) => {
  if (value.provider === "razorpay" && !value.providerReference) {
    context.addIssue({ code: "custom", message: "Razorpay capture requires a provider reference." });
  }
  if (value.provider === "cod" && !value.cashSessionId) {
    context.addIssue({ code: "custom", message: "COD capture requires a cash session." });
  }
});

const costSnapshotSchema = z.object({
  orderItemId: positiveId,
  productId: positiveId,
  quantity: positiveId,
  costVersionId: positiveId,
  unitCostPaise: nonnegativePaise,
  lineCostPaise: nonnegativePaise,
});

const deliveredOrderSchema = z.object({
  orderId: positiveId,
  pricingPolicyVersion: positiveId,
  customerTotalPaise: positivePaise,
  preDiscountTaxableFoodPaise: nonnegativePaise,
  discountContraPaise: nonnegativePaise,
  taxableDeliveryPaise: nonnegativePaise,
  itemTaxPaise: nonnegativePaise,
  deliveryTaxPaise: nonnegativePaise,
  roundingAdjustmentPaise: signedPaise,
  lineCostSnapshots: z.array(costSnapshotSchema).min(1),
  deliveredAt: z.iso.datetime(),
});

const sourceIdentitySchema = z.object({
  sourceType: z.string().trim().min(1),
  sourceId: z.union([z.string().trim().min(1), positiveId]),
  eventType: z.literal("order.delivered"),
  sourceVersion: positiveId,
});

const recognitionReversalSchema = z.object({
  orderId: positiveId,
  originalRecognitionSource: sourceIdentitySchema,
  correctionId: z.string().trim().min(1),
  reason: z.string().trim().min(1).max(500),
  authorizedActorId: positiveId,
  effectiveBusinessDate: z.iso.date(),
});

const invalidPayload = (event: FinancialOutboxEvent) => new AppError(
  `Financial event ${event.eventType}.v${event.schemaVersion} has an invalid posting payload.`,
  422,
  "INVALID_POSTING_EVENT"
);

const sourceOf = (event: FinancialOutboxEvent): PostingSourceIdentity => ({
  sourceType: event.sourceType,
  sourceId: event.sourceId,
  eventType: event.eventType,
  sourceVersion: event.sourceVersion,
});

const commandBase = (event: FinancialOutboxEvent, description: string) => ({
  kind: "source" as const,
  storeId: event.storeId,
  currency: event.currency,
  businessDate: event.businessDate,
  occurredAt: event.occurredAt,
  description,
  postedBy: event.actorId,
  source: sourceOf(event),
});

export const buildCapturedPaymentPosting = (event: FinancialOutboxEvent): PostingCommand => {
  const parsed = capturedPaymentSchema.safeParse(event.payload);
  if (!parsed.success || event.schemaVersion !== 1) throw invalidPayload(event);
  const payload = parsed.data;
  const dimensions = {
    orderId: payload.orderId,
    paymentAttemptId: payload.paymentAttemptId,
    metadata: {
      provider: payload.provider,
      providerReference: payload.providerReference ?? null,
      cashSessionId: payload.cashSessionId ?? null,
    },
  };
  return {
    ...commandBase(event, `${payload.provider === "cod" ? "COD" : "Online"} collection for order ${payload.orderId}`),
    lines: [
      debit(payload.provider === "cod" ? "1000" : "1100", payload.capturedPaise, dimensions),
      credit("2000", payload.capturedPaise, dimensions),
    ],
  };
};

export const buildDeliveredOrderPosting = (event: FinancialOutboxEvent): PostingCommand => {
  const parsed = deliveredOrderSchema.safeParse(event.payload);
  if (!parsed.success || event.schemaVersion !== 1) throw invalidPayload(event);
  const payload = parsed.data;
  const itemCostPaise = payload.lineCostSnapshots.reduce((sum, line) => sum + line.lineCostPaise, 0);
  if (!Number.isSafeInteger(itemCostPaise) || itemCostPaise > 2_147_483_647) throw invalidPayload(event);
  const dimensions = { orderId: payload.orderId };
  const lines = [
    debit("2000", payload.customerTotalPaise, dimensions),
    ...(payload.discountContraPaise ? [debit("4100", payload.discountContraPaise, dimensions)] : []),
    ...(itemCostPaise ? [debit("5000", itemCostPaise, dimensions)] : []),
    ...(payload.roundingAdjustmentPaise < 0 ? [debit("6990", -payload.roundingAdjustmentPaise, dimensions)] : []),
    ...(payload.preDiscountTaxableFoodPaise ? [credit("4000", payload.preDiscountTaxableFoodPaise, dimensions)] : []),
    ...(payload.taxableDeliveryPaise ? [credit("4010", payload.taxableDeliveryPaise, dimensions)] : []),
    ...(payload.itemTaxPaise + payload.deliveryTaxPaise
      ? [credit("2200", payload.itemTaxPaise + payload.deliveryTaxPaise, dimensions)] : []),
    ...(itemCostPaise ? [credit("1200", itemCostPaise, dimensions)] : []),
    ...(payload.roundingAdjustmentPaise > 0 ? [credit("6990", payload.roundingAdjustmentPaise, dimensions)] : []),
  ];
  return { ...commandBase(event, `Delivery recognition for order ${payload.orderId}`), lines };
};

export const buildRecognitionReversal = (event: FinancialOutboxEvent): {
  originalSource: PostingSourceIdentity;
  reversal: Omit<ReversalCommand, "journalEntryId">;
} => {
  const parsed = recognitionReversalSchema.safeParse(event.payload);
  if (!parsed.success || event.schemaVersion !== 1 || event.actorId !== parsed.data.authorizedActorId) {
    throw invalidPayload(event);
  }
  return {
    originalSource: parsed.data.originalRecognitionSource,
    reversal: {
      storeId: event.storeId,
      businessDate: parsed.data.effectiveBusinessDate,
      occurredAt: event.occurredAt,
      reason: parsed.data.reason,
      actorId: parsed.data.authorizedActorId,
      correlationId: event.correlationId ?? parsed.data.correctionId,
      source: sourceOf(event),
    },
  };
};
