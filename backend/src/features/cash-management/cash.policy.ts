import type { CashMovementType } from "../../utils/types";

export const MATERIAL_CASH_VARIANCE_PAISE = 50_000;

export const signedMovementAmount = (type: CashMovementType, amountPaise: number, direction?: "in" | "out") => {
  if (type === "cash_out" || type === "deposit" || type === "refund") return -amountPaise;
  if (type === "adjustment" && direction === "out") return -amountPaise;
  return amountPaise;
};

export const isMaterialVariance = (variancePaise: number) =>
  Math.abs(variancePaise) >= MATERIAL_CASH_VARIANCE_PAISE;
