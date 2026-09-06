import { randomUUID } from "crypto";
import { AppError } from "../../utils/error";
import type { TransactionType } from "../../utils/types";
import { hashFinancialEvent, safeOutboxError, validateFinancialEvent } from "./financial-event.policy";
import financialEventRepository, { FinancialEventRepository } from "./financial-event.repository";
import type { FinancialEventType, FinancialEventWriter, WriteFinancialEventInput } from "./financial-event.types";

export class FinancialEventService implements FinancialEventWriter {
  constructor(private readonly repository: FinancialEventRepository = financialEventRepository) {}

  async write(tx: TransactionType, input: WriteFinancialEventInput) {
    validateFinancialEvent(input);
    const payloadHash = hashFinancialEvent(input);
    const result = await this.repository.create(tx, { ...input, eventId: randomUUID(), payloadHash });
    if (!result.event || result.event.payloadHash !== payloadHash) {
      throw new AppError("Financial event source version conflicts with existing content.", 409, "FINANCIAL_EVENT_CONFLICT");
    }
    return result.event;
  }

  claim(
    workerId: string,
    limit = 25,
    maxAttempts = 10,
    now = new Date(),
    leaseMs = 5 * 60_000,
    eventTypes?: readonly FinancialEventType[]
  ) {
    if (!workerId.trim() || !Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new AppError("Outbox claim input is invalid.", 422, "INVALID_OUTBOX_CLAIM");
    }
    if (eventTypes && eventTypes.length === 0) return Promise.resolve([]);
    return this.repository.transaction((tx) => this.repository.claim(
      tx, workerId, limit, maxAttempts, now, new Date(now.getTime() - leaseMs), eventTypes
    ));
  }

  markProcessed(eventId: string, workerId: string, now = new Date()) {
    return this.repository.transaction((tx) => this.repository.markProcessed(tx, eventId, workerId, now));
  }

  markFailed(input: { eventId: string; workerId: string; cause: unknown; attemptCount: number }, now = new Date()) {
    const delaySeconds = Math.min(3600, 2 ** Math.min(input.attemptCount, 10));
    return this.repository.transaction((tx) => this.repository.markFailed(tx, {
      eventId: input.eventId,
      workerId: input.workerId,
      error: safeOutboxError(input.cause),
      availableAt: new Date(now.getTime() + delaySeconds * 1000),
      maxAttempts: 10,
      now,
    }));
  }
}

export default new FinancialEventService();
