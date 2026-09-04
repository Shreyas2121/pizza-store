import type { PaymentCurrency, TransactionType } from "../../utils/types";

export const FINANCIAL_EVENT_TYPES = [
  "payment_attempt.captured",
  "payment_attempt.failed",
  "order.delivered",
  "order.recognition_reversed",
  "inventory.return_accepted",
  "refund.processed",
  "refund.failed",
  "refund.disbursed",
  "settlement.reconciled",
  "cash.movement_recorded",
  "cash.session_closed",
  "cash.session_reopened",
  "expense.posted",
  "expense.reversed",
  "pay_run.posted",
  "pay_run.reversed",
] as const;

export type FinancialEventType = (typeof FINANCIAL_EVENT_TYPES)[number];

export interface WriteFinancialEventInput {
  eventType: FinancialEventType;
  schemaVersion: number;
  sourceType: string;
  sourceId: number | string;
  sourceVersion: number;
  storeId: number;
  currency: PaymentCurrency;
  occurredAt: Date;
  businessDate: string;
  timezone: string;
  actorId?: number | null;
  correlationId?: string | null;
  causationId?: string | null;
  payload: Record<string, unknown>;
}

export interface FinancialEventWriter {
  write(tx: TransactionType, input: WriteFinancialEventInput): Promise<unknown>;
}
