import { createHash } from "crypto";
import { AppError } from "../../utils/error";
import type { SettlementImportBatch } from "./settlement.fixtures";

const invalid = (message: string) =>
  new AppError(message, 422, "INVALID_SETTLEMENT_IMPORT");

const checkedSum = (values: number[]) => {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!Number.isSafeInteger(total)) throw invalid("Settlement totals exceed safe integer range.");
  return total;
};

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)])
    );
  }
  return value;
};

export const hashSettlementPayload = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");

export const validateSettlementImport = (batch: SettlementImportBatch) => {
  if (!Number.isSafeInteger(batch.storeId) || batch.storeId <= 0 ||
      !batch.providerSettlementId.trim() || !batch.providerStatus.trim()) {
    throw invalid("Settlement identity is invalid.");
  }
  const money = [
    batch.grossAmountPaise,
    batch.feePaise,
    batch.feeTaxPaise,
    batch.adjustmentPaise,
    batch.netAmountPaise,
    ...batch.lines.flatMap((line) => [line.amountPaise, line.feePaise, line.feeTaxPaise]),
  ];
  if (money.some((value) => !Number.isSafeInteger(value))) throw invalid("Settlement money must use integer paise.");
  if (batch.grossAmountPaise < 0 || batch.feePaise < 0 || batch.feeTaxPaise < 0 || batch.netAmountPaise < 0) {
    throw invalid("Settlement aggregate amounts cannot be negative.");
  }
  if (batch.netAmountPaise !== batch.grossAmountPaise - batch.feePaise - batch.feeTaxPaise + batch.adjustmentPaise) {
    throw invalid("Settlement aggregate does not reconcile to net amount.");
  }
  if (batch.currency !== "INR" || batch.lines.some((line) => line.currency !== "INR")) {
    throw invalid("Settlement currency must be INR.");
  }
  const periodFrom = new Date(batch.periodFrom);
  const periodTo = new Date(batch.periodTo);
  const settledAt = new Date(batch.settledAt);
  if ([periodFrom, periodTo, settledAt].some((value) => Number.isNaN(value.getTime())) || periodTo < periodFrom) {
    throw invalid("Settlement period or settled timestamp is invalid.");
  }
  const ids = batch.lines.map((line) => line.providerLineId);
  if (new Set(ids).size !== ids.length) throw invalid("Settlement provider line IDs must be unique.");
  for (const line of batch.lines) {
    if (![line.providerLineId, line.providerTransactionId, line.providerEntityId, line.providerStatus]
      .every((value) => value.trim().length > 0)) {
      throw invalid("Settlement line identity is invalid.");
    }
    if (!Number.isSafeInteger(line.amountPaise) || line.amountPaise === 0 || line.feePaise < 0 || line.feeTaxPaise < 0) {
      throw invalid("Settlement line amounts are invalid.");
    }
    if (line.type === "payment" && line.amountPaise < 0) throw invalid("Payment settlement lines must be positive.");
    if (line.type === "refund" && line.amountPaise > 0) throw invalid("Refund settlement lines must be negative.");
    const occurredAt = new Date(line.occurredAt);
    if (Number.isNaN(occurredAt.getTime()) || occurredAt < periodFrom || occurredAt > periodTo) {
      throw invalid("Settlement line falls outside the batch period.");
    }
  }
  if (batch.lines.length > 0) {
    const gross = checkedSum(batch.lines.filter((line) => line.type === "payment").map((line) => line.amountPaise));
    const adjustment = checkedSum(batch.lines.filter((line) => line.type !== "payment").map((line) => line.amountPaise));
    const fee = checkedSum(batch.lines.map((line) => line.feePaise));
    const feeTax = checkedSum(batch.lines.map((line) => line.feeTaxPaise));
    if (gross !== batch.grossAmountPaise || adjustment !== batch.adjustmentPaise ||
        fee !== batch.feePaise || feeTax !== batch.feeTaxPaise) {
      throw invalid("Settlement lines do not reconcile to batch totals.");
    }
  }
  return batch;
};
