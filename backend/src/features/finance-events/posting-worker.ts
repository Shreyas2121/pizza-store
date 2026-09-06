import type { FinancialOutboxEvent } from "../../db/schema";
import type { FinancialEventType } from "./financial-event.types";
import financialEventService, { FinancialEventService } from "./financial-event.service";

export interface FinancialEventProcessor {
  readonly supportedEventTypes: readonly FinancialEventType[];
  process(event: FinancialOutboxEvent): Promise<unknown>;
}

export interface PostingWorkerRunResult {
  claimed: number;
  processed: number;
  failed: number;
  leaseLost: number;
}

export class PostingWorker {
  constructor(
    private readonly processor: FinancialEventProcessor,
    private readonly events: FinancialEventService = financialEventService
  ) {}

  async runOnce(workerId: string, limit = 25, now = new Date()): Promise<PostingWorkerRunResult> {
    const claimed = await this.events.claim(
      workerId, limit, 10, now, 5 * 60_000, this.processor.supportedEventTypes
    );
    const result: PostingWorkerRunResult = { claimed: claimed.length, processed: 0, failed: 0, leaseLost: 0 };

    for (const event of claimed) {
      try {
        await this.processor.process(event);
        const finalized = await this.events.markProcessed(event.eventId, workerId, new Date());
        if (finalized) result.processed += 1;
        else result.leaseLost += 1;
      } catch (cause) {
        const failed = await this.events.markFailed({
          eventId: event.eventId,
          workerId,
          cause,
          attemptCount: event.attemptCount,
        }, new Date());
        if (failed) result.failed += 1;
        else result.leaseLost += 1;
      }
    }
    return result;
  }
}
