import { AppError } from "../../utils/error";
import type { TransactionType } from "../../utils/types";
import ledgerRepository, { LedgerRepository } from "./ledger.repository";
import { assertPeriodAllowsPosting, hashPostingCommand, validatePostingCommand } from "./ledger.policy";
import { credit, debit, type PostingCommand, type ReversalCommand } from "./ledger.types";

export class LedgerService {
  constructor(private readonly repository: LedgerRepository = ledgerRepository) {}

  post(command: PostingCommand) {
    validatePostingCommand(command);
    const commandHash = hashPostingCommand(command);
    return this.repository.transaction((tx) => this.postInTransaction(tx, command, commandHash));
  }

  reverse(input: ReversalCommand) {
    const reversalDate = new Date(`${input.businessDate}T00:00:00.000Z`);
    if (!Number.isInteger(input.journalEntryId) || input.journalEntryId <= 0 ||
        !Number.isInteger(input.storeId) || input.storeId <= 0 ||
        !Number.isInteger(input.actorId) || input.actorId <= 0 ||
        !input.reason.trim() || !input.correlationId.trim() ||
        !/^\d{4}-\d{2}-\d{2}$/.test(input.businessDate) ||
        Number.isNaN(reversalDate.getTime()) || reversalDate.toISOString().slice(0, 10) !== input.businessDate ||
        Number.isNaN(input.occurredAt.getTime())) {
      throw new AppError("Journal reversal input is invalid.", 422, "INVALID_JOURNAL_REVERSAL");
    }

    const source = input.source ?? {
      sourceType: "journal_entry",
      sourceId: String(input.journalEntryId),
      eventType: "journal.reversed",
      sourceVersion: 1,
    } as const;

    return this.repository.transaction(async (tx) => {
      const existing = await this.repository.findBySource(tx, source);
      if (existing) {
        const dimensions = existing.lines[0]?.dimensions as Record<string, unknown> | undefined;
        if (existing.storeId !== input.storeId || existing.businessDate !== input.businessDate ||
            existing.occurredAt.getTime() !== input.occurredAt.getTime() ||
            existing.postedBy !== input.actorId || existing.reversalReason !== input.reason.trim() ||
            dimensions?.correlationId !== input.correlationId) {
          throw new AppError("Journal reversal conflicts with the existing reversal.", 409, "JOURNAL_SOURCE_CONFLICT");
        }
        return existing;
      }

      const periods = await this.repository.findPeriodForUpdate(tx, input.storeId, input.businessDate);
      if (periods.length > 1) throw new AppError("Overlapping fiscal periods contain the journal date.", 409, "FISCAL_PERIOD_OVERLAP");
      assertPeriodAllowsPosting(periods[0], "source");

      const original = await this.repository.findEntryForUpdate(tx, input.journalEntryId, input.storeId);
      if (!original) throw new AppError("Journal entry was not found.", 404, "JOURNAL_NOT_FOUND");
      if (original.status !== "posted" || original.reversalOfJournalEntryId !== null) {
        throw new AppError("Only an unreversed original posted journal can be reversed.", 409, "JOURNAL_NOT_REVERSIBLE");
      }
      if (original.lines.length < 2) throw new AppError("Posted journal has invalid lines.", 409, "JOURNAL_CORRUPT");

      const command: PostingCommand = {
        kind: "source",
        storeId: input.storeId,
        currency: "INR",
        businessDate: input.businessDate,
        occurredAt: input.occurredAt,
        description: `Reversal of ${original.journalNumber}: ${input.reason.trim()}`,
        postedBy: input.actorId,
        source,
        lines: original.lines.map((line) => {
          const details = {
            description: line.description ?? undefined,
            orderId: line.orderId ?? undefined,
            paymentAttemptId: line.paymentAttemptId ?? undefined,
            refundId: line.refundId ?? undefined,
            expenseId: line.expenseId ?? undefined,
            payRunId: line.payRunId ?? undefined,
            metadata: {
              ...(line.dimensions as Record<string, string | number | boolean | null>),
              reversalOfJournalEntryId: original.id,
              correlationId: input.correlationId,
              originalBusinessDate: original.businessDate,
            },
          };
          return line.debitPaise > 0
            ? credit(line.account.code, line.debitPaise, details)
            : debit(line.account.code, line.creditPaise, details);
        }),
      };
      validatePostingCommand(command);
      const hash = hashPostingCommand(command);
      const accounts = new Map(original.lines.map((line) => [line.account.code, line.account]));
      const reversal = await this.repository.createPosted(
        tx, command, hash, accounts, original.id, input.reason.trim()
      );
      await this.repository.markReversed(tx, original.id, input.occurredAt);
      return reversal;
    });
  }

  async reverseSource(
    originalSource: PostingCommand["source"],
    input: Omit<ReversalCommand, "journalEntryId">
  ) {
    const original = await this.repository.transaction((tx) => this.repository.findBySource(tx, originalSource));
    if (!original) throw new AppError("Original source journal was not found.", 404, "JOURNAL_NOT_FOUND");
    return this.reverse({ ...input, journalEntryId: original.id });
  }

  private async postInTransaction(tx: TransactionType, command: PostingCommand, commandHash: string) {
    const existing = await this.repository.findBySource(tx, command.source);
    if (existing) {
      if (existing.commandHash !== commandHash) {
        throw new AppError("Journal source version conflicts with existing content.", 409, "JOURNAL_SOURCE_CONFLICT");
      }
      return existing;
    }

    const periods = await this.repository.findPeriodForUpdate(tx, command.storeId, command.businessDate);
    if (periods.length > 1) throw new AppError("Overlapping fiscal periods contain the journal date.", 409, "FISCAL_PERIOD_OVERLAP");
    assertPeriodAllowsPosting(periods[0], command.kind);

    const codes = [...new Set(command.lines.map((line) => line.accountCode))];
    const rows = await this.repository.findAccounts(tx, codes);
    const accounts = new Map(rows.map((account) => [account.code, account]));
    const unavailable = codes.filter((code) => !accounts.get(code)?.isActive);
    if (unavailable.length) {
      throw new AppError("Journal references a missing or inactive ledger account.", 409, "LEDGER_ACCOUNT_UNAVAILABLE", {
        accountCodes: unavailable,
      });
    }
    return this.repository.createPosted(tx, command, commandHash, accounts);
  }
}

export default new LedgerService();
