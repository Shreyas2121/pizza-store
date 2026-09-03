import { z } from "zod";

const amountPaiseSchema = z.number().int().positive().max(2_147_483_647);

const itemAllocationSchema = z.object({
  orderItemId: z.number().int().positive(),
  quantity: z.number().int().positive(),
  allocatedPaise: amountPaiseSchema,
}).strict();

const deliveryAllocationSchema = z.object({
  type: z.literal("delivery_fee"),
  allocatedPaise: amountPaiseSchema,
}).strict();

export const requestRefundSchema = z.object({
  reasonCode: z.string().trim().min(1).max(100),
  reasonNote: z.string().trim().min(1).max(1000).optional(),
  amountPaise: amountPaiseSchema,
  allocations: z.array(z.union([itemAllocationSchema, deliveryAllocationSchema])).min(1),
}).strict();

export const approveRefundSchema = z.object({
  codCashReturned: z.boolean().optional(),
}).strict();

export const rejectRefundSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
}).strict();

export const refundsQuerySchema = z.object({
  storeId: z.coerce.number().int().positive(),
  status: z.enum([
    "requested", "approved", "rejected", "cancelled", "submitted",
    "processing", "processed", "failed",
  ]).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).strict();

export const idempotencyKeySchema = z.uuid("Idempotency-Key must be a UUID");

export type RequestRefundInput = z.infer<typeof requestRefundSchema>;
export type ApproveRefundInput = z.infer<typeof approveRefundSchema>;
export type RejectRefundInput = z.infer<typeof rejectRefundSchema>;

