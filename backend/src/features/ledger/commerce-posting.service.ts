import type { FinancialOutboxEvent } from "../../db/schema";
import { AppError } from "../../utils/error";
import type { FinancialEventProcessor } from "../finance-events/posting-worker";
import ledgerService, { LedgerService } from "./ledger.service";
import {
  buildCapturedPaymentPosting,
  buildDeliveredOrderPosting,
  buildRecognitionReversal,
} from "./commerce-posting.policy";

export class CommercePostingService implements FinancialEventProcessor {
  readonly supportedEventTypes = [
    "payment_attempt.captured",
    "order.delivered",
    "order.recognition_reversed",
  ] as const;

  constructor(private readonly ledger: LedgerService = ledgerService) {}

  process(event: FinancialOutboxEvent) {
    switch (event.eventType) {
      case "payment_attempt.captured":
        return this.ledger.post(buildCapturedPaymentPosting(event));
      case "order.delivered":
        return this.ledger.post(buildDeliveredOrderPosting(event));
      case "order.recognition_reversed": {
        const command = buildRecognitionReversal(event);
        return this.ledger.reverseSource(command.originalSource, command.reversal);
      }
      default:
        throw new AppError("Financial event has no registered commerce posting rule.", 422, "POSTING_RULE_NOT_FOUND");
    }
  }
}

export default new CommercePostingService();
