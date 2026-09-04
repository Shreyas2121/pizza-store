import type { AuthPrincipal } from "../auth/auth.types";
import { AppError } from "../../utils/error";
import { businessDateFor } from "../../utils/business-date";
import type { SettlementBatchStatus } from "../../utils/types";
import authorizationService, { resourceNotFound } from "../access/access.service";
import auditService from "../audit/audit.service";
import { findSettlementFixture, type SettlementImportBatch } from "./settlement.fixtures";
import { hashSettlementPayload, validateSettlementImport } from "./settlement.policy";
import { createTestSettlementProvider, type SettlementProvider } from "./settlement.provider";
import settlementRepository, { SettlementRepository } from "./settlement.repository";
import { matchSettlement } from "./settlement-matching";
import type {
  ImportSettlementInput,
  ReconciliationIssuesQuery,
  ResolveReconciliationIssueInput,
} from "./settlement.schemas";
import financialEventService from "../finance-events/financial-event.service";
import type { FinancialEventWriter } from "../finance-events/financial-event.types";

const importConflict = () => new AppError(
  "Provider settlement ID was already imported with different content.",
  409,
  "SETTLEMENT_IMPORT_CONFLICT"
);

const isUniqueViolation = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error && error.code === "23505";

export class SettlementService {
  constructor(
    private readonly repository: SettlementRepository = settlementRepository,
    private readonly providerFactory: () => SettlementProvider = createTestSettlementProvider,
    private readonly eventWriter: FinancialEventWriter = financialEventService
  ) {}

  async list(actor: AuthPrincipal, query: {
    storeId: number;
    status?: SettlementBatchStatus;
    page: number;
    limit: number;
  }) {
    await authorizationService.requireStorePermission({
      principal: actor,
      storeId: query.storeId,
      permission: "finance.settlements.read",
    });
    return this.repository.list(query.storeId, query.status, query.page, query.limit);
  }

  async get(actor: AuthPrincipal, id: number) {
    const detail = await this.repository.findDetail(id);
    if (!detail) throw resourceNotFound();
    await authorizationService.requireResourceStorePermission({
      principal: actor,
      resourceStoreId: detail.batch.storeId,
      permission: "finance.settlements.read",
    });
    return detail;
  }

  async importBatch(actor: AuthPrincipal, input: ImportSettlementInput) {
    let normalized: SettlementImportBatch;
    if (input.source === "fixture") {
      const fixture = findSettlementFixture(input.providerSettlementId);
      if (!fixture) {
        throw new AppError("Settlement fixture was not found.", 404, "SETTLEMENT_FIXTURE_NOT_FOUND");
      }
      normalized = structuredClone(fixture) as SettlementImportBatch;
    } else {
      await this.authorizeImport(actor, input.storeId);
      normalized = await this.providerFactory().fetchSettlement(
        input.providerSettlementId,
        input.storeId
      );
      if (normalized.providerSettlementId !== input.providerSettlementId) {
        throw new AppError("Provider settlement ID did not match the request.", 502, "INVALID_PROVIDER_SETTLEMENT");
      }
    }

    await this.authorizeImport(actor, normalized.storeId);
    if (!(await this.repository.storeExists(normalized.storeId))) throw resourceNotFound();
    normalized = {
      ...normalized,
      lines: [...normalized.lines].sort((left, right) =>
        left.providerLineId.localeCompare(right.providerLineId)),
    };
    validateSettlementImport(normalized);
    const payloadHash = hashSettlementPayload(normalized);
    const existing = await this.repository.findByProviderId(normalized.providerSettlementId);
    if (existing) return this.requireIdempotentImport(existing, payloadHash);

    try {
      const result = await this.repository.transaction(async (tx) => {
        await authorizationService.requireResourceStorePermission({
          principal: actor,
          resourceStoreId: normalized.storeId,
          permission: "finance.reconciliation.manage",
          tx,
        });
        const raced = await this.repository.findByProviderId(normalized.providerSettlementId, tx);
        if (raced) return this.requireIdempotentImport(raced, payloadHash);
        const created = await this.repository.create(tx, normalized, payloadHash, actor.userId);
        await auditService.write({
          tx,
          actor,
          storeId: created.storeId,
          action: "settlement.imported",
          resourceType: "settlement_batch",
          resourceId: created.id,
          after: {
            status: created.status,
            grossAmountPaise: created.grossAmountPaise,
            feePaise: created.feePaise,
            feeTaxPaise: created.feeTaxPaise,
            adjustmentPaise: created.adjustmentPaise,
            netAmountPaise: created.netAmountPaise,
          },
          metadata: {
            provider: created.provider,
            providerSettlementId: created.providerSettlementId,
            source: created.source,
            lineCount: normalized.lines.length,
            payloadHash,
          },
        });
        return { batch: created, imported: true };
      });
      return result;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const raced = await this.repository.findByProviderId(normalized.providerSettlementId);
      if (!raced) throw importConflict();
      return this.requireIdempotentImport(raced, payloadHash);
    }
  }

  async reconcile(actor: AuthPrincipal, id: number) {
    const identity = await this.repository.findDetail(id);
    if (!identity) throw resourceNotFound();
    await authorizationService.requireResourceStorePermission({
      principal: actor,
      resourceStoreId: identity.batch.storeId,
      permission: "finance.reconciliation.manage",
    });

    return this.repository.transaction(async (tx) => {
      const batch = await this.repository.lockBatch(tx, id);
      if (!batch) throw resourceNotFound();
      await authorizationService.requireResourceStorePermission({
        principal: actor,
        resourceStoreId: batch.storeId,
        permission: "finance.reconciliation.manage",
        tx,
      });
      if (batch.status !== "imported") {
        return this.repository.findDetail(batch.id, tx);
      }

      const detail = await this.repository.findDetail(batch.id, tx);
      if (!detail) throw resourceNotFound();
      const local = await this.repository.listLocalCandidates(tx, batch);
      const result = matchSettlement({ lines: detail.lines, ...local });
      const updated = await this.repository.applyMatching(
        tx,
        batch,
        result.lineMatches,
        result.issues,
        actor.userId
      );
      await auditService.write({
        tx,
        actor,
        storeId: batch.storeId,
        action: "settlement.reconciled",
        resourceType: "settlement_batch",
        resourceId: batch.id,
        before: { status: batch.status },
        after: { status: updated.status },
        metadata: {
          lineCount: result.lineMatches.length,
          matchedCount: result.lineMatches.filter((item) => item.matchStatus === "matched").length,
          issueCount: result.issues.length,
        },
      });
      if (updated.status === "reconciled") {
        await this.emitReconciledEvent(tx, actor, { batch: updated, lines: detail.lines }, result.lineMatches);
      }
      return this.repository.findDetail(batch.id, tx);
    });
  }

  async listIssues(actor: AuthPrincipal, query: ReconciliationIssuesQuery) {
    await authorizationService.requireStorePermission({
      principal: actor,
      storeId: query.storeId,
      permission: "finance.settlements.read",
    });
    return this.repository.listIssues(query.storeId, query.status, query.page, query.limit);
  }

  async resolveIssue(
    actor: AuthPrincipal,
    issueId: number,
    input: ResolveReconciliationIssueInput
  ) {
    const identity = await this.repository.findIssue(issueId);
    if (!identity) throw resourceNotFound();
    await authorizationService.requireResourceStorePermission({
      principal: actor,
      resourceStoreId: identity.storeId,
      permission: "finance.reconciliation.manage",
    });
    return this.repository.transaction(async (tx) => {
      const current = await this.repository.lockIssue(tx, issueId);
      if (!current) throw resourceNotFound();
      await authorizationService.requireResourceStorePermission({
        principal: actor,
        resourceStoreId: current.storeId,
        permission: "finance.reconciliation.manage",
        tx,
      });
      if (current.status === "resolved") {
        throw new AppError("Reconciliation issue is already resolved.", 409, "RECONCILIATION_ISSUE_ALREADY_RESOLVED");
      }
      const resolved = await this.repository.resolveIssue(tx, issueId, actor.userId, input.reason);
      const batchReconciled = current.batchId
        ? await this.repository.markBatchReconciledWhenClear(tx, current.batchId)
        : false;
      await auditService.write({
        tx,
        actor,
        storeId: current.storeId,
        action: "settlement.issue_resolved",
        resourceType: "settlement_batch",
        resourceId: current.batchId ?? `issue:${current.id}`,
        before: { issueId: current.id, status: current.status },
        after: { issueId: resolved.id, status: resolved.status },
        metadata: { reason: input.reason, issueType: current.issueType, batchReconciled },
      });
      if (batchReconciled && current.batchId) {
        const detail = await this.repository.findDetail(current.batchId, tx);
        if (!detail) throw resourceNotFound();
        await this.emitReconciledEvent(tx, actor, detail);
      }
      return { issue: resolved, batchReconciled };
    });
  }

  private authorizeImport(actor: AuthPrincipal, storeId: number) {
    return authorizationService.requireStorePermission({
      principal: actor,
      storeId,
      permission: "finance.reconciliation.manage",
    });
  }

  private async emitReconciledEvent(
    tx: Parameters<FinancialEventWriter["write"]>[0],
    actor: AuthPrincipal,
    detail: Pick<NonNullable<Awaited<ReturnType<SettlementRepository["findDetail"]>>>, "batch" | "lines">,
    matches?: Array<{
      lineId: number;
      matchStatus: string;
      paymentAttemptId: number | null;
      refundId: number | null;
    }>
  ) {
    const store = await this.repository.findStore(detail.batch.storeId, tx);
    if (!store) throw resourceNotFound();
    const matchById = new Map(matches?.map((item) => [item.lineId, item]));
    await this.eventWriter.write(tx, {
      eventType: "settlement.reconciled",
      schemaVersion: 1,
      sourceType: "settlement_batch",
      sourceId: detail.batch.id,
      sourceVersion: 1,
      storeId: detail.batch.storeId,
      currency: detail.batch.currency,
      occurredAt: detail.batch.settledAt,
      businessDate: businessDateFor(detail.batch.settledAt, store.timezone),
      timezone: store.timezone,
      actorId: actor.userId,
      payload: {
        batchId: detail.batch.id,
        providerSettlementId: detail.batch.providerSettlementId,
        grossAmountPaise: detail.batch.grossAmountPaise,
        netAmountPaise: detail.batch.netAmountPaise,
        feePaise: detail.batch.feePaise,
        feeTaxPaise: detail.batch.feeTaxPaise,
        adjustments: detail.lines.filter((line) => line.type === "adjustment").map((line) => ({
          settlementLineId: line.id,
          amountPaise: line.amountPaise,
          providerEntityId: line.providerEntityId,
        })),
        lineMatches: detail.lines.map((line) => ({
          settlementLineId: line.id,
          matchStatus: matchById.get(line.id)?.matchStatus ?? line.matchStatus,
          paymentAttemptId: matchById.get(line.id)?.paymentAttemptId ?? line.paymentAttemptId,
          refundId: matchById.get(line.id)?.refundId ?? line.refundId,
        })),
        utr: detail.batch.utr,
        providerReference: detail.batch.providerReference,
        settledAt: detail.batch.settledAt.toISOString(),
      },
    });
  }

  private requireIdempotentImport(
    existing: Awaited<ReturnType<SettlementRepository["findByProviderId"]>>,
    payloadHash: string
  ) {
    if (!existing || existing.payloadHash !== payloadHash) throw importConflict();
    return { batch: existing, imported: false };
  }
}

export default new SettlementService();
