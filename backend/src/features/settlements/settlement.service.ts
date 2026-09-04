import type { AuthPrincipal } from "../auth/auth.types";
import { AppError } from "../../utils/error";
import type { SettlementBatchStatus } from "../../utils/types";
import authorizationService, { resourceNotFound } from "../access/access.service";
import auditService from "../audit/audit.service";
import { findSettlementFixture, type SettlementImportBatch } from "./settlement.fixtures";
import { hashSettlementPayload, validateSettlementImport } from "./settlement.policy";
import { createTestSettlementProvider, type SettlementProvider } from "./settlement.provider";
import settlementRepository, { SettlementRepository } from "./settlement.repository";
import type { ImportSettlementInput } from "./settlement.schemas";

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
    private readonly providerFactory: () => SettlementProvider = createTestSettlementProvider
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

  private authorizeImport(actor: AuthPrincipal, storeId: number) {
    return authorizationService.requireStorePermission({
      principal: actor,
      storeId,
      permission: "finance.reconciliation.manage",
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
