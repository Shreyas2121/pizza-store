import { z } from "zod";
import { ORDER_STATUSES, type OrderStatus } from "../../utils/types";
import { ORDER_LIST_DEFAULT_LIMIT, ORDER_LIST_MAX_LIMIT, ORDER_LIST_MAX_PAGE } from "./order.constants";

export const orderStatusSchema = z.enum(ORDER_STATUSES);

export const updateOrderStatusSchema = z.object({
  status: orderStatusSchema,
});

export const orderListQuerySchema = z.object({
  status: orderStatusSchema.optional(),
  page: z.coerce.number().int().positive().max(ORDER_LIST_MAX_PAGE).default(1),
  limit: z.coerce.number().int().positive().max(ORDER_LIST_MAX_LIMIT).default(ORDER_LIST_DEFAULT_LIMIT),
});

export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type OrderListQueryInput = z.infer<typeof orderListQuerySchema>;
