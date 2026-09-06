import type { AuthPrincipal } from "../auth/auth.types";
import type { TransactionType } from "../../utils/types";
import { MAX_POSTGRES_INT } from "../../utils/money";
import { businessDateFor } from "../../utils/business-date";
import { AppError } from "../../utils/error";
import authorizationService, { resourceNotFound } from "../access/access.service";
import auditService from "../audit/audit.service";
import financialEventService from "../finance-events/financial-event.service";
import type { FinancialEventWriter } from "../finance-events/financial-event.types";
import cashRepository, { CashRepository } from "./cash.repository";
import { isMaterialVariance, signedMovementAmount } from "./cash.policy";
import type { CashSessionsQuery, CloseCashSessionInput, OpenCashSessionInput, RecordCashMovementInput } from "./cash.schemas";

const invalidState = (message: string) => new AppError(message, 409, "INVALID_CASH_SESSION_STATE");
const requireReviewer = (authorization: Awaited<ReturnType<typeof authorizationService.requireStorePermission>>) => {
  if (authorization.access === "membership" && authorization.membershipRole !== "manager" && authorization.membershipRole !== "finance_manager") {
    throw new AppError("Only an owner or manager can close or reopen a cash session.", 403, "CASH_REVIEW_PERMISSION_REQUIRED");
  }
};

export interface CashSourceWriter {
  recordCodCollection(tx: TransactionType, input: { storeId: number; orderId: number; amountPaise: number; occurredAt: Date; actorId: number | null }): Promise<{ movement: { id: number }; session: { id: number } }>;
  recordCodRefund(tx: TransactionType, input: { storeId: number; refundId: number; amountPaise: number; occurredAt: Date; actorId: number }): Promise<{ movement: { id: number }; session: { id: number } }>;
}

export class CashService implements CashSourceWriter {
  constructor(
    private readonly repository: CashRepository = cashRepository,
    private readonly eventWriter: FinancialEventWriter = financialEventService
  ) {}

  async list(actor: AuthPrincipal, query: CashSessionsQuery) {
    await authorizationService.requireStorePermission({ principal: actor, storeId: query.storeId, permission: "finance.cash.manage" });
    return this.repository.list(query);
  }

  async get(actor: AuthPrincipal, id: number) {
    const identity = await this.repository.findById(id);
    if (!identity) throw resourceNotFound();
    await authorizationService.requireResourceStorePermission({ principal: actor, resourceStoreId: identity.storeId, permission: "finance.cash.manage" });
    return this.repository.detail(id);
  }

  async open(actor: AuthPrincipal, input: OpenCashSessionInput, now = new Date()) {
    const store = await this.repository.findStore(input.storeId);
    if (!store) throw resourceNotFound();
    const initialAuthorization = await authorizationService.requireStorePermission({ principal: actor, storeId: input.storeId, permission: "finance.cash.manage" });
    requireReviewer(initialAuthorization);
    const businessDate = businessDateFor(now, store.timezone);
    try {
      return await this.repository.transaction(async (tx) => {
        const authorization = await authorizationService.requireStorePermission({ principal: actor, storeId: input.storeId, permission: "finance.cash.manage", tx, lockMembership: actor.platformRole !== "admin" });
        requireReviewer(authorization);
        if (await this.repository.lockByStoreDate(tx, input.storeId, businessDate)) throw invalidState("A cash session already exists for this store and business date.");
        const session = await this.repository.create(tx, { ...input, businessDate, actorId: actor.userId, now });
        await auditService.write({ tx, actor, storeId: input.storeId, action: "cash.session_opened", resourceType: "cash_session", resourceId: session.id, after: { businessDate, openingFloatPaise: input.openingFloatPaise, status: session.status } });
        return session;
      });
    } catch (cause) {
      if (typeof cause === "object" && cause !== null && "code" in cause && cause.code === "23505") throw invalidState("A cash session already exists for this store and business date.");
      throw cause;
    }
  }

  async recordManual(actor: AuthPrincipal, sessionId: number, input: RecordCashMovementInput, now = new Date()) {
    if (input.type === "cod_collection" || input.type === "refund") {
      throw new AppError("COD collections and refunds must come from their source workflow.", 422, "CASH_SOURCE_MOVEMENT_REQUIRED");
    }
    const identity = await this.repository.findById(sessionId);
    if (!identity) throw resourceNotFound();
    await authorizationService.requireResourceStorePermission({ principal: actor, resourceStoreId: identity.storeId, permission: "finance.cash.manage" });
    return this.repository.transaction(async (tx) => {
      const session = await this.repository.lockById(tx, sessionId);
      if (!session) throw resourceNotFound();
      const authorization = await authorizationService.requireResourceStorePermission({ principal: actor, resourceStoreId: session.storeId, permission: "finance.cash.manage", tx });
      if (session.status !== "open") throw invalidState("Closed cash sessions cannot accept movements.");
      if (input.type === "adjustment" && isMaterialVariance(input.amountPaise)) requireReviewer(authorization);
      const amountPaise = signedMovementAmount(input.type, input.amountPaise, input.direction);
      return this.addMovement(tx, session, { type: input.type, amountPaise, reason: input.reason, recordedBy: actor.userId, occurredAt: now }, actor);
    });
  }

  async close(actor: AuthPrincipal, sessionId: number, input: CloseCashSessionInput, now = new Date()) {
    const identity = await this.repository.findById(sessionId);
    if (!identity) throw resourceNotFound();
    const initialAuthorization = await authorizationService.requireResourceStorePermission({ principal: actor, resourceStoreId: identity.storeId, permission: "finance.cash.manage" });
    requireReviewer(initialAuthorization);
    return this.repository.transaction(async (tx) => {
      const session = await this.repository.lockById(tx, sessionId);
      if (!session) throw resourceNotFound();
      const authorization = await authorizationService.requireResourceStorePermission({ principal: actor, resourceStoreId: session.storeId, permission: "finance.cash.manage", tx });
      requireReviewer(authorization);
      if (session.status !== "open") throw invalidState("Cash session is already closed.");
      const variancePaise = input.countedCashPaise - session.expectedCashPaise;
      if (isMaterialVariance(variancePaise) && !input.materialVarianceAcknowledged) {
        throw new AppError("Acknowledge the material cash variance before closing.", 422, "MATERIAL_VARIANCE_ACKNOWLEDGEMENT_REQUIRED", { variancePaise });
      }
      const result = await this.repository.close(tx, session, input.countedCashPaise, input.materialVarianceAcknowledged, actor.userId, now);
      await auditService.write({ tx, actor, storeId: session.storeId, action: "cash.session_closed", resourceType: "cash_session", resourceId: session.id, before: { status: session.status }, after: { status: "closed", expectedCashPaise: session.expectedCashPaise, countedCashPaise: input.countedCashPaise, variancePaise }, metadata: { materialVarianceAcknowledged: input.materialVarianceAcknowledged } });
      const store = await this.repository.findStore(session.storeId, tx);
      await this.eventWriter.write(tx, { eventType: "cash.session_closed", schemaVersion: 1, sourceType: "cash_session", sourceId: session.id, sourceVersion: result.session.version, storeId: session.storeId, currency: "INR", occurredAt: now, businessDate: session.businessDate, timezone: store!.timezone, actorId: actor.userId, payload: { sessionId: session.id, openingFloatPaise: session.openingFloatPaise, movementTotals: await this.movementTotals(session.id, tx), expectedCashPaise: session.expectedCashPaise, countedCashPaise: input.countedCashPaise, variancePaise, closedAt: now.toISOString() } });
      return result.session;
    });
  }

  async reopen(actor: AuthPrincipal, sessionId: number, reason: string, now = new Date()) {
    const identity = await this.repository.findById(sessionId);
    if (!identity) throw resourceNotFound();
    const initialAuthorization = await authorizationService.requireResourceStorePermission({ principal: actor, resourceStoreId: identity.storeId, permission: "finance.cash.manage" });
    requireReviewer(initialAuthorization);
    return this.repository.transaction(async (tx) => {
      const session = await this.repository.lockById(tx, sessionId);
      if (!session) throw resourceNotFound();
      const authorization = await authorizationService.requireResourceStorePermission({ principal: actor, resourceStoreId: session.storeId, permission: "finance.cash.manage", tx });
      requireReviewer(authorization);
      if (session.status !== "closed") throw invalidState("Only a closed cash session can be reopened.");
      const closure = await this.repository.activeClosure(tx, session.id, session.version);
      if (!closure || closure.reversedAt) throw invalidState("The active close record cannot be reversed.");
      const updated = await this.repository.reopen(tx, session, closure.id, actor.userId, reason, now);
      const store = await this.repository.findStore(session.storeId, tx);
      await auditService.write({ tx, actor, storeId: session.storeId, action: "cash.session_reopened", resourceType: "cash_session", resourceId: session.id, before: { status: "closed", closureId: closure.id, variancePaise: closure.variancePaise }, after: { status: "open" }, metadata: { reason } });
      await this.eventWriter.write(tx, { eventType: "cash.session_reopened", schemaVersion: 1, sourceType: "cash_session", sourceId: session.id, sourceVersion: updated.version, storeId: session.storeId, currency: "INR", occurredAt: now, businessDate: session.businessDate, timezone: store!.timezone, actorId: actor.userId, payload: { sessionId: session.id, priorCloseSourceKey: `cash_session:${session.id}:cash.session_closed:${closure.sessionVersion}`, reason, authorizedActorId: actor.userId, reopenedAt: now.toISOString() } });
      return updated;
    });
  }

  async reverseMovement(actor: AuthPrincipal, movementId: number, reason: string, now = new Date()) {
    const identity = await this.repository.movement(movementId);
    if (!identity) throw resourceNotFound();
    const initialAuthorization = await authorizationService.requireResourceStorePermission({ principal: actor, resourceStoreId: identity.storeId, permission: "finance.cash.manage" });
    requireReviewer(initialAuthorization);
    return this.repository.transaction(async (tx) => {
      const session = await this.repository.lockById(tx, identity.sessionId);
      if (!session || session.storeId !== identity.storeId) throw resourceNotFound();
      const authorization = await authorizationService.requireResourceStorePermission({ principal: actor, resourceStoreId: session.storeId, permission: "finance.cash.manage", tx });
      requireReviewer(authorization);
      if (session.status !== "open") throw invalidState("Reopen the cash session before reversing a movement.");
      const movement = await this.repository.movement(movementId, tx);
      if (!movement) throw resourceNotFound();
      return this.addMovement(tx, session, { type: "adjustment", amountPaise: -movement.amountPaise, reason, reversesMovementId: movement.id, recordedBy: actor.userId, occurredAt: now }, actor);
    });
  }

  async recordCodCollection(tx: TransactionType, input: { storeId: number; orderId: number; amountPaise: number; occurredAt: Date; actorId: number | null }) {
    return this.recordSource(tx, { ...input, type: "cod_collection", recordedBy: input.actorId });
  }

  async recordCodRefund(tx: TransactionType, input: { storeId: number; refundId: number; amountPaise: number; occurredAt: Date; actorId: number }) {
    return this.recordSource(tx, { ...input, type: "refund", amountPaise: -input.amountPaise, recordedBy: input.actorId });
  }

  private async recordSource(tx: TransactionType, input: { storeId: number; type: "cod_collection" | "refund"; amountPaise: number; occurredAt: Date; recordedBy: number | null; orderId?: number; refundId?: number }) {
    const store = await this.repository.findStore(input.storeId, tx);
    if (!store) throw resourceNotFound();
    const businessDate = businessDateFor(input.occurredAt, store.timezone);
    const session = await this.repository.lockByStoreDate(tx, input.storeId, businessDate);
    if (!session || session.status !== "open") throw new AppError("Open the store cash session before recording COD activity.", 409, "OPEN_CASH_SESSION_REQUIRED", { storeId: input.storeId, businessDate });
    return this.addMovement(tx, session, input, undefined, store.timezone);
  }

  private async addMovement(tx: TransactionType, session: Awaited<ReturnType<CashRepository["lockById"]>>, input: { type: "cod_collection" | "refund" | "cash_in" | "cash_out" | "deposit" | "adjustment"; amountPaise: number; recordedBy: number | null; occurredAt: Date; reason?: string; orderId?: number; refundId?: number; reversesMovementId?: number }, actor?: AuthPrincipal, timezone?: string) {
    if (!session) throw resourceNotFound();
    const expectedCashPaise = session.expectedCashPaise + input.amountPaise;
    if (!Number.isInteger(expectedCashPaise) || expectedCashPaise < 0 || expectedCashPaise > MAX_POSTGRES_INT) throw new AppError("Movement would make expected cash invalid.", 422, "INVALID_EXPECTED_CASH");
    const movement = await this.repository.addMovement(tx, { sessionId: session.id, storeId: session.storeId, ...input });
    const updated = await this.repository.updateExpected(tx, session.id, expectedCashPaise, session.version + 1);
    const storeTimezone = timezone ?? (await this.repository.findStore(session.storeId, tx))!.timezone;
    await auditService.write({ tx, actor, storeId: session.storeId, action: input.reversesMovementId ? "cash.movement_reversed" : "cash.movement_recorded", resourceType: "cash_movement", resourceId: movement.id, after: { sessionId: session.id, type: movement.type, amountPaise: movement.amountPaise, expectedCashPaise }, metadata: { reason: movement.reason, orderId: movement.orderId, refundId: movement.refundId, reversesMovementId: movement.reversesMovementId } });
    await this.eventWriter.write(tx, { eventType: "cash.movement_recorded", schemaVersion: 1, sourceType: "cash_movement", sourceId: movement.id, sourceVersion: 1, storeId: session.storeId, currency: "INR", occurredAt: input.occurredAt, businessDate: session.businessDate, timezone: storeTimezone, actorId: input.recordedBy, payload: { movementId: movement.id, sessionId: session.id, type: movement.type, amountPaise: movement.amountPaise, orderId: movement.orderId, refundId: movement.refundId, reversesMovementId: movement.reversesMovementId, reason: movement.reason } });
    return { movement, session: updated };
  }

  private async movementTotals(sessionId: number, tx: TransactionType) {
    const movements = await this.repository.movements(sessionId, tx);
    return movements.reduce<Record<string, number>>((totals, movement) => { totals[movement.type] = (totals[movement.type] ?? 0) + movement.amountPaise; return totals; }, {});
  }
}

export default new CashService();
