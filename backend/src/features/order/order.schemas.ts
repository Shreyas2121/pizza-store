import { z } from "zod";
import { ORDER_STATUSES, type OrderStatus } from "../../utils/types";

export const orderStatusSchema = z.enum(ORDER_STATUSES);

export const updateOrderStatusSchema = z.object({
  status: orderStatusSchema,
});

export const orderListQuerySchema = z.object({
  status: orderStatusSchema.optional(),
});

export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type OrderListQueryInput = z.infer<typeof orderListQuerySchema>;
