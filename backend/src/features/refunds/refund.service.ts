import type { AuthPrincipal } from "../auth/auth.types";
import { AppError } from "../../utils/error";
import { env } from "../../utils/zodSchema";
import authorizationService, { resourceNotFound } from "../access/access.service";
import auditService from "../audit/audit.service";
import { createRazorpayGateway } from "../payments/razorpay.gateway";
import { getRazorpayConfig } from "../payments/razorpay.config";
import type { RefundStatus, TransactionType } from "../../utils/types";
import type { ApproveRefundInput, RejectRefundInput, RequestRefundInput } from "./refund.schemas";
import refundRepository, { RefundRepository } from "./refund.repository";
import {
  activeRefundStatuses,
  assertRefundCapacity,
  buildRefundAllocations,
  requireRefundStatus,
} from "./refund.policy";

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
  constructor(private readonly repository: RefundRepository = refundRepository) {}

  async list(actor: AuthPrincipal, query: {
    storeId: number; status?: RefundStatus; page: number; limit: number;
  }) {
    await authorizationService.requireStorePermission({
      principal: actor, storeId: query.storeId, permission: "finance.refunds.create",
    });
    return this.repository.list(query.storeId, query.status, query.page, query.limit);
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
          deliveryTaxRateBps: order.deliveryTaxRateBps,
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
    if (prepared.attempt.provider === "cod") return prepared.refund;
    return this.submitToProvider(actor, prepared.refund, prepared.attempt.providerPaymentId);
  }

  async reject(actor: AuthPrincipal, refundId: number, input: RejectRefundInput) {
    const identity = await this.repository.findById(refundId);
    if (!identity) throw resourceNotFound();
    return this.repository.transaction(async (tx) => {
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
  }

  async retry(actor: AuthPrincipal, refundId: number) {
    const identity = await this.repository.findById(refundId);
    if (!identity) throw resourceNotFound();
    const prepared = await this.repository.transaction(async (tx) => {
      const attempt = await this.lockParents(tx, identity.refund.orderId, identity.refund.paymentAttemptId);
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
    return this.submitToProvider(actor, prepared.refund, prepared.paymentId);
  }

  private async transitionForApproval(actor: AuthPrincipal, refundId: number, input: ApproveRefundInput) {
    const identity = await this.repository.findById(refundId);
    if (!identity) throw resourceNotFound();
    return this.repository.transaction(async (tx) => {
      const attempt = await this.lockParents(tx, identity.refund.orderId, identity.refund.paymentAttemptId);
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
      await this.lockParents(tx, identity.refund.orderId, identity.refund.paymentAttemptId);
      const refund = await this.repository.lockRefund(tx, refundId);
      if (!refund) throw resourceNotFound();
      requireRefundStatus(refund.status, ["submitted", "processing"]);
      const status = providerStatus === "processed" ? "processed" : "processing";
      const updated = await this.repository.update(tx, refund.id, {
        status, providerRefundId, providerStatus,
        ...(status === "processed" ? { processedAt: new Date() } : {}),
        version: refund.version + 1,
      });
      await auditService.write({
        tx, actor, storeId: refund.storeId,
        action: status === "processed" ? "refund.provider_processed" : "refund.provider_processing",
        resourceType: "refund", resourceId: refund.id,
        before: { status: refund.status }, after: { status, providerStatus },
        metadata: { provider: "razorpay", providerRefundId },
      });
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
      });
      return updated;
    });
  }

  private async lockParents(tx: TransactionType, orderId: number, paymentAttemptId: number) {
    const order = await this.repository.lockOrder(tx, orderId);
    if (!order) throw resourceNotFound();
    const attempts = await this.repository.lockPaymentAttempts(tx, orderId);
    const attempt = attempts.find((candidate) => candidate.id === paymentAttemptId);
    if (!attempt) throw resourceNotFound();
    return attempt;
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
}

export default new RefundService();
