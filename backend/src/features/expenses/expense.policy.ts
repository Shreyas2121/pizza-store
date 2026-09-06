import { createHash } from "crypto";
import type { ExpenseStatus } from "../../utils/types";
import { AppError } from "../../utils/error";

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonicalize(item)]));
  return value;
};
export const hashExpensePayload = (value: unknown) => createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
export const requireExpenseStatus = (actual: ExpenseStatus, allowed: ExpenseStatus[]) => {
  if (!allowed.includes(actual)) throw new AppError(`Expense cannot transition from ${actual}.`, 409, "INVALID_STATE_TRANSITION", { actual, allowed });
};
export const segregationViolation = (message = "The actor conflicts with expense segregation-of-duties policy.") => new AppError(message, 403, "SEGREGATION_OF_DUTIES_VIOLATION");
