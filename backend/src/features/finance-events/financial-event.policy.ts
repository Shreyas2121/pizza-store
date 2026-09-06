import { createHash } from "crypto";
import { AppError } from "../../utils/error";
import { FINANCIAL_EVENT_TYPES, type WriteFinancialEventInput } from "./financial-event.types";

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalize(item)]));
  }
  return value;
};

export const hashFinancialEvent = (input: WriteFinancialEventInput) => createHash("sha256")
  .update(JSON.stringify(canonicalize(input)))
  .digest("hex");

export const validateFinancialEvent = (input: WriteFinancialEventInput) => {
  const invalid = (message: string) => new AppError(message, 422, "INVALID_FINANCIAL_EVENT");
  if (!(FINANCIAL_EVENT_TYPES as readonly string[]).includes(input.eventType)) throw invalid("Financial event type is unsupported.");
  if (!Number.isInteger(input.schemaVersion) || input.schemaVersion <= 0 ||
      !Number.isInteger(input.sourceVersion) || input.sourceVersion <= 0) {
    throw invalid("Financial event versions must be positive integers.");
  }
  if (!String(input.sourceId).trim() || !input.sourceType.trim() || !input.timezone.trim()) {
    throw invalid("Financial event source and timezone are required.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.businessDate) || input.currency !== "INR" ||
      Number.isNaN(input.occurredAt.getTime())) {
    throw invalid("Financial event date, time, or currency is invalid.");
  }
  return input;
};

export const safeOutboxError = (cause: unknown) => {
  if (cause instanceof AppError) {
    const message = cause.message.replace(/[\r\n\t]+/g, " ").slice(0, 900);
    return `${cause.code ?? "FINANCIAL_POSTING_ERROR"}: ${message}`;
  }
  return "FINANCIAL_POSTING_ERROR: Financial event processing failed";
};
