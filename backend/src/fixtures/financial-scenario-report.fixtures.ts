import type { FinancialOutboxEvent } from "../db/schema";
import { buildCashClosurePosting, buildExpensePosting } from "../features/ledger/cash-expense-posting.policy";
import { buildCapturedPaymentPosting, buildDeliveredOrderPosting } from "../features/ledger/commerce-posting.policy";
import { SYSTEM_LEDGER_ACCOUNTS } from "../features/ledger/ledger.accounts";
import type { PostingCommand } from "../features/ledger/ledger.types";
import { buildPayRunPosting } from "../features/ledger/payroll-posting.policy";
import { buildDisbursedRefundPosting, buildProcessedRefundPosting, buildSettlementPosting } from "../features/ledger/refund-settlement-posting.policy";
import type { FinanceMovement } from "../features/finance-reports/finance-report.policy";
import {
  FIXTURE_EXPENSES,
  FIXTURE_ORDERS,
  FIXTURE_PAY_RUNS,
  FIXTURE_SETTLEMENTS,
} from "./financial-scenario.fixtures";

export type FixtureReportMovement = FinanceMovement & { storeId: number };

type FixturePosting = {
  storeId: number;
  businessDate: string;
  eventType: string;
  command: PostingCommand;
};

const timestamp = (businessDate: string) => new Date(`${businessDate}T12:00:00.000Z`);

const event = (input: {
  eventType: string;
  sourceType: string;
  sourceId: number | string;
  sourceVersion?: number;
  storeId: number;
  businessDate: string;
  payload: Record<string, unknown>;
  occurredAt?: Date;
}): FinancialOutboxEvent => ({
  id: 1,
  eventId: `fixture:${input.eventType}:${input.sourceId}`,
  eventType: input.eventType,
  schemaVersion: 1,
  sourceType: input.sourceType,
  sourceId: String(input.sourceId),
  sourceVersion: input.sourceVersion ?? 1,
  storeId: input.storeId,
  currency: "INR",
  occurredAt: input.occurredAt ?? timestamp(input.businessDate),
  businessDate: input.businessDate,
  timezone: "Asia/Kolkata",
  actorId: 1,
  correlationId: null,
  causationId: null,
  payload: input.payload,
  payloadHash: "a".repeat(64),
  status: "processed",
  attemptCount: 1,
  availableAt: timestamp(input.businessDate),
  claimedAt: null,
  claimedBy: null,
  processedAt: timestamp(input.businessDate),
  lastError: null,
  createdAt: timestamp(input.businessDate),
  updatedAt: timestamp(input.businessDate),
});

const posting = (source: FinancialOutboxEvent, command: PostingCommand): FixturePosting => ({
  storeId: source.storeId,
  businessDate: source.businessDate,
  eventType: source.eventType,
  command,
});

const orderPostings = (): FixturePosting[] => FIXTURE_ORDERS.flatMap((order) => {
  if (order.paymentStatus === "failed") return [];
  const captured = event({
    eventType: "payment_attempt.captured",
    sourceType: "payment_attempt",
    sourceId: order.id,
    storeId: order.storeId,
    businessDate: order.businessDate,
    occurredAt: new Date(order.placedAt),
    payload: {
      paymentAttemptId: order.id,
      orderId: order.id,
      provider: order.paymentMethod === "cod" ? "cod" : "razorpay",
      method: order.paymentMethod === "cod" ? "cash" : "upi",
      capturedPaise: order.grandTotalPaise,
      capturedAt: order.placedAt,
      providerReference: order.paymentMethod === "razorpay" ? `pay_fixture_order_${order.id}` : null,
      cashSessionId: order.paymentMethod === "cod" ? order.id : null,
    },
  });
  const deliveryTaxPaise = order.deliveryFeePaise - Math.round(order.deliveryFeePaise * 10_000 / 10_500);
  const taxableDeliveryPaise = order.deliveryFeePaise - deliveryTaxPaise;
  const discountContraPaise = order.discountPaise ? Math.round(order.discountPaise * 10_000 / 10_500) : 0;
  const delivered = event({
    eventType: "order.delivered",
    sourceType: "order",
    sourceId: order.id,
    storeId: order.storeId,
    businessDate: order.businessDate,
    occurredAt: new Date(order.placedAt),
    payload: {
      orderId: order.id,
      pricingPolicyVersion: 1,
      customerTotalPaise: order.grandTotalPaise,
      preDiscountTaxableFoodPaise: order.items.reduce((sum, item) => sum + item.taxableAmountPaise, 0) + discountContraPaise,
      discountContraPaise,
      taxableDeliveryPaise,
      itemTaxPaise: order.taxPaise - deliveryTaxPaise,
      deliveryTaxPaise,
      roundingAdjustmentPaise: order.roundingAdjustmentPaise,
      lineCostSnapshots: order.items.map((item, index) => ({
        orderItemId: order.id * 10 + index + 1,
        productId: item.productId,
        quantity: item.quantity,
        costVersionId: item.productId * 10 + (order.businessDate >= "2026-08-01" ? 2 : 1),
        unitCostPaise: Math.trunc(item.totalCostPaise / item.quantity),
        lineCostPaise: item.totalCostPaise,
      })),
      deliveredAt: order.placedAt,
    },
  });
  return [posting(captured, buildCapturedPaymentPosting(captured)), posting(delivered, buildDeliveredOrderPosting(delivered))];
});

const refundPostings = (): FixturePosting[] => {
  const order = FIXTURE_ORDERS.find((candidate) => candidate.id === 104)!;
  const processedAt = "2026-07-23T08:00:00.000Z";
  const processed = event({
    eventType: "refund.processed",
    sourceType: "refund",
    sourceId: 104,
    sourceVersion: 4,
    storeId: order.storeId,
    businessDate: "2026-07-23",
    payload: {
      refundId: 104,
      orderId: order.id,
      paymentAttemptId: order.id,
      totalPaise: order.refundPaise,
      provider: "razorpay",
      providerReference: "rfnd_fixture_order_104",
      processedAt,
      fulfilmentState: "delivered",
      recognizedAt: order.placedAt,
      allocations: [{ kind: "item", orderItemId: 1041, quantity: 1, amountPaise: 40_000, taxableAmountPaise: 38_095, taxPaise: 1_905, discountReversalPaise: 0 }],
    },
  });
  const disbursed = event({
    eventType: "refund.disbursed",
    sourceType: "refund",
    sourceId: 104,
    sourceVersion: 5,
    storeId: order.storeId,
    businessDate: "2026-07-23",
    payload: { refundId: 104, orderId: order.id, method: "razorpay", disbursedPaise: 40_000, clearingReference: "rfnd_fixture_order_104", disbursedAt: processedAt },
  });
  return [posting(processed, buildProcessedRefundPosting(processed)), posting(disbursed, buildDisbursedRefundPosting(disbursed))];
};

const settlementPostings = (): FixturePosting[] => FIXTURE_SETTLEMENTS.map((settlement, index) => {
  const source = event({
    eventType: "settlement.reconciled",
    sourceType: "settlement_batch",
    sourceId: index + 1,
    storeId: settlement.storeId,
    businessDate: settlement.businessDate,
    occurredAt: new Date(settlement.settledAt),
    payload: {
      batchId: index + 1,
      providerSettlementId: settlement.id,
      grossAmountPaise: settlement.grossAmountPaise,
      netAmountPaise: settlement.netPayoutPaise,
      feePaise: settlement.gatewayFeePaise,
      feeTaxPaise: settlement.gatewayTaxPaise,
      adjustmentPaise: -settlement.refundsDeductedPaise,
      refundDeductionPaise: settlement.refundsDeductedPaise,
      adjustments: [],
      lineMatches: [
        ...settlement.matchedOrderIds.map((orderId, lineIndex) => ({ settlementLineId: index * 10 + lineIndex + 1, matchStatus: "matched" as const, paymentAttemptId: orderId, refundId: null })),
        ...(settlement.refundsDeductedPaise ? [{ settlementLineId: index * 10 + 9, matchStatus: "matched" as const, paymentAttemptId: null, refundId: 104 }] : []),
      ],
      utr: `UTR-${settlement.id}`,
      providerReference: `fixture-${settlement.id}`,
      settledAt: settlement.settledAt,
    },
  });
  return posting(source, buildSettlementPosting(source));
});

const expensePostings = (): FixturePosting[] => FIXTURE_EXPENSES.map((expense) => {
  const source = event({
    eventType: "expense.posted",
    sourceType: "expense",
    sourceId: expense.id,
    sourceVersion: 5,
    storeId: expense.storeId,
    businessDate: expense.businessDate,
    payload: {
      expenseId: expense.id,
      totalPaise: expense.amountPaise + expense.taxPaise,
      paymentMethod: expense.paymentMethod === "petty_cash" ? "cash" : "bank_transfer",
      paymentReference: `DEMO-EXP-${expense.id}`,
      paidAt: timestamp(expense.businessDate).toISOString(),
      postedAt: timestamp(expense.businessDate).toISOString(),
      allocations: [{ storeId: expense.storeId, categoryId: expense.id, ledgerAccountId: 21, ledgerAccountCode: "6900", costCenter: `STORE-${expense.storeId}`, amountPaise: expense.amountPaise + expense.taxPaise }],
    },
  });
  return posting(source, buildExpensePosting(source));
});

const payrollPostings = (): FixturePosting[] => FIXTURE_PAY_RUNS.map((run) => {
  const periodStart = `${run.month}-01`;
  const periodEnd = run.month === "2026-07" ? "2026-07-31" : "2026-08-31";
  const source = event({
    eventType: "pay_run.posted",
    sourceType: "pay_run",
    sourceId: run.id,
    sourceVersion: 5,
    storeId: run.storeId,
    businessDate: run.businessDate,
    payload: {
      payRunId: run.id,
      periodStart,
      periodEnd,
      grossPayPaise: run.totalGrossPayPaise,
      deductionPaise: run.totalDeductionsPaise,
      netPayPaise: run.totalNetPayPaise,
      employerCostPaise: 0,
      totalEmployerCostPaise: run.totalGrossPayPaise,
      paymentReferenceRecorded: true,
      postedAt: timestamp(run.businessDate).toISOString(),
    },
  });
  return posting(source, buildPayRunPosting(source));
});

const cashVariancePosting = (): FixturePosting => {
  const source = event({ eventType: "cash.session_closed", sourceType: "cash_session", sourceId: 102, sourceVersion: 2, storeId: 1, businessDate: "2026-07-12", payload: { sessionId: 102, variancePaise: -1_000, closedAt: "2026-07-12T20:00:00.000Z" } });
  return posting(source, buildCashClosurePosting(source)!);
};

export const FIXTURE_REPORT_POSTINGS: FixturePosting[] = [
  ...orderPostings(),
  ...refundPostings(),
  ...settlementPostings(),
  ...expensePostings(),
  ...payrollPostings(),
  cashVariancePosting(),
];

export const FIXTURE_REPORT_MOVEMENTS: FixtureReportMovement[] = (() => {
  const accountByCode = new Map<string, (typeof SYSTEM_LEDGER_ACCOUNTS)[number]>(SYSTEM_LEDGER_ACCOUNTS.map((account) => [account.code, account]));
  const grouped = new Map<string, FixtureReportMovement>();
  for (const postingRow of FIXTURE_REPORT_POSTINGS) {
    for (const line of postingRow.command.lines) {
      const account = accountByCode.get(line.accountCode)!;
      const key = `${postingRow.storeId}:${postingRow.businessDate}:${line.accountCode}`;
      const current = grouped.get(key) ?? { storeId: postingRow.storeId, businessDate: postingRow.businessDate, accountCode: account.code, accountName: account.name, accountType: account.type, debitPaise: "0", creditPaise: "0" };
      current.debitPaise = (BigInt(current.debitPaise) + BigInt(line.side === "debit" ? line.amountPaise : 0)).toString();
      current.creditPaise = (BigInt(current.creditPaise) + BigInt(line.side === "credit" ? line.amountPaise : 0)).toString();
      grouped.set(key, current);
    }
  }
  return [...grouped.values()].sort((left, right) => `${left.businessDate}:${left.accountCode}`.localeCompare(`${right.businessDate}:${right.accountCode}`));
})();

export const fixtureCollections = (storeIds: number[], from: string, to: string) => FIXTURE_ORDERS
  .filter((order) => order.paymentStatus !== "failed" && storeIds.includes(order.storeId) && order.businessDate >= from && order.businessDate <= to)
  .reduce((sum, order) => sum + order.grandTotalPaise, 0)
  .toString();

export const fixtureUnsettledRazorpay = (storeIds: number[], asOf: string) => FIXTURE_REPORT_MOVEMENTS
  .filter((row) => storeIds.includes(row.storeId) && row.businessDate <= asOf && row.accountCode === "1100")
  .reduce((sum, row) => sum + BigInt(row.debitPaise) - BigInt(row.creditPaise), 0n)
  .toString();
