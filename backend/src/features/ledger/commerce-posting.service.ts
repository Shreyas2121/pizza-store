import type { FinancialOutboxEvent } from "../../db/schema";
import { AppError } from "../../utils/error";
import type { FinancialEventProcessor } from "../finance-events/posting-worker";
import ledgerService, { LedgerService } from "./ledger.service";
import {
  buildCapturedPaymentPosting,
  buildDeliveredOrderPosting,
  buildRecognitionReversal,
} from "./commerce-posting.policy";
import {
  buildDisbursedRefundPosting,
  buildProcessedRefundPosting,
  buildSettlementPosting,
} from "./refund-settlement-posting.policy";
import {
  buildCashClosurePosting,
  buildCashMovementPosting,
  buildCashReopenReversal,
  buildExpensePosting,
  buildExpenseReversal,
} from "./cash-expense-posting.policy";
import { buildPayRunPosting, buildPayRunReversal } from "./payroll-posting.policy";

export class CommercePostingService implements FinancialEventProcessor {
  readonly supportedEventTypes = [
    "payment_attempt.captured",
    "order.delivered",
    "order.recognition_reversed",
    "refund.processed",
    "refund.failed",
    "refund.disbursed",
    "settlement.reconciled",
    "cash.movement_recorded",
    "cash.session_closed",
    "cash.session_reopened",
    "expense.paid",
    "expense.posted",
    "expense.voided",
    "expense.reversed",
    "pay_run.posted",
    "pay_run.reversed",
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
      case "refund.processed":
        return this.ledger.post(buildProcessedRefundPosting(event));
      case "refund.disbursed":
        return this.ledger.post(buildDisbursedRefundPosting(event));
      case "settlement.reconciled":
        return this.ledger.post(buildSettlementPosting(event));
      case "cash.movement_recorded": {
        const command = buildCashMovementPosting(event);
        if (!command) return Promise.resolve({ posted: false as const });
        return "reversal" in command
          ? this.ledger.reverseSource(command.originalSource, command.reversal)
          : this.ledger.post(command);
      }
      case "cash.session_closed": {
        const command = buildCashClosurePosting(event);
        return command ? this.ledger.post(command) : Promise.resolve({ posted: false as const });
      }
      case "cash.session_reopened": {
        const command = buildCashReopenReversal(event);
        return command ? this.ledger.reverseSource(command.originalSource, command.reversal) : Promise.resolve({ posted: false as const });
      }
      case "expense.posted":
        return this.ledger.post(buildExpensePosting(event));
      case "expense.reversed": {
        const command = buildExpenseReversal(event);
        return this.ledger.reverseSource(command.originalSource, command.reversal);
      }
      case "pay_run.posted":
        return this.ledger.post(buildPayRunPosting(event));
      case "pay_run.reversed": {
        const command = buildPayRunReversal(event);
        return this.ledger.reverseSource(command.originalSource, command.reversal);
      }
      case "refund.failed":
      case "expense.paid":
      case "expense.voided":
        return Promise.resolve({ posted: false as const });
      default:
        throw new AppError("Financial event has no registered commerce posting rule.", 422, "POSTING_RULE_NOT_FOUND");
    }
  }
}

export default new CommercePostingService();
