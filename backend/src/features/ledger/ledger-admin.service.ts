import type { AuthPrincipal } from "../auth/auth.types";
import { AppError } from "../../utils/error";
import authorizationService from "../access/access.service";
import auditService from "../audit/audit.service";
import ledgerService, { LedgerService } from "./ledger.service";
import ledgerAdminRepository, { LedgerAdminRepository } from "./ledger-admin.repository";
import type { CreateFiscalPeriodInput, JournalsQuery, ManualJournalInput, ReverseJournalInput, TrialBalanceQuery } from "./ledger.schemas";

const RECENT_AUTH_MS = 15 * 60_000;
const periodConflict = (message: string) => new AppError(message, 409, "FISCAL_PERIOD_CONFLICT");

export const requireRecentOwner = (actor: AuthPrincipal, now = new Date()) => {
  authorizationService.requirePlatformAdmin(actor);
  if (!actor.authenticatedAt || now.getTime() - actor.authenticatedAt.getTime() > RECENT_AUTH_MS || actor.authenticatedAt.getTime() > now.getTime() + 60_000) {
    throw new AppError("Recent authentication is required for this ledger action.", 401, "RECENT_AUTHENTICATION_REQUIRED");
  }
};

export class LedgerAdminService {
  constructor(private readonly repository: LedgerAdminRepository = ledgerAdminRepository, private readonly ledger: LedgerService = ledgerService) {}

  async accounts(actor: AuthPrincipal, storeId: number) {
    await authorizationService.requireStorePermission({ principal: actor, storeId, permission: "finance.ledger.read" });
    return this.repository.listAccounts();
  }

  async journals(actor: AuthPrincipal, query: JournalsQuery) {
    if (query.storeId === undefined) authorizationService.requirePlatformAdmin(actor);
    else await authorizationService.requireStorePermission({ principal: actor, storeId: query.storeId, permission: "finance.ledger.read" });
    return this.repository.listJournals(query);
  }

  async journal(actor: AuthPrincipal, journalId: number) {
    const result = await this.repository.journalDetail(journalId);
    if (!result) throw new AppError("Resource not found.", 404, "RESOURCE_NOT_FOUND");
    await authorizationService.requireResourceStorePermission({ principal: actor, resourceStoreId: result.storeId, permission: "finance.ledger.read" });
    return result;
  }

  async trialBalance(actor: AuthPrincipal, query: TrialBalanceQuery) {
    await authorizationService.requireStorePermission({ principal: actor, storeId: query.storeId, permission: "finance.ledger.read" });
    const rows = await this.repository.trialBalance(query);
    let totalDebit = 0n;
    let totalCredit = 0n;
    const accounts = rows.map((row) => {
      const debit = BigInt(row.debitPaise);
      const credit = BigInt(row.creditPaise);
      totalDebit += debit;
      totalCredit += credit;
      return { ...row, debitPaise: debit.toString(), creditPaise: credit.toString(), netDebitPaise: (debit - credit).toString() };
    });
    return { accounts, totals: { debitPaise: totalDebit.toString(), creditPaise: totalCredit.toString(), differencePaise: (totalDebit - totalCredit).toString() }, policy: { currency: "INR" as const, basis: "posted_journals" as const, from: query.from ?? null, to: query.to ?? null, balanced: totalDebit === totalCredit } };
  }

  async periods(actor: AuthPrincipal, storeId: number) {
    await authorizationService.requireStorePermission({ principal: actor, storeId, permission: "finance.ledger.read" });
    return this.repository.listPeriods(storeId);
  }

  async openPeriod(actor: AuthPrincipal, input: CreateFiscalPeriodInput, now = new Date()) {
    requireRecentOwner(actor, now);
    return this.repository.transaction(async (tx) => {
      if ((await this.repository.overlappingPeriods(tx, input.storeId, input.startDate, input.endDate)).length) throw periodConflict("Fiscal period overlaps an existing store period.");
      const period = await this.repository.createPeriod(tx, input);
      await auditService.write({ tx, actor, storeId: input.storeId, action: "ledger.period_opened", resourceType: "fiscal_period", resourceId: period.id, after: { status: period.status, name: period.name, startDate: period.startDate, endDate: period.endDate }, metadata: { reason: input.reason } });
      return period;
    });
  }

  softClosePeriod(actor: AuthPrincipal, id: number, reason: string, now = new Date()) { return this.transitionPeriod(actor, id, "soft_closed", reason, now); }
  closePeriod(actor: AuthPrincipal, id: number, reason: string, now = new Date()) { return this.transitionPeriod(actor, id, "closed", reason, now); }
  reopenPeriod(actor: AuthPrincipal, id: number, reason: string, now = new Date()) { return this.transitionPeriod(actor, id, "open", reason, now); }

  private async transitionPeriod(actor: AuthPrincipal, id: number, target: "open" | "soft_closed" | "closed", reason: string, now: Date) {
    requireRecentOwner(actor, now);
    const identity = await this.repository.findPeriod(id);
    if (!identity) throw new AppError("Resource not found.", 404, "RESOURCE_NOT_FOUND");
    return this.repository.transaction(async (tx) => {
      const period = await this.repository.lockPeriod(tx, id);
      if (!period || period.storeId !== identity.storeId) throw new AppError("Resource not found.", 404, "RESOURCE_NOT_FOUND");
      const valid = (period.status === "open" && target === "soft_closed") || (period.status === "soft_closed" && target === "closed") || (period.status === "closed" && target === "open");
      if (!valid) throw periodConflict(`Fiscal period cannot transition from ${period.status} to ${target}.`);
      const values = target === "soft_closed"
        ? { status: target, softClosedBy: actor.userId, softClosedAt: now }
        : target === "closed"
          ? { status: target, closedBy: actor.userId, closedAt: now }
          : { status: target, softClosedBy: null, softClosedAt: null, closedBy: null, closedAt: null };
      const updated = await this.repository.updatePeriod(tx, id, values);
      const action = target === "soft_closed" ? "ledger.period_soft_closed" : target === "closed" ? "ledger.period_closed" : "ledger.period_reopened";
      await auditService.write({ tx, actor, storeId: period.storeId, action, resourceType: "fiscal_period", resourceId: id, before: { status: period.status }, after: { status: updated.status }, metadata: { reason, authenticatedAt: actor.authenticatedAt!.toISOString() } });
      return updated;
    });
  }

  async postManual(actor: AuthPrincipal, idempotencyKey: string, input: ManualJournalInput, now = new Date()) {
    if (input.softCloseOverrideReason) requireRecentOwner(actor, now);
    return this.repository.transaction(async (tx) => {
      await authorizationService.requireStorePermission({ principal: actor, storeId: input.storeId, permission: "finance.ledger.post", tx, lockMembership: actor.platformRole !== "admin" });
      const entry = await this.ledger.postWithin(tx, { kind: "manual", storeId: input.storeId, currency: "INR", businessDate: input.businessDate, occurredAt: now, description: input.description, postedBy: actor.userId, source: { sourceType: "manual_journal", sourceId: idempotencyKey, eventType: "manual_journal.posted", sourceVersion: 1 }, softCloseOverride: input.softCloseOverrideReason ? { reason: input.softCloseOverrideReason } : undefined, lines: input.lines });
      await auditService.write({ tx, actor, storeId: input.storeId, action: "ledger.manual_journal_posted", resourceType: "journal_entry", resourceId: entry.id, after: { journalNumber: entry.journalNumber, businessDate: entry.businessDate }, metadata: { idempotencyKey, softCloseOverrideReason: input.softCloseOverrideReason } });
      return entry;
    });
  }

  async reverseJournal(actor: AuthPrincipal, journalId: number, input: ReverseJournalInput, now = new Date()) {
    const original = await this.repository.journalDetail(journalId);
    if (!original) throw new AppError("Resource not found.", 404, "RESOURCE_NOT_FOUND");
    return this.repository.transaction(async (tx) => {
      await authorizationService.requireResourceStorePermission({ principal: actor, resourceStoreId: original.storeId, permission: "finance.ledger.post", tx });
      const entry = await this.ledger.reverseWithin(tx, { journalEntryId: journalId, storeId: original.storeId, businessDate: input.businessDate, occurredAt: now, reason: input.reason, actorId: actor.userId, correlationId: `manual-reversal:${journalId}` });
      await auditService.write({ tx, actor, storeId: original.storeId, action: "ledger.journal_reversed", resourceType: "journal_entry", resourceId: entry.id, before: { journalId, status: original.status }, after: { reversalJournalId: entry.id }, metadata: { reason: input.reason, effectiveBusinessDate: input.businessDate } });
      return entry;
    });
  }
}

export default new LedgerAdminService();
