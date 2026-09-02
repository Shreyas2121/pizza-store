import { AppError } from "../../utils/error";
import type { OrderStatus } from "../../utils/types";

export const VALID_ORDER_TRANSITIONS: Record<
  OrderStatus,
  readonly OrderStatus[]
> = {
  awaiting_payment: ["pending", "cancelled"],
  pending: ["preparing", "cancelled"],
  preparing: ["out_for_delivery", "cancelled"],
  out_for_delivery: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

export const isValidOrderTransition = (
  currentStatus: OrderStatus,
  targetStatus: OrderStatus
): boolean => {
  if (currentStatus === targetStatus) return true;
  const allowed = VALID_ORDER_TRANSITIONS[currentStatus];
  return allowed.includes(targetStatus);
};

export const assertValidOrderTransition = (
  currentStatus: OrderStatus,
  targetStatus: OrderStatus
): void => {
  if (currentStatus === targetStatus) return;

  const allowed = VALID_ORDER_TRANSITIONS[currentStatus];
  if (!allowed.includes(targetStatus)) {
    throw new AppError(
      `Cannot transition order from '${currentStatus}' to '${targetStatus}'`,
      409,
      "INVALID_ORDER_STATUS_TRANSITION",
      { currentStatus, targetStatus, allowedTransitions: [...allowed] }
    );
  }
};
