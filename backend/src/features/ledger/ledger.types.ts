export type LedgerSide = "debit" | "credit";
export type JournalKind = "source" | "manual";

export interface PostingLineDimensions {
  orderId?: number;
  paymentAttemptId?: number;
  refundId?: number;
  expenseId?: number;
  payRunId?: number;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface PostingLine extends PostingLineDimensions {
  accountCode: string;
  side: LedgerSide;
  amountPaise: number;
  description?: string;
}

export interface PostingSourceIdentity {
  sourceType: string;
  sourceId: string | number;
  eventType: string;
  sourceVersion: number;
}

export interface PostingCommand {
  kind: JournalKind;
  storeId: number;
  currency: "INR";
  businessDate: string;
  occurredAt: Date;
  description: string;
  postedBy?: number | null;
  source: PostingSourceIdentity;
  lines: readonly PostingLine[];
}

export interface ReversalCommand {
  journalEntryId: number;
  storeId: number;
  businessDate: string;
  occurredAt: Date;
  reason: string;
  actorId: number;
  correlationId: string;
  source?: PostingSourceIdentity;
}

export const debit = (
  accountCode: string,
  amountPaise: number,
  details: Omit<PostingLine, "accountCode" | "side" | "amountPaise"> = {}
): PostingLine => ({ accountCode, side: "debit", amountPaise, ...details });

export const credit = (
  accountCode: string,
  amountPaise: number,
  details: Omit<PostingLine, "accountCode" | "side" | "amountPaise"> = {}
): PostingLine => ({ accountCode, side: "credit", amountPaise, ...details });
