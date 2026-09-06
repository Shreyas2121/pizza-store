import type { AuthPrincipal } from "../auth/auth.types";
import type { Permission } from "../access/access.permissions";
import { AppError } from "../../utils/error";
import { businessDateFor } from "../../utils/business-date";
import { env } from "../../utils/zodSchema";
import type { TransactionType } from "../../utils/types";
import authorizationService, { resourceNotFound } from "../access/access.service";
import auditService from "../audit/audit.service";
import financialEventService from "../finance-events/financial-event.service";
import type { FinancialEventWriter } from "../finance-events/financial-event.types";
import expenseRepository, { ExpenseRepository } from "./expense.repository";
import type { ExpenseCommandAction, ExpensesQueryInput, ExpenseWriteInput, PayExpenseInput, SourceMarginQueryInput, UpdateExpenseInput, VoidExpenseInput } from "./expense.schemas";
import { hashExpensePayload, requireExpenseStatus, segregationViolation } from "./expense.policy";

const uniqueViolation = (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === "23505";
const idempotencyConflict = () => new AppError("Idempotency-Key was already used with different expense data.", 409, "DUPLICATE_IDEMPOTENCY_KEY");

export class ExpenseService {
  constructor(private readonly repository: ExpenseRepository = expenseRepository, private readonly eventWriter: FinancialEventWriter = financialEventService) {}

  async list(actor: AuthPrincipal, query: ExpensesQueryInput) {
    await authorizationService.requireStorePermission({ principal: actor, storeId: query.storeId, permission: "finance.expenses.read" });
    return this.repository.list(query);
  }
  async get(actor: AuthPrincipal, id: number) {
    const detail = await this.repository.detail(id); if (!detail) throw resourceNotFound();
    await authorizationService.requireResourceStorePermission({ principal: actor, resourceStoreId: detail.expense.storeId, permission: "finance.expenses.read" });
    return detail;
  }
  async sourceMargin(actor: AuthPrincipal, query: SourceMarginQueryInput) {
    await authorizationService.requireStorePermission({ principal: actor, storeId: query.storeId, permission: "finance.expenses.read" });
    const source = await this.repository.sourceMargin(query);
    const grossProfitPaise = source.deliveredSalesPaise - source.cogsPaise;
    const operatingResultPaise = grossProfitPaise - source.operatingExpensesPaise;
    return { ...source, grossProfitPaise, grossMarginBps: source.deliveredSalesPaise === 0 ? null : Number(BigInt(grossProfitPaise) * 10_000n / BigInt(source.deliveredSalesPaise)), operatingResultPaise, costCoverageComplete: source.totalOrderLines === source.costedOrderLines, basis: "source_based_pre_ledger" as const };
  }

  async create(actor: AuthPrincipal, key: string, input: ExpenseWriteInput) {
    const payloadHash = hashExpensePayload(input);
    const existing = await this.repository.findByClientRequestId(key);
    if (existing) return this.requireCreateMatch(actor, existing, payloadHash);
    try {
      return await this.repository.transaction(async (tx) => {
        await authorizationService.requireStorePermission({ principal: actor, storeId: input.storeId, permission: "finance.expenses.create", tx, lockMembership: actor.platformRole !== "admin" });
        const refs = await this.prepareReferences(actor, input, tx);
        const expense = await this.repository.create(tx, input, { clientRequestId: key, payloadHash, actorId: actor.userId, ...refs });
        await auditService.write({ tx, actor, storeId: expense.storeId, action: "expense.created", resourceType: "expense", resourceId: expense.id, after: { status: expense.status, totalPaise: expense.totalPaise }, metadata: { allocationCount: refs.allocations.length } });
        return { expense, allocations: await this.repository.allocations(expense.id, tx) };
      });
    } catch (error) {
      if (!uniqueViolation(error)) throw error;
      const raced = await this.repository.findByClientRequestId(key);
      if (!raced) throw idempotencyConflict();
      return this.requireCreateMatch(actor, raced, payloadHash);
    }
  }

  async update(actor: AuthPrincipal, id: number, input: UpdateExpenseInput) {
    const identity = await this.repository.findExpense(id); if (!identity) throw resourceNotFound();
    return this.repository.transaction(async (tx) => {
      await authorizationService.requireResourceStorePermission({ principal: actor, resourceStoreId: identity.storeId, permission: "finance.expenses.create", tx, lockMembership: actor.platformRole !== "admin" });
      const expense = await this.repository.lockExpense(tx, id); if (!expense) throw resourceNotFound();
      requireExpenseStatus(expense.status, ["draft", "rejected"]);
      const refs = await this.prepareReferences(actor, { ...input, storeId: expense.storeId }, tx);
      const updated = await this.repository.update(tx, id, { vendorId: input.vendorId ?? null, vendorName: refs.vendorName, expenseDate: input.expenseDate, description: input.description, subtotalPaise: input.subtotalPaise, taxPaise: input.taxPaise, totalPaise: input.totalPaise, status: "draft", payloadHash: hashExpensePayload({ ...input, storeId: expense.storeId }), updatedBy: actor.userId, version: expense.version + 1 });
      await this.repository.replaceAllocations(tx, id, expense.storeId, refs.allocations);
      await auditService.write({ tx, actor, storeId: expense.storeId, action: "expense.updated", resourceType: "expense", resourceId: id, before: { status: expense.status, version: expense.version }, after: { status: updated.status, version: updated.version, totalPaise: updated.totalPaise } });
      return { expense: updated, allocations: await this.repository.allocations(id, tx) };
    });
  }

  submit(actor: AuthPrincipal, id: number, key: string) { return this.command(actor, id, "submit", key, {}, "finance.expenses.create", async (tx, expense) => { requireExpenseStatus(expense.status, ["draft"]); return this.change(tx, actor, expense, "submitted", { submittedBy: actor.userId, submittedAt: new Date() }); }); }
  approve(actor: AuthPrincipal, id: number, key: string) { return this.command(actor, id, "approve", key, {}, "finance.expenses.approve", async (tx, expense, auth) => { requireExpenseStatus(expense.status, ["submitted"]); if (expense.createdBy === actor.userId) throw segregationViolation("An expense creator cannot approve their own expense."); if (auth.membershipRole === "manager" && expense.totalPaise > env.EXPENSE_MANAGER_APPROVAL_LIMIT_PAISE) throw new AppError("Expense exceeds the manager approval threshold.", 403, "EXPENSE_APPROVAL_LIMIT_EXCEEDED"); return this.change(tx, actor, expense, "approved", { approvedBy: actor.userId, approvedAt: new Date() }); }); }
  reject(actor: AuthPrincipal, id: number, key: string, reason: string) { return this.command(actor, id, "reject", key, { reason }, "finance.expenses.approve", async (tx, expense) => { requireExpenseStatus(expense.status, ["submitted"]); if (expense.createdBy === actor.userId) throw segregationViolation("An expense creator cannot reject their own expense."); return this.change(tx, actor, expense, "rejected", { rejectedBy: actor.userId, rejectedAt: new Date(), rejectionReason: reason }, { reason }); }); }

  pay(actor: AuthPrincipal, id: number, key: string, input: PayExpenseInput) {
    return this.command(actor, id, "pay", key, input, "finance.expenses.pay", async (tx, expense) => {
      requireExpenseStatus(expense.status, ["approved"]);
      const conflict = expense.createdBy === actor.userId || expense.approvedBy === actor.userId;
      if (conflict && (actor.platformRole !== "admin" || !input.segregationOverrideReason)) throw segregationViolation("The expense creator or approver cannot pay it without an audited platform-admin override.");
      const now = new Date();
      const updated = await this.change(tx, actor, expense, "paid", { paymentMethod: input.paymentMethod, paymentReference: input.paymentReference ?? null, paidBy: actor.userId, paidAt: now }, conflict ? { segregationOverrideReason: input.segregationOverrideReason } : undefined);
      await this.event(tx, actor, updated, "expense.paid", now, { paymentMethod: updated.paymentMethod, paymentReference: updated.paymentReference });
      return updated;
    });
  }

  post(actor: AuthPrincipal, id: number, key: string) {
    return this.command(actor, id, "post", key, {}, "finance.expenses.pay", async (tx, expense) => {
      requireExpenseStatus(expense.status, ["paid"]);
      const allocations = await this.repository.allocations(id, tx);
      if (allocations.some((item) => item.ledgerAccountId == null)) throw new AppError("Every allocation requires a ledger account mapping before posting.", 409, "EXPENSE_LEDGER_MAPPING_REQUIRED");
      const accountIds = [...new Set(allocations.map((item) => item.ledgerAccountId!))];
      const accounts = await this.repository.ledgerAccounts(accountIds, tx);
      const accountCodeById = new Map(accounts.filter((account) => account.isActive).map((account) => [account.id, account.code]));
      if (accountCodeById.size !== accountIds.length) throw new AppError("Every allocation requires an active ledger account mapping before posting.", 409, "EXPENSE_LEDGER_MAPPING_REQUIRED");
      const now = new Date(); const updated = await this.change(tx, actor, expense, "posted", { postedBy: actor.userId, postedAt: now });
      await this.event(tx, actor, updated, "expense.posted", now, { allocations: allocations.map((item) => ({ storeId: item.storeId, categoryId: item.categoryId, categoryName: item.categoryName, classification: item.categoryClassification, ledgerAccountId: item.ledgerAccountId, ledgerAccountCode: accountCodeById.get(item.ledgerAccountId!), costCenter: item.costCenter, amountPaise: item.amountPaise })) });
      return updated;
    });
  }

  void(actor: AuthPrincipal, id: number, key: string, input: VoidExpenseInput) {
    return this.command(actor, id, "void", key, input, "finance.expenses.approve", async (tx, expense) => {
      requireExpenseStatus(expense.status, ["draft", "submitted", "approved", "paid", "rejected"]);
      if (expense.status === "paid" && (input.paymentReversed !== true || !input.reversalReference)) throw new AppError("Paid expenses require payment reversal evidence before voiding.", 422, "EXPENSE_PAYMENT_REVERSAL_REQUIRED");
      const now = new Date(); const updated = await this.change(tx, actor, expense, "voided", { voidedBy: actor.userId, voidedAt: now, voidReason: input.reason }, { paymentReversed: input.paymentReversed ?? false, reversalReference: input.reversalReference });
      await this.event(tx, actor, updated, "expense.voided", now, { priorStatus: expense.status, reason: input.reason, paymentReversed: input.paymentReversed ?? false, reversalReference: input.reversalReference ?? null });
      return updated;
    });
  }

  reverse(actor: AuthPrincipal, id: number, key: string, reason: string) {
    return this.command(actor, id, "reverse", key, { reason }, "finance.expenses.pay", async (tx, expense) => {
      requireExpenseStatus(expense.status, ["posted"]); const now = new Date();
      const updated = await this.change(tx, actor, expense, "reversed", { reversedBy: actor.userId, reversedAt: now, reversalReason: reason }, { reason });
      await this.event(tx, actor, updated, "expense.reversed", now, { originalPostingSourceKey: `expense:${expense.id}:expense.posted:${expense.version}`, originalPostingSource: { sourceType: "expense", sourceId: expense.id, eventType: "expense.posted", sourceVersion: expense.version }, reason, authorizedActorId: actor.userId, effectiveBusinessDate: expense.expenseDate }); return updated;
    });
  }

  private async command(actor: AuthPrincipal, id: number, action: ExpenseCommandAction, key: string, payload: unknown, permission: Permission, work: (tx: TransactionType, expense: NonNullable<Awaited<ReturnType<ExpenseRepository["findExpense"]>>>, auth: Awaited<ReturnType<typeof authorizationService.requireResourceStorePermission>>) => Promise<NonNullable<Awaited<ReturnType<ExpenseRepository["findExpense"]>>>>) {
    const payloadHash = hashExpensePayload({ action, payload });
    const prior = await this.repository.command(key); if (prior) return this.requireCommandMatch(actor, prior, id, action, payloadHash, permission);
    const identity = await this.repository.findExpense(id); if (!identity) throw resourceNotFound();
    try {
      return await this.repository.transaction(async (tx) => {
        const auth = await authorizationService.requireResourceStorePermission({ principal: actor, resourceStoreId: identity.storeId, permission, tx, lockMembership: actor.platformRole !== "admin" });
        const raced = await this.repository.command(key, tx); if (raced) return this.requireCommandMatch(actor, raced, id, action, payloadHash, permission, tx);
        const expense = await this.repository.lockExpense(tx, id); if (!expense) throw resourceNotFound();
        if (expense.version !== identity.version) throw new AppError("Expense changed while this command was being prepared.", 409, "CONCURRENT_EXPENSE_MODIFICATION");
        const updated = await work(tx, expense, auth);
        await this.repository.recordCommand(tx, { expenseId: id, action, idempotencyKey: key, payloadHash, resultVersion: updated.version, actorId: actor.userId });
        return { expense: updated, allocations: await this.repository.allocations(id, tx) };
      });
    } catch (error) {
      if (!uniqueViolation(error)) throw error;
      const raced = await this.repository.command(key); if (!raced) throw idempotencyConflict();
      return this.requireCommandMatch(actor, raced, id, action, payloadHash, permission);
    }
  }

  private async change(tx: TransactionType, actor: AuthPrincipal, expense: NonNullable<Awaited<ReturnType<ExpenseRepository["findExpense"]>>>, status: typeof expense.status, values: Partial<typeof expense>, metadata?: Record<string, unknown>) {
    const updated = await this.repository.update(tx, expense.id, { ...values, status, updatedBy: actor.userId, version: expense.version + 1 });
    await auditService.write({ tx, actor, storeId: expense.storeId, action: `expense.${status}` as "expense.submitted", resourceType: "expense", resourceId: expense.id, before: { status: expense.status, version: expense.version }, after: { status, version: updated.version }, metadata });
    return updated;
  }

  private async event(tx: TransactionType, actor: AuthPrincipal, expense: NonNullable<Awaited<ReturnType<ExpenseRepository["findExpense"]>>>, eventType: "expense.paid" | "expense.posted" | "expense.voided" | "expense.reversed", now: Date, extra: Record<string, unknown>) {
    const store = await this.repository.findStore(expense.storeId, tx); if (!store) throw resourceNotFound();
    const allocations = await this.repository.allocations(expense.id, tx);
    await this.eventWriter.write(tx, { eventType, schemaVersion: 1, sourceType: "expense", sourceId: expense.id, sourceVersion: expense.version, storeId: expense.storeId, currency: "INR", occurredAt: now, businessDate: expense.expenseDate || businessDateFor(now, store.timezone), timezone: store.timezone, actorId: actor.userId, payload: { expenseId: expense.id, vendorId: expense.vendorId, vendorName: expense.vendorName, description: expense.description, subtotalPaise: expense.subtotalPaise, taxPaise: expense.taxPaise, totalPaise: expense.totalPaise, paymentMethod: expense.paymentMethod, paymentReference: expense.paymentReference, paidAt: expense.paidAt?.toISOString() ?? null, postedAt: expense.postedAt?.toISOString() ?? null, allocations: allocations.map((item) => ({ storeId: item.storeId, categoryId: item.categoryId, categoryName: item.categoryName, classification: item.categoryClassification, ledgerAccountId: item.ledgerAccountId, costCenter: item.costCenter, amountPaise: item.amountPaise })), ...extra } });
  }

  private async prepareReferences(actor: AuthPrincipal, input: ExpenseWriteInput, tx: TransactionType) {
    const store = await this.repository.findStore(input.storeId, tx); if (!store) throw resourceNotFound();
    const vendor = input.vendorId ? await this.repository.findVendor(input.vendorId, tx) : undefined;
    if (input.vendorId && (!vendor || !vendor.isActive || (vendor.storeId != null && vendor.storeId !== input.storeId))) throw new AppError("Vendor is inactive or outside the expense store scope.", 422, "INVALID_EXPENSE_VENDOR");
    const allocations = [];
    for (const item of input.allocations) {
      if (item.storeId !== input.storeId && actor.platformRole !== "admin") throw new AppError("Cross-store allocations require platform-admin access.", 403, "CROSS_STORE_ALLOCATION_REQUIRES_OWNER");
      if (!await this.repository.findStore(item.storeId, tx)) throw new AppError("Allocation store does not exist.", 422, "INVALID_EXPENSE_ALLOCATION_STORE");
      const category = await this.repository.findCategory(item.categoryId, tx);
      if (!category || !category.isActive || (category.storeId != null && category.storeId !== item.storeId)) throw new AppError("Allocation category is inactive or outside its store scope.", 422, "INVALID_EXPENSE_CATEGORY");
      allocations.push({ storeId: item.storeId, categoryId: item.categoryId, categoryName: category.name, categoryClassification: category.classification, ledgerAccountId: category.ledgerAccountId, costCenter: item.costCenter ?? null, amountPaise: item.amountPaise });
    }
    return { vendorName: vendor?.name ?? null, allocations };
  }

  private async requireCreateMatch(actor: AuthPrincipal, detail: NonNullable<Awaited<ReturnType<ExpenseRepository["findByClientRequestId"]>>>, hash: string) { await authorizationService.requireResourceStorePermission({ principal: actor, resourceStoreId: detail.expense.storeId, permission: "finance.expenses.create" }); if (detail.expense.payloadHash !== hash) throw idempotencyConflict(); return detail; }
  private async requireCommandMatch(actor: AuthPrincipal, command: NonNullable<Awaited<ReturnType<ExpenseRepository["command"]>>>, id: number, action: ExpenseCommandAction, hash: string, permission: Permission, tx?: TransactionType) { const detail = await this.repository.detail(command.expenseId, tx); if (!detail) throw resourceNotFound(); await authorizationService.requireResourceStorePermission({ principal: actor, resourceStoreId: detail.expense.storeId, permission, tx }); if (command.expenseId !== id || command.action !== action || command.payloadHash !== hash) throw idempotencyConflict(); return detail; }
}

export default new ExpenseService();
