import { createHash } from "crypto";
import { AppError } from "../../utils/error";
import type { PostingCommand, PostingLine } from "./ledger.types";

const MAX_PAISE = 2_147_483_647;

const canonicalize = (value: unknown): unknown => {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalize(item)]));
  }
  return value;
};

export const hashPostingCommand = (command: PostingCommand) => createHash("sha256")
  .update(JSON.stringify(canonicalize(command)))
  .digest("hex");

const invalid = (message: string, code = "INVALID_JOURNAL") => new AppError(message, 422, code);

const validateLine = (line: PostingLine) => {
  if (!/^\d{4,10}$/.test(line.accountCode)) throw invalid("Journal line account code is invalid.", "JOURNAL_ACCOUNT_INVALID");
  if (line.side !== "debit" && line.side !== "credit") throw invalid("Journal line side is invalid.", "JOURNAL_SIDE_INVALID");
  if (!Number.isSafeInteger(line.amountPaise) || line.amountPaise <= 0 || line.amountPaise > MAX_PAISE) {
    throw invalid("Journal line amount must be positive integer paise within the database limit.", "JOURNAL_AMOUNT_INVALID");
  }
  if (line.description !== undefined && (!line.description.trim() || line.description.length > 500)) {
    throw invalid("Journal line description is invalid.");
  }
};

export const validatePostingCommand = (command: PostingCommand) => {
  if (!Number.isInteger(command.storeId) || command.storeId <= 0 || command.currency !== "INR") {
    throw invalid("Journal store or currency is invalid.");
  }
  const parsedBusinessDate = new Date(`${command.businessDate}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(command.businessDate) ||
      Number.isNaN(parsedBusinessDate.getTime()) ||
      parsedBusinessDate.toISOString().slice(0, 10) !== command.businessDate ||
      Number.isNaN(command.occurredAt.getTime())) {
    throw invalid("Journal business date or occurrence time is invalid.");
  }
  if (!command.description.trim() || command.description.length > 500) throw invalid("Journal description is required.");
  if (command.kind === "manual" && (!Number.isInteger(command.postedBy) || (command.postedBy ?? 0) <= 0)) {
    throw invalid("Manual journals require a posting actor.", "JOURNAL_ACTOR_REQUIRED");
  }
  if (!command.source.sourceType.trim() || !String(command.source.sourceId).trim() ||
      !command.source.eventType.trim() || !Number.isInteger(command.source.sourceVersion) || command.source.sourceVersion <= 0) {
    throw invalid("Journal source identity is invalid.");
  }
  if (command.lines.length < 2) throw invalid("A journal requires at least two lines.", "JOURNAL_EMPTY");

  let debits = 0;
  let credits = 0;
  for (const line of command.lines) {
    validateLine(line);
    if (line.side === "debit") debits += line.amountPaise;
    else credits += line.amountPaise;
    if (!Number.isSafeInteger(debits) || !Number.isSafeInteger(credits)) throw invalid("Journal total exceeds the safe integer limit.", "JOURNAL_TOTAL_OVERFLOW");
  }
  if (debits !== credits) throw invalid("Journal debits and credits must balance.", "JOURNAL_UNBALANCED");
  return { debitsPaise: debits, creditsPaise: credits };
};

export const assertPeriodAllowsPosting = (
  period: { status: "open" | "soft_closed" | "closed" } | undefined,
  kind: PostingCommand["kind"]
) => {
  if (!period) throw new AppError("No fiscal period contains the journal business date.", 409, "FISCAL_PERIOD_NOT_FOUND");
  if (period.status === "closed" || (period.status === "soft_closed" && kind === "manual")) {
    throw new AppError("Fiscal period does not permit this posting.", 400, "PERIOD_CLOSED");
  }
};
