import type { AuthPrincipal } from "../auth/auth.types";
import { AppError } from "../../utils/error";
import { businessDateFor } from "../../utils/business-date";
import { env } from "../../utils/zodSchema";
import authorizationService, { resourceNotFound } from "../access/access.service";
import auditService from "../audit/audit.service";
import { createRazorpayGateway } from "../payments/razorpay.gateway";
import { getRazorpayConfig } from "../payments/razorpay.config";
import type { RazorpayRefundSnapshot } from "../payments/razorpay.types";
import type { RefundStatus, TransactionType } from "../../utils/types";
import type {
  ApproveRefundInput,
  ReconcileRefundsInput,
  RefundsQueryInput,
  RejectRefundInput,
  RequestRefundInput,
  StuckRefundsQueryInput,
} from "./refund.schemas";
import refundRepository, { RefundRepository } from "./refund.repository";
import {
  activeRefundStatuses,
  assertRefundCapacity,
  buildRefundAllocations,
  requireRefundStatus,
} from "./refund.policy";
import cashService, { type CashSourceWriter } from "../cash-management/cash.service";
import financialEventService from "../finance-events/financial-event.service";
import type { FinancialEventWriter } from "../finance-events/financial-event.types";
import { publishRefundStatusChanged } from "../realtime/realtime-publisher";

export interface ProviderRefundWebhookEntity {
  id: string;
  payment_id: string;
  amount: number;
  currency: string;
  status: string;
  receipt?: string | null;
  notes?: Record<string, string | number>;
  error_code?: string | null;
  error_description?: string | null;
  error_reason?: string | null;
}

export interface ProviderRefundWebhookInput {
  event: string;
  refund: ProviderRefundWebhookEntity;
}

const segregationViolation = () => new AppError(
  "The requester cannot approve or reject their own refund.",
  403,
  "SEGREGATION_OF_DUTIES_VIOLATION"
);

const duplicateIdempotencyKey = () => new AppError(
  "Idempotency-Key has already been used for a different refund request.",
  409,
  "DUPLICATE_IDEMPOTENCY_KEY"
);

const isUniqueViolation = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error && error.code === "23505";

export class RefundService {
  constructor(
    private readonly repository: RefundRepository = refundRepository,
    private readonly cashWriter: CashSourceWriter = cashService,
    private readonly eventWriter: FinancialEventWriter = financialEventService
  ) { }

  async list(actor: AuthPrincipal, query: RefundsQueryInput) {
    await authorizationService.requireStorePermission({
      principal: actor, storeId: query.storeId, permission: "finance.refunds.create",
    });
    const stuckCutoff = query.stuck
      ? new Date(Date.now() - (query.olderThanMinutes ?? 15) * 60_000)
      : undefined;
    return this.repository.list(query.storeId, query.status, query.page, query.limit, { stuckCutoff });
  }

  async listStuck(actor: AuthPrincipal, query: StuckRefundsQueryInput) {
    await authorizationService.requireStorePermission({
      principal: actor, storeId: query.storeId, permission: "finance.refunds.create",
    });
    const stuckCutoff = new Date(Date.now() - query.olderThanMinutes * 60_000);
    return this.repository.list(query.storeId, undefined, query.page, query.limit, { stuckCutoff });
  }

  async request(actor: AuthPrincipal, orderId: number, clientRequestId: string, input: RequestRefundInput) {
    const existing = await this.repository.findByClientRequestId(clientRequestId);
    if (existing) {
      await authorizationService.requireResourceStorePermission({
        principal: actor,
        resourceStoreId: existing.refund.storeId,
        permission: "finance.refunds.create",
      });
      return this.requireIdempotentMatch(existing, actor, orderId, input);
    }

    try {
      return await this.repository.transaction(async (tx) => {
        const order = await this.repository.lockOrder(tx, orderId);
        if (!order) throw resourceNotFound();
        const attempts = await this.repository.lockPaymentAttempts(tx, orderId);
        await authorizationService.requireResourceStorePermission({
          principal: actor,
          resourceStoreId: order.storeId,
          permission: "finance.refunds.create",
          tx,
        });

        let selected: (typeof attempts)[number] | undefined;
        for (const attempt of attempts.filter((candidate) => candidate.status === "captured")) {
          const reserved = await this.repository.listAttemptRefunds(tx, attempt.id, activeRefundStatuses);
          const reservedPaise = reserved.reduce((sum, refund) => sum + refund.amountPaise, 0);
          if (reservedPaise + input.amountPaise <= attempt.amountPaise) {
            selected = attempt;
            break;
          }
        }
        if (!selected) {
          throw new AppError(
            "Refund amount exceeds the captured payment balance.", 422,
            "REFUND_EXCEEDS_CAPTURED_AMOUNT"
          );
        }

        const reserved = await this.repository.listAttemptRefunds(tx, selected.id, activeRefundStatuses);
        assertRefundCapacity(
          selected.amountPaise,
          reserved.reduce((sum, refund) => sum + refund.amountPaise, 0),
          input.amountPaise
        );
        const [orderItems, existingAllocations] = await Promise.all([
          this.repository.listOrderItems(tx, orderId),
          this.repository.listActiveAllocations(tx, orderId, activeRefundStatuses),
        ]);
        const allocations = buildRefundAllocations({
          input,
          orderItems,
          deliveryFeePaise: order.deliveryFeePaise,
          deliveryTaxPaise: order.deliveryTaxPaise,
          existing: existingAllocations,
        });
        const refund = await this.repository.create(tx, {
          orderId,
          paymentAttemptId: selected.id,
          storeId: order.storeId,
          amountPaise: input.amountPaise,
          currency: "INR",
          status: "requested",
          reasonCode: input.reasonCode,
          reasonNote: input.reasonNote,
          clientRequestId,
          requestedBy: actor.userId,
        }, allocations);
        await auditService.write({
          tx, actor, storeId: order.storeId, action: "refund.requested",
          resourceType: "refund", resourceId: refund.id,
          after: { status: refund.status, amountPaise: refund.amountPaise, reasonCode: refund.reasonCode },
          metadata: { orderId, paymentAttemptId: selected.id, allocationCount: allocations.length },
        });
        return { refund, allocations };
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const raced = await this.repository.findByClientRequestId(clientRequestId);
      if (!raced) throw duplicateIdempotencyKey();
      await authorizationService.requireResourceStorePermission({
        principal: actor,
        resourceStoreId: raced.refund.storeId,
        permission: "finance.refunds.create",
      });
      return this.requireIdempotentMatch(raced, actor, orderId, input);
    }
  }

  async approve(actor: AuthPrincipal, refundId: number, input: ApproveRefundInput) {
    const prepared = await this.transitionForApproval(actor, refundId, input);
    const result = prepared.attempt.provider === "cod"
      ? prepared.refund
      : await this.submitToProvider(
          actor,
          prepared.refund,
          prepared.attempt.providerPaymentId
        );
    publishRefundStatusChanged(result);
    return result;
  }

  async reject(actor: AuthPrincipal, refundId: number, input: RejectRefundInput) {
    const identity = await this.repository.findById(refundId);
    if (!identity) throw resourceNotFound();
    const result = await this.repository.transaction(async (tx) => {
      await this.lockParents(tx, identity.refund.orderId, identity.refund.paymentAttemptId);
      const refund = await this.repository.lockRefund(tx, refundId);
      if (!refund) throw resourceNotFound();
      await authorizationService.requireResourceStorePermission({
        principal: actor, resourceStoreId: refund.storeId,
        permission: "finance.refunds.approve", tx,
      });
      if (refund.requestedBy === actor.userId) throw segregationViolation();
      requireRefundStatus(refund.status, "requested");
      const updated = await this.repository.update(tx, refund.id, {
        status: "rejected", rejectedBy: actor.userId, rejectedAt: new Date(),
        version: refund.version + 1,
      });
      await auditService.write({
        tx, actor, storeId: refund.storeId, action: "refund.rejected",
        resourceType: "refund", resourceId: refund.id,
        before: { status: refund.status }, after: { status: updated.status },
        metadata: { reason: input.reason },
      });
      return updated;
    });
    publishRefundStatusChanged(result);
    return result;
  }

  async retry(actor: AuthPrincipal, refundId: number) {
    const identity = await this.repository.findById(refundId);
    if (!identity) throw resourceNotFound();
    const prepared = await this.repository.transaction(async (tx) => {
      const { attempt } = await this.lockParents(tx, identity.refund.orderId, identity.refund.paymentAttemptId);
      const refund = await this.repository.lockRefund(tx, refundId);
      if (!refund) throw resourceNotFound();
      await authorizationService.requireResourceStorePermission({
        principal: actor, resourceStoreId: refund.storeId,
        permission: "finance.refunds.approve", tx,
      });
      requireRefundStatus(refund.status, "failed");
      if (attempt.provider !== "razorpay") {
        throw new AppError("COD refunds cannot be retried through a provider.", 409, "INVALID_STATE_TRANSITION");
      }
      const updated = await this.repository.update(tx, refund.id, {
        status: "submitted", submittedBy: actor.userId, submittedAt: new Date(),
        providerStatus: null, failureCode: null, failureDescription: null,
        failedAt: null, version: refund.version + 1,
      });
      await auditService.write({
        tx, actor, storeId: refund.storeId, action: "refund.provider_submitted",
        resourceType: "refund", resourceId: refund.id,
        before: { status: refund.status }, after: { status: updated.status, version: updated.version },
        metadata: { retry: true },
      });
      return { refund: updated, paymentId: attempt.providerPaymentId };
    });
    const result = await this.submitToProvider(
      actor,
      prepared.refund,
      prepared.paymentId
    );
    publishRefundStatusChanged(result);
    return result;
  }

  private async transitionForApproval(actor: AuthPrincipal, refundId: number, input: ApproveRefundInput) {
    const identity = await this.repository.findById(refundId);
    if (!identity) throw resourceNotFound();
    return this.repository.transaction(async (tx) => {
      const { order, attempt } = await this.lockParents(tx, identity.refund.orderId, identity.refund.paymentAttemptId);
      const refund = await this.repository.lockRefund(tx, refundId);
      if (!refund) throw resourceNotFound();
      const authorization = await authorizationService.requireResourceStorePermission({
        principal: actor, resourceStoreId: refund.storeId,
        permission: "finance.refunds.approve", tx,
      });
      if (refund.requestedBy === actor.userId) throw segregationViolation();
      if (authorization.membershipRole === "manager" &&
        refund.amountPaise > env.REFUND_MANAGER_APPROVAL_LIMIT_PAISE) {
        throw new AppError("Refund exceeds the manager approval threshold.", 403, "REFUND_APPROVAL_LIMIT_EXCEEDED");
      }
      requireRefundStatus(refund.status, "requested");
      const reserved = await this.repository.listAttemptRefunds(tx, attempt.id, activeRefundStatuses);
      assertRefundCapacity(
        attempt.amountPaise,
        reserved.filter((item) => item.id !== refund.id).reduce((sum, item) => sum + item.amountPaise, 0),
        refund.amountPaise
      );
      const now = new Date();
      let approved = await this.repository.update(tx, refund.id, {
        status: "approved", approvedBy: actor.userId, approvedAt: now, version: refund.version + 1,
      });
      await auditService.write({
        tx, actor, storeId: refund.storeId, action: "refund.approved",
        resourceType: "refund", resourceId: refund.id,
        before: { status: refund.status }, after: { status: approved.status },
      });

      if (attempt.provider === "cod") {
        if (input.codCashReturned !== true) {
          throw new AppError("codCashReturned evidence is required for a COD refund.", 422, "COD_CASH_RETURN_EVIDENCE_REQUIRED");
        }
        approved = await this.repository.update(tx, refund.id, {
          status: "processed", submittedBy: actor.userId, submittedAt: now,
          processedBy: actor.userId, processedAt: now, providerStatus: "cash_returned",
          version: approved.version + 1,
        });
        await auditService.write({
          tx, actor, storeId: refund.storeId, action: "refund.provider_processed",
          resourceType: "refund", resourceId: refund.id,
          before: { status: "approved" }, after: { status: approved.status },
          metadata: { provider: "cod", evidence: "cash_returned" },
        });
        const cash = await this.cashWriter.recordCodRefund(tx, {
          storeId: refund.storeId,
          refundId: refund.id,
          amountPaise: refund.amountPaise,
          occurredAt: now,
          actorId: actor.userId,
        });
        await this.emitProcessedAndDisbursed(tx, approved, order, attempt, actor.userId, now, `cash-movement:${cash.movement.id}`);
      } else {
        if (!attempt.providerPaymentId) {
          throw new AppError("Captured payment is missing its provider payment ID.", 409, "PAYMENT_PROVIDER_REFERENCE_MISSING");
        }
        approved = await this.repository.update(tx, refund.id, {
          status: "submitted", submittedBy: actor.userId, submittedAt: now,
          version: approved.version + 1,
        });
        await auditService.write({
          tx, actor, storeId: refund.storeId, action: "refund.provider_submitted",
          resourceType: "refund", resourceId: refund.id,
          before: { status: "approved" }, after: { status: approved.status },
          metadata: { provider: "razorpay" },
        });
      }
      return { refund: approved, attempt };
    });
  }

  private async submitToProvider(
    actor: AuthPrincipal,
    refund: Awaited<ReturnType<RefundRepository["update"]>>,
    providerPaymentId: string | null
  ) {
    if (!providerPaymentId) throw new AppError("Provider payment ID is missing.", 409, "PAYMENT_PROVIDER_REFERENCE_MISSING");
    try {
      const config = getRazorpayConfig();
      if (!config) throw new Error("Provider is not configured");
      const gateway = createRazorpayGateway(config);
      const receipt = `refund_${refund.id}_v${refund.version}`;
      const priorReceipt = refund.version >= 5
        ? `refund_${refund.id}_v${refund.version - 2}`
        : null;
      const prior = priorReceipt
        ? await gateway.findRefundByReceipt(providerPaymentId, priorReceipt)
        : null;
      const result = prior && prior.status !== "failed"
        ? prior
        : await gateway.findRefundByReceipt(providerPaymentId, receipt)
        ?? await gateway.createRefund({
          paymentId: providerPaymentId,
          amountPaise: refund.amountPaise,
          receipt,
          notes: { refundId: refund.id, orderId: refund.orderId },
        });
      if (result.paymentId !== providerPaymentId || result.amountPaise !== refund.amountPaise || result.currency !== "INR") {
        throw new Error("Provider refund response did not match the request");
      }
      return this.recordProviderOutcome(actor, refund.id, result.status, result.id);
    } catch {
      return this.recordProviderFailure(actor, refund.id, "PROVIDER_REFUND_FAILED");
    }
  }

  private async recordProviderOutcome(
    actor: AuthPrincipal, refundId: number, providerStatus: "pending" | "processed" | "failed", providerRefundId: string
  ) {
    if (providerStatus === "failed") return this.recordProviderFailure(actor, refundId, "PROVIDER_REPORTED_FAILED", providerRefundId);
    const identity = await this.repository.findById(refundId);
    if (!identity) throw resourceNotFound();
    return this.repository.transaction(async (tx) => {
      const { order, attempt } = await this.lockParents(tx, identity.refund.orderId, identity.refund.paymentAttemptId);
      const refund = await this.repository.lockRefund(tx, refundId);
      if (!refund) throw resourceNotFound();
      requireRefundStatus(refund.status, ["submitted", "processing"]);
      const status = providerStatus === "processed" ? "processed" : "processing";
      const now = new Date();
      const updated = await this.repository.update(tx, refund.id, {
        status, providerRefundId, providerStatus,
        ...(status === "processed" ? { processedAt: now } : {}),
        version: refund.version + 1,
      });
      await auditService.write({
        tx, actor, storeId: refund.storeId,
        action: status === "processed" ? "refund.provider_processed" : "refund.provider_processing",
        resourceType: "refund", resourceId: refund.id,
        before: { status: refund.status }, after: { status, providerStatus },
        metadata: { provider: "razorpay", providerRefundId },
      });
      if (status === "processed") {
        await this.emitProcessedAndDisbursed(tx, updated, order, attempt, actor.userId, now, providerRefundId);
      }
      return updated;
    });
  }

  private async recordProviderFailure(
    actor: AuthPrincipal, refundId: number, failureCode: string, providerRefundId?: string
  ) {
    const identity = await this.repository.findById(refundId);
    if (!identity) throw resourceNotFound();
    return this.repository.transaction(async (tx) => {
      await this.lockParents(tx, identity.refund.orderId, identity.refund.paymentAttemptId);
      const refund = await this.repository.lockRefund(tx, refundId);
      if (!refund) throw resourceNotFound();
      requireRefundStatus(refund.status, ["submitted", "processing"]);
      const updated = await this.repository.update(tx, refund.id, {
        status: "failed", providerRefundId, providerStatus: "failed",
        failureCode, failureDescription: "Provider refund request failed.",
        failedAt: new Date(), version: refund.version + 1,
      });
      await auditService.write({
        tx, actor, storeId: refund.storeId, action: "refund.provider_failed",
        resourceType: "refund", resourceId: refund.id,
        before: { status: refund.status }, after: { status: updated.status, failureCode },
        metadata: { provider: "razorpay", ...(providerRefundId ? { providerRefundId } : {}) },
        outcome: "failure",
      });
      return updated;
    });
  }

  private async emitProcessedAndDisbursed(
    tx: TransactionType,
    refund: Awaited<ReturnType<RefundRepository["update"]>>,
    order: NonNullable<Awaited<ReturnType<RefundRepository["lockOrder"]>>>,
    attempt: Awaited<ReturnType<RefundRepository["lockPaymentAttempts"]>>[number],
    actorId: number | null,
    now: Date,
    reference: string
  ) {
    const [store, allocations] = await Promise.all([
      this.repository.findStore(tx, refund.storeId),
      this.repository.allocations(tx, refund.id),
    ]);
    if (!store) throw resourceNotFound();
    const envelope = {
      schemaVersion: 1,
      sourceType: "refund",
      sourceId: refund.id,
      sourceVersion: refund.version,
      storeId: refund.storeId,
      currency: "INR" as const,
      occurredAt: now,
      businessDate: businessDateFor(now, store.timezone),
      timezone: store.timezone,
      actorId,
    };
    await this.eventWriter.write(tx, {
      ...envelope,
      eventType: "refund.processed",
      payload: {
        refundId: refund.id,
        orderId: refund.orderId,
        paymentAttemptId: refund.paymentAttemptId,
        totalPaise: refund.amountPaise,
        provider: attempt.provider,
        providerReference: reference,
        processedAt: (refund.processedAt ?? now).toISOString(),
        fulfilmentState: order.status,
        recognizedAt: order.recognizedAt?.toISOString() ?? null,
        allocations: allocations.map((item) => ({
          kind: item.kind,
          orderItemId: item.orderItemId,
          quantity: item.quantity,
          amountPaise: item.amountPaise,
          taxableAmountPaise: item.taxableAmountPaise,
          taxPaise: item.taxPaise,
          discountReversalPaise: item.discountReversalPaise,
        })),
      },
    });
    await this.eventWriter.write(tx, {
      ...envelope,
      eventType: "refund.disbursed",
      payload: {
        refundId: refund.id,
        orderId: refund.orderId,
        method: attempt.provider === "cod" ? "cash" : "razorpay",
        disbursedPaise: refund.amountPaise,
        clearingReference: reference,
        disbursedAt: (refund.processedAt ?? now).toISOString(),
      },
    });
  }

  private async lockParents(tx: TransactionType, orderId: number, paymentAttemptId: number) {
    const order = await this.repository.lockOrder(tx, orderId);
    if (!order) throw resourceNotFound();
    const attempts = await this.repository.lockPaymentAttempts(tx, orderId);
    const attempt = attempts.find((candidate) => candidate.id === paymentAttemptId);
    if (!attempt) throw resourceNotFound();
    return { order, attempt };
  }

  private requireIdempotentMatch(
    existing: NonNullable<Awaited<ReturnType<RefundRepository["findByClientRequestId"]>>>,
    actor: AuthPrincipal,
    orderId: number,
    input: RequestRefundInput
  ) {
    const expected = input.allocations.map((allocation) => "orderItemId" in allocation
      ? `item:${allocation.orderItemId}:${allocation.quantity}:${allocation.allocatedPaise}`
      : `delivery_fee:${allocation.allocatedPaise}`).sort();
    const actual = existing.allocations.map((allocation) => allocation.kind === "item"
      ? `item:${allocation.orderItemId}:${allocation.quantity}:${allocation.amountPaise}`
      : `delivery_fee:${allocation.amountPaise}`).sort();
    if (existing.refund.requestedBy !== actor.userId || existing.refund.orderId !== orderId ||
      existing.refund.amountPaise !== input.amountPaise || existing.refund.reasonCode !== input.reasonCode ||
      (existing.refund.reasonNote ?? undefined) !== input.reasonNote || JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw duplicateIdempotencyKey();
    }
    return existing;
  }

  async processProviderWebhookEvent(input: ProviderRefundWebhookInput) {
    const { event, refund: entity } = input;
    const identity = await this.resolveLocalRefund(entity);
    if (!identity) {
      return { ignored: true as const, reason: "LOCAL_REFUND_NOT_FOUND" };
    }

    if (identity.refund.amountPaise !== entity.amount) {
      throw new AppError(
        "Provider refund amount does not match local refund.",
        409,
        "PAYMENT_PROVIDER_MISMATCH"
      );
    }

    const outcome = await this.repository.transaction(async (tx) => {
      const { order, attempt } = await this.lockParents(tx, identity.refund.orderId, identity.refund.paymentAttemptId);
      if (attempt.providerPaymentId && attempt.providerPaymentId !== entity.payment_id) {
        throw new AppError(
          "Provider refund payment ID does not match local attempt.",
          409,
          "PAYMENT_PROVIDER_MISMATCH"
        );
      }

      const refund = await this.repository.lockRefund(tx, identity.refund.id);
      if (!refund) return { ignored: true as const, reason: "LOCAL_REFUND_NOT_FOUND" };

      const isProcessed = entity.status === "processed" || event === "refund.processed";
      const isFailed = entity.status === "failed" || event === "refund.failed";

      if (isProcessed) {
        if (refund.status === "processed" && refund.providerRefundId === entity.id) {
          return { refund, duplicate: true as const, inProgress: false };
        }
        if (refund.status === "processed") {
          return { refund, duplicate: true as const, inProgress: false };
        }
      } else if (isFailed) {
        if (refund.status === "failed" && refund.providerRefundId === entity.id) {
          return { refund, duplicate: true as const, inProgress: false };
        }
        if (refund.status === "processed") {
          return { refund, duplicate: false as const, inProgress: false, ignoredStale: true as const };
        }
      } else {
        if (refund.status === "processed" || refund.status === "failed") {
          return { refund, duplicate: false as const, inProgress: false, ignoredStale: true as const };
        }
      }

      const now = new Date();

      if (isProcessed) {
        if (!["submitted", "processing", "approved", "failed"].includes(refund.status)) {
          throw new AppError(`Refund cannot transition from ${refund.status} to processed.`, 409, "INVALID_STATE_TRANSITION");
        }

        if (refund.status === "failed") {
          const reserved = await this.repository.listAttemptRefunds(tx, attempt.id, activeRefundStatuses);
          assertRefundCapacity(
            attempt.amountPaise,
            reserved.filter((r) => r.id !== refund.id).reduce((sum, r) => sum + r.amountPaise, 0),
            refund.amountPaise
          );
        }

        const updated = await this.repository.update(tx, refund.id, {
          status: "processed",
          providerRefundId: entity.id,
          providerStatus: "processed",
          processedAt: refund.processedAt ?? now,
          submittedAt: refund.submittedAt ?? now,
          failureCode: null,
          failureDescription: null,
          failedAt: null,
          version: refund.version + 1,
        });

        await auditService.write({
          tx,
          storeId: refund.storeId,
          action: "refund.provider_processed",
          resourceType: "refund",
          resourceId: refund.id,
          before: { status: refund.status },
          after: { status: updated.status, providerStatus: "processed" },
          metadata: {
            provider: "razorpay",
            providerRefundId: entity.id,
            source: "webhook",
            event,
          },
        });

        await this.emitProcessedAndDisbursed(tx, updated, order, attempt, null, now, entity.id);

        return { refund: updated, duplicate: false as const, inProgress: false };
      }

      if (isFailed) {
        if (!["submitted", "processing", "approved"].includes(refund.status)) {
          throw new AppError(`Refund cannot transition from ${refund.status} to failed.`, 409, "INVALID_STATE_TRANSITION");
        }

        const failureCode = entity.error_code ?? "PROVIDER_REPORTED_FAILED";
        const failureDescription =
          entity.error_description ?? entity.error_reason ?? "Provider reported refund failed.";

        const updated = await this.repository.update(tx, refund.id, {
          status: "failed",
          providerRefundId: entity.id,
          providerStatus: "failed",
          failureCode,
          failureDescription,
          failedAt: now,
          submittedAt: refund.submittedAt ?? now,
          version: refund.version + 1,
        });

        await auditService.write({
          tx,
          storeId: refund.storeId,
          action: "refund.provider_failed",
          resourceType: "refund",
          resourceId: refund.id,
          before: { status: refund.status },
          after: { status: updated.status, failureCode },
          metadata: {
            provider: "razorpay",
            providerRefundId: entity.id,
            source: "webhook",
            event,
          },
          outcome: "failure",
        });

        return { refund: updated, duplicate: false as const, inProgress: false };
      }

      if (refund.status === "submitted" || refund.status === "approved") {
        const updated = await this.repository.update(tx, refund.id, {
          status: "processing",
          providerRefundId: entity.id,
          providerStatus: entity.status ?? "pending",
          submittedAt: refund.submittedAt ?? now,
          version: refund.version + 1,
        });

        await auditService.write({
          tx,
          storeId: refund.storeId,
          action: "refund.provider_processing",
          resourceType: "refund",
          resourceId: refund.id,
          before: { status: refund.status },
          after: { status: updated.status, providerStatus: entity.status ?? "pending" },
          metadata: {
            provider: "razorpay",
            providerRefundId: entity.id,
            source: "webhook",
            event,
          },
        });

        return { refund: updated, duplicate: false as const, inProgress: true };
      }

      return { refund, duplicate: true as const, inProgress: true };
    });
    if (
      "refund" in outcome &&
      outcome.duplicate === false &&
      !("ignoredStale" in outcome)
    ) {
      publishRefundStatusChanged(outcome.refund);
    }
    return outcome;
  }

  async reconcileStaleRefunds(
    actor: AuthPrincipal,
    options?: ReconcileRefundsInput
  ) {
    if (options?.storeId !== undefined) {
      await authorizationService.requireStorePermission({
        principal: actor,
        storeId: options.storeId,
        permission: "finance.refunds.approve",
      });
    } else {
      authorizationService.requirePlatformAdmin(actor, "platform.payments.reconcile");
    }

    const config = getRazorpayConfig();
    if (!config) {
      throw new AppError("Payment provider is not configured", 503, "PAYMENT_UNAVAILABLE");
    }
    const gateway = createRazorpayGateway(config);

    const olderThanMinutes = options?.olderThanMinutes ?? 15;
    const limit = options?.limit ?? 50;
    const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);

    const candidates = await this.repository.findStaleCandidates(cutoff, limit, options?.storeId);

    const results: Array<{
      refundId: number;
      orderId: number;
      status: "processed" | "failed" | "processing" | "unchanged" | "error";
      providerRefundId?: string;
      error?: string;
    }> = [];

    for (const candidate of candidates) {
      try {
        const attempt = await this.repository.getPaymentAttempt(candidate.paymentAttemptId);
        if (!attempt || attempt.provider !== "razorpay" || !attempt.providerPaymentId) {
          results.push({ refundId: candidate.id, orderId: candidate.orderId, status: "unchanged" });
          continue;
        }

        let providerRefund: RazorpayRefundSnapshot | null = null;
        if (candidate.providerRefundId && gateway.fetchRefund) {
          providerRefund = await gateway.fetchRefund(candidate.providerRefundId);
        }
        if (!providerRefund) {
          const receipt = `refund_${candidate.id}_v${candidate.version}`;
          const priorReceipt = candidate.version >= 5 ? `refund_${candidate.id}_v${candidate.version - 2}` : null;
          providerRefund = await gateway.findRefundByReceipt(attempt.providerPaymentId, receipt);
          if (!providerRefund && priorReceipt) {
            providerRefund = await gateway.findRefundByReceipt(attempt.providerPaymentId, priorReceipt);
          }
        }

        if (!providerRefund) {
          results.push({ refundId: candidate.id, orderId: candidate.orderId, status: "unchanged" });
          continue;
        }

        const outcome = await this.processProviderWebhookEvent({
          event: `refund.${providerRefund.status}`,
          refund: {
            id: providerRefund.id,
            payment_id: providerRefund.paymentId,
            amount: providerRefund.amountPaise,
            currency: providerRefund.currency,
            status: providerRefund.status,
            receipt: providerRefund.receipt,
          },
        });

        const outcomeStatus = "refund" in outcome ? outcome.refund.status : "unchanged";
        results.push({
          refundId: candidate.id,
          orderId: candidate.orderId,
          status: outcomeStatus as any,
          providerRefundId: providerRefund.id,
        });
      } catch (error) {
        results.push({
          refundId: candidate.id,
          orderId: candidate.orderId,
          status: "error",
          error: error instanceof Error ? error.message : "Reconciliation error",
        });
      }
    }

    return {
      checked: candidates.length,
      processed: results.filter((r) => r.status === "processed").length,
      failed: results.filter((r) => r.status === "failed").length,
      processing: results.filter((r) => r.status === "processing").length,
      unchanged: results.filter((r) => r.status === "unchanged").length,
      errors: results.filter((r) => r.status === "error").length,
      results,
    };
  }

  private async resolveLocalRefund(entity: ProviderRefundWebhookEntity) {
    const byProviderId = await this.repository.findByProviderRefundId(entity.id);
    if (byProviderId) return byProviderId;

    let refundId: number | undefined;
    if (entity.receipt) {
      const match = /^refund_(\d+)(?:_v\d+)?$/.exec(entity.receipt);
      if (match) {
        refundId = Number(match[1]);
      }
    }

    if (!refundId && entity.notes?.refundId !== undefined) {
      const parsed = Number(entity.notes.refundId);
      if (Number.isInteger(parsed) && parsed > 0) {
        refundId = parsed;
      }
    }

    if (!refundId) return undefined;
    return this.repository.findById(refundId);
  }
}

export default new RefundService(undefined, cashService);
