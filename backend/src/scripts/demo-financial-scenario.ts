import { createHash } from "crypto";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  cashMovementsTable,
  cashSessionClosuresTable,
  cashSessionsTable,
  compensationComponentsTable,
  compensationVersionsTable,
  promotionsTable,
  promotionApplicationsTable,
  promotionDiscountAllocationsTable,
  deliveryPricingRulesTable,
  employeeFinanceProfilesTable,
  expenseAllocationsTable,
  expenseCategoriesTable,
  expensesTable,
  financialOutboxTable,
  fiscalPeriodsTable,
  journalEntriesTable,
  journalLinesTable,
  ledgerAccountsTable,
  orderItemsTable,
  ordersTable,
  paymentAttemptsTable,
  paymentsTable,
  payRunEmployeesTable,
  payRunLinesTable,
  payRunsTable,
  productCostVersionsTable,
  productsTable,
  refundAllocationsTable,
  refundsTable,
  settlementBatchesTable,
  settlementLinesTable,
  storeProductsTable,
  taxRulesTable,
} from "../db/schema";
import {
  EXPECTED_CONSOLIDATED_TWO_MONTH_TOTAL,
  EXPECTED_LEDGER_REPORT_CONSOLIDATED_TWO_MONTH_TOTAL,
  EXPECTED_STORE_MONTH_SUMMARIES,
  FIXTURE_EMPLOYEES,
  FIXTURE_EXPENSES,
  FIXTURE_ORDERS,
  FIXTURE_PAY_RUNS,
  FIXTURE_SETTLEMENTS,
  FIXTURE_STANDARD_COSTS,
} from "../fixtures/financial-scenario.fixtures";
import { hashPostingCommand, validatePostingCommand } from "../features/ledger/ledger.policy";
import type { PostingCommand } from "../features/ledger/ledger.types";
import { buildCapturedPaymentPosting, buildDeliveredOrderPosting } from "../features/ledger/commerce-posting.policy";
import { buildCashClosurePosting, buildExpensePosting } from "../features/ledger/cash-expense-posting.policy";
import { buildPayRunPosting } from "../features/ledger/payroll-posting.policy";
import { buildDisbursedRefundPosting, buildProcessedRefundPosting, buildSettlementPosting } from "../features/ledger/refund-settlement-posting.policy";
import { hashFinancialEvent } from "../features/finance-events/financial-event.policy";
import type { FinancialEventType, WriteFinancialEventInput } from "../features/finance-events/financial-event.types";
import type { TransactionType } from "../utils/types";
import { buildDeliveredOrderPayload } from "../features/finance-events/order-recognition.payload";
import { calculateInclusiveTax } from "../utils/money";
import { PRICING_POLICY_VERSION } from "../features/pricing";

const SEEDED_AT = new Date("2026-09-01T06:00:00.000Z");
const HASH = createHash("sha256").update("pizzastore-deterministic-finance-demo").digest("hex");

type DemoScenarioInput = {
  adminId: number;
  customerId: number;
  storeIds: [number, number];
};

export type DemoScenarioResult = {
  reportingPeriods: ["2026-07", "2026-08"];
  orderIds: Record<number, number>;
  paymentAttemptIds: Record<number, number>;
  refundId: number;
  settlementIds: Record<string, number>;
  cashSessionId: number;
  expenseIds: Record<number, number>;
  payRunIds: Record<number, number>;
  journalCount: number;
  expected: typeof EXPECTED_CONSOLIDATED_TWO_MONTH_TOTAL;
};

const productSlugByFixtureId: Record<number, string> = {
  10: "margherita-pizza",
  20: "pepperoni-feast",
  30: "veggie-supreme",
  40: "garlic-breadsticks",
  50: "coca-cola",
};

const isoDateTime = (businessDate: string, hour = 12) => new Date(`${businessDate}T${String(hour).padStart(2, "0")}:00:00.000Z`);

const seedEvent = async (
  tx: TransactionType,
  input: WriteFinancialEventInput,
  command?: PostingCommand | null,
) => {
  const eventId = `demo:${input.eventType}:${input.storeId}:${input.sourceId}:${input.sourceVersion}`;
  const payloadHash = hashFinancialEvent(input);
  const [event] = await tx.insert(financialOutboxTable).values({
    ...input,
    sourceId: String(input.sourceId),
    eventId,
    payloadHash,
    status: "processed",
    attemptCount: 1,
    availableAt: input.occurredAt,
    processedAt: input.occurredAt,
    createdAt: SEEDED_AT,
    updatedAt: SEEDED_AT,
  }).returning();

  if (!command) return undefined;
  validatePostingCommand(command);
  const debit = command.lines.reduce((sum, line) => sum + (line.side === "debit" ? line.amountPaise : 0), 0);
  const credit = command.lines.reduce((sum, line) => sum + (line.side === "credit" ? line.amountPaise : 0), 0);
  if (debit !== credit) throw new Error(`Demo journal for ${eventId} is not balanced.`);

  const codes = [...new Set(command.lines.map((line) => line.accountCode))];
  const accounts = await tx.select().from(ledgerAccountsTable).where(inArray(ledgerAccountsTable.code, codes));
  const accountByCode = new Map(accounts.map((account) => [account.code, account.id]));
  if (accountByCode.size !== codes.length) throw new Error(`Demo journal for ${eventId} references a missing account.`);

  const [entry] = await tx.insert(journalEntriesTable).values({
    storeId: command.storeId,
    journalNumber: `DEMO-${String(event.id).padStart(4, "0")}`,
    businessDate: command.businessDate,
    occurredAt: command.occurredAt,
    description: command.description,
    currency: command.currency,
    sourceType: command.source.sourceType,
    sourceId: String(command.source.sourceId),
    eventType: command.source.eventType,
    sourceVersion: command.source.sourceVersion,
    commandHash: hashPostingCommand(command),
    status: "posted",
    postedBy: command.postedBy ?? null,
    postedAt: command.occurredAt,
    createdAt: SEEDED_AT,
    updatedAt: SEEDED_AT,
  }).returning({ id: journalEntriesTable.id });
  await tx.insert(journalLinesTable).values(command.lines.map((line, index) => ({
    journalEntryId: entry.id,
    lineNumber: index + 1,
    accountId: accountByCode.get(line.accountCode)!,
    debitPaise: line.side === "debit" ? line.amountPaise : 0,
    creditPaise: line.side === "credit" ? line.amountPaise : 0,
    description: line.description ?? null,
    orderId: line.orderId ?? null,
    paymentAttemptId: line.paymentAttemptId ?? null,
    refundId: line.refundId ?? null,
    expenseId: line.expenseId ?? null,
    payRunId: line.payRunId ?? null,
    dimensions: line.metadata ?? {},
    createdAt: SEEDED_AT,
  })));
  return entry.id;
};

const eventInput = (values: {
  eventType: FinancialEventType;
  sourceType: string;
  sourceId: number | string;
  sourceVersion?: number;
  storeId: number;
  businessDate: string;
  occurredAt?: Date;
  actorId: number;
  payload: Record<string, unknown>;
}): WriteFinancialEventInput => ({
  eventType: values.eventType,
  schemaVersion: 1,
  sourceType: values.sourceType,
  sourceId: values.sourceId,
  sourceVersion: values.sourceVersion ?? 1,
  storeId: values.storeId,
  currency: "INR",
  occurredAt: values.occurredAt ?? isoDateTime(values.businessDate),
  businessDate: values.businessDate,
  timezone: "Asia/Kolkata",
  actorId: values.actorId,
  correlationId: `demo:${values.sourceType}:${values.sourceId}`,
  payload: values.payload,
});

const asEvent = (input: WriteFinancialEventInput) => ({
  id: 1,
  eventId: "demo-preview",
  ...input,
  sourceId: String(input.sourceId),
  actorId: input.actorId ?? null,
  correlationId: input.correlationId ?? null,
  causationId: input.causationId ?? null,
  payloadHash: HASH,
  status: "processed" as const,
  attemptCount: 1,
  availableAt: input.occurredAt,
  claimedAt: null,
  claimedBy: null,
  processedAt: input.occurredAt,
  lastError: null,
  createdAt: SEEDED_AT,
  updatedAt: SEEDED_AT,
});

export async function seedDemoFinancialScenario(input: DemoScenarioInput): Promise<DemoScenarioResult> {
  return db.transaction(async (tx) => {
    const stores = input.storeIds;
    const rules = await tx.select().from(taxRulesTable).where(inArray(taxRulesTable.storeId, stores));
    const deliveryRules = await tx.select().from(deliveryPricingRulesTable).where(inArray(deliveryPricingRulesTable.storeId, stores));
    const products = await tx.select({ id: productsTable.id, slug: productsTable.slug }).from(productsTable);
    const productIdBySlug = new Map(products.map((product) => [product.slug, product.id]));
    const productIdByFixtureId = new Map(Object.entries(productSlugByFixtureId).map(([fixtureId, slug]) => [Number(fixtureId), productIdBySlug.get(slug)!]));
    const storeProducts = await tx.select().from(storeProductsTable).where(inArray(storeProductsTable.storeId, stores));
    const storeProductByKey = new Map(storeProducts.map((row) => [`${row.storeId}:${row.productId}`, row]));

    for (const storeId of stores) {
      for (const cost of FIXTURE_STANDARD_COSTS) {
        const productId = productIdByFixtureId.get(cost.productId)!;
        const storeProduct = storeProductByKey.get(`${storeId}:${productId}`)!;
        await tx.insert(productCostVersionsTable).values({
          storeProductId: storeProduct.id,
          storeId,
          unitCostPaise: cost.unitCostPaise,
          effectiveFrom: cost.effectiveFrom,
          effectiveTo: cost.effectiveTo,
          source: "financial_scenario_fixture",
          createdBy: input.adminId,
          createdAt: SEEDED_AT,
        }).onConflictDoUpdate({
          target: [productCostVersionsTable.storeProductId, productCostVersionsTable.effectiveFrom],
          set: { unitCostPaise: cost.unitCostPaise, effectiveTo: cost.effectiveTo, source: "financial_scenario_fixture" },
        });
      }
    }
    const costs = await tx.select().from(productCostVersionsTable)
      .where(inArray(productCostVersionsTable.storeId, stores)).orderBy(asc(productCostVersionsTable.effectiveFrom));

    const [coupon] = await tx.insert(promotionsTable).values({
      code: "PIZZA50",
      kind: "coupon",
      name: "Finance fixture PIZZA50",
      description: "Deterministic finance demonstration coupon",
      scope: "cart",
      discountType: "fixed_amount",
      discountAmountPaise: 5_000,
      minimumOrderPaise: 40_000,
      startsAt: new Date("2026-07-01T00:00:00.000Z"),
      endsAt: new Date("2026-08-31T23:59:59.000Z"),
      isActive: true,
      maxRedemptions: 1,
      createdAt: SEEDED_AT,
      updatedAt: SEEDED_AT,
    }).returning();

    const orderIds: Record<number, number> = {};
    const orderSnapshots = new Map<number, typeof ordersTable.$inferSelect>();
    const paymentAttemptIds: Record<number, number> = {};
    const orderItemIds = new Map<string, number>();
    const orderItemCostVersionIds = new Map<string, number>();
    const orderItemTaxRates = new Map<string, number>();
    for (const fixture of FIXTURE_ORDERS) {
      const storeId = stores[fixture.storeId - 1];
      const itemRule = rules.find((rule) => rule.storeId === storeId && rule.component === "item")!;
      const deliveryRule = rules.find((rule) => rule.storeId === storeId && rule.component === "delivery")!;
      const pricingRule = deliveryRules.find((rule) => rule.storeId === storeId)!;
      const paymentTime = new Date(fixture.placedAt);
      const [payment] = await tx.insert(paymentsTable).values({
        provider: fixture.paymentMethod === "cod" ? "cod" : "razorpay",
        status: fixture.paymentStatus,
        providerStatus: fixture.paymentStatus === "completed" || fixture.paymentStatus === "refunded" ? "captured" : "failed",
        amountPaise: fixture.grandTotalPaise,
        currency: "INR",
        providerOrderId: fixture.paymentMethod === "razorpay" ? `order_fixture_${fixture.id}` : null,
        providerPaymentId: fixture.paymentMethod === "razorpay" && fixture.paymentStatus !== "failed" ? `pay_fixture_order_${fixture.id}` : null,
        clientRequestId: `demo-payment-${fixture.id}`,
        failureCode: fixture.paymentStatus === "failed" ? "DEMO_PAYMENT_DECLINED" : null,
        failureDescription: fixture.paymentStatus === "failed" ? "Deterministic failed payment attempt" : null,
        paidAt: fixture.paymentStatus === "failed" ? null : paymentTime,
        failedAt: fixture.paymentStatus === "failed" ? paymentTime : null,
        paymentDate: fixture.paymentStatus === "failed" ? null : paymentTime,
        createdAt: SEEDED_AT,
        updatedAt: SEEDED_AT,
      }).returning();
      const { taxableAmountPaise: deliveryTaxable, taxPaise: deliveryTax } = calculateInclusiveTax(fixture.deliveryFeePaise, deliveryRule.rateBps);
      const deliveredAt = fixture.status === "delivered" ? new Date(fixture.placedAt) : null;
      const [order] = await tx.insert(ordersTable).values({
        userId: input.customerId,
        orderDate: new Date(fixture.placedAt),
        discountMode: fixture.couponCode ? "coupon" : "none",
        itemsSubtotalPaise: fixture.itemsSubtotalPaise,
        discountPaise: fixture.discountPaise,
        deliveryFeePaise: fixture.deliveryFeePaise,
        taxableAmountPaise: fixture.taxableAmountPaise,
        taxPaise: fixture.taxPaise,
        roundingAdjustmentPaise: fixture.roundingAdjustmentPaise,
        grandTotalPaise: fixture.grandTotalPaise,
        currency: "INR",
        quoteVersion: `finance-fixture:${fixture.orderNumber}`,
        pricingPolicyVersion: PRICING_POLICY_VERSION,
        deliveryPricingRuleId: pricingRule.id,
        deliveryPricingRuleVersion: pricingRule.version,
        pricingBusinessDate: fixture.businessDate,
        pricingTimezone: "Asia/Kolkata",
        taxCalculationPolicyVersion: 1,
        taxDisclaimer: itemRule.disclaimer,
        taxIsDemo: true,
        placeOfSupplyState: "Karnataka",
        deliveryTaxRuleId: deliveryRule.id,
        deliveryTaxRuleVersion: deliveryRule.version,
        deliveryTaxRateBps: deliveryRule.rateBps,
        deliveryTaxableAmountPaise: deliveryTaxable,
        deliveryTaxPaise: deliveryTax,
        deliveryHsnSacCode: deliveryRule.hsnSacCode,
        recognizedAt: deliveredAt,
        deliveredAt,
        cancelledAt: fixture.status === "cancelled" ? paymentTime : null,
        status: fixture.status,
        paymentType: fixture.paymentMethod === "cod" ? "cash" : "razorpay",
        paymentId: payment.id,
        storeId,
        createdAt: SEEDED_AT,
        updatedAt: SEEDED_AT,
      }).returning();
      orderIds[fixture.id] = order.id;
      orderSnapshots.set(fixture.id, order);

      for (let index = 0; index < fixture.items.length; index += 1) {
        const item = fixture.items[index];
        const productId = productIdByFixtureId.get(item.productId)!;
        const storeProduct = storeProductByKey.get(`${storeId}:${productId}`)!;
        const applicableCosts = costs.filter((cost) => cost.storeProductId === storeProduct.id && cost.effectiveFrom <= fixture.businessDate && (!cost.effectiveTo || cost.effectiveTo >= fixture.businessDate));
        const costVersion = applicableCosts.at(-1)!;
        const [saved] = await tx.insert(orderItemsTable).values({
          orderId: order.id,
          productId,
          quantity: item.quantity,
          productName: item.productName + (item.customizationName ? ` + ${item.customizationName}` : ""),
          unitPricePaise: Math.trunc(item.lineSubtotalPaise / item.quantity),
          lineSubtotalPaise: item.lineSubtotalPaise,
          discountAllocationPaise: item.discountAllocationPaise,
          taxRuleId: itemRule.id,
          taxRuleVersion: itemRule.version,
          taxRateBps: itemRule.rateBps,
          taxableAmountPaise: item.taxableAmountPaise,
          taxPaise: item.taxPaise,
          lineTotalPaise: item.lineTotalPaise,
          unitCostPaise: fixture.status === "delivered" ? Math.trunc(item.totalCostPaise / item.quantity) : null,
          lineCostPaise: fixture.status === "delivered" ? item.totalCostPaise : null,
          costVersionId: fixture.status === "delivered" ? costVersion.id : null,
          hsnSacCode: itemRule.hsnSacCode,
          createdAt: SEEDED_AT,
          updatedAt: SEEDED_AT,
        }).returning();
        orderItemIds.set(`${fixture.id}:${index}`, saved.id);
        orderItemCostVersionIds.set(`${fixture.id}:${index}`, costVersion.id);
        orderItemTaxRates.set(`${fixture.id}:${index}`, saved.taxRateBps);
      }

      if (fixture.couponCode) {
        const [application] = await tx.insert(promotionApplicationsTable).values({
          promotionId: coupon.id, orderId: order.id, userId: input.customerId, storeId,
          promotionKind: coupon.kind, promotionName: coupon.name, promotionCode: coupon.code,
          discountType: coupon.discountType, definitionVersion: coupon.definitionVersion,
          status: "consumed", consumedAt: paymentTime,
          itemDiscountPaise: fixture.discountPaise, deliveryDiscountPaise: 0,
          totalSavingsPaise: fixture.discountPaise,
          standardDeliveryFeePaise: fixture.deliveryFeePaise, chargedDeliveryFeePaise: fixture.deliveryFeePaise,
          createdAt: SEEDED_AT, updatedAt: SEEDED_AT,
        }).returning();
        await tx.insert(promotionDiscountAllocationsTable).values(fixture.items.flatMap((item, index) =>
          item.discountAllocationPaise ? [{
            promotionApplicationId: application.id, orderItemId: orderItemIds.get(`${fixture.id}:${index}`)!,
            component: "item" as const, unitIndex: 0, amountPaise: item.discountAllocationPaise, createdAt: SEEDED_AT,
          }] : []));
      }

      const captured = fixture.paymentStatus !== "failed";
      const [attempt] = await tx.insert(paymentAttemptsTable).values({
        orderId: order.id,
        storeId,
        provider: fixture.paymentMethod === "cod" ? "cod" : "razorpay",
        method: fixture.paymentMethod === "cod" ? "cash" : "upi",
        status: captured ? "captured" : "failed",
        providerStatus: captured ? "captured" : "failed",
        amountPaise: fixture.grandTotalPaise,
        currency: "INR",
        providerOrderId: fixture.paymentMethod === "razorpay" ? `attempt_order_fixture_${fixture.id}` : null,
        providerPaymentId: fixture.paymentMethod === "razorpay" && captured ? `pay_fixture_order_${fixture.id}` : null,
        clientRequestId: `demo-attempt-${fixture.id}`,
        failureCode: captured ? null : "DEMO_PAYMENT_DECLINED",
        failureDescription: captured ? null : "Deterministic failed payment attempt",
        capturedAt: captured ? paymentTime : null,
        failedAt: captured ? null : paymentTime,
        createdAt: SEEDED_AT,
        updatedAt: SEEDED_AT,
      }).returning();
      paymentAttemptIds[fixture.id] = attempt.id;
    }

    const cashSessionByOrder = new Map<number, number>();
    let varianceCashSessionId = 0;
    for (const cashOrder of FIXTURE_ORDERS.filter((order) => order.paymentMethod === "cod")) {
      const cashStoreId = stores[cashOrder.storeId - 1];
      const hasVariance = cashOrder.id === 102;
      const openingFloatPaise = 10_000;
      const expectedCashPaise = openingFloatPaise + cashOrder.grandTotalPaise;
      const countedCashPaise = expectedCashPaise - (hasVariance ? 1_000 : 0);
      const [cashSession] = await tx.insert(cashSessionsTable).values({
        storeId: cashStoreId,
        businessDate: cashOrder.businessDate,
        status: "closed",
        currency: "INR",
        openingFloatPaise,
        expectedCashPaise,
        countedCashPaise,
        variancePaise: countedCashPaise - expectedCashPaise,
        materialVarianceAcknowledged: false,
        version: 2,
        openedBy: input.adminId,
        openedAt: isoDateTime(cashOrder.businessDate, 4),
        closedBy: input.adminId,
        closedAt: isoDateTime(cashOrder.businessDate, 22),
        createdAt: SEEDED_AT,
        updatedAt: SEEDED_AT,
      }).returning();
      cashSessionByOrder.set(cashOrder.id, cashSession.id);
      if (hasVariance) varianceCashSessionId = cashSession.id;
      await tx.insert(cashMovementsTable).values({
        sessionId: cashSession.id,
        storeId: cashStoreId,
        type: "cod_collection",
        amountPaise: cashOrder.grandTotalPaise,
        orderId: orderIds[cashOrder.id],
        recordedBy: input.adminId,
        occurredAt: isoDateTime(cashOrder.businessDate, 19),
        createdAt: SEEDED_AT,
      });
      await tx.insert(cashSessionClosuresTable).values({
        sessionId: cashSession.id,
        storeId: cashStoreId,
        sessionVersion: 2,
        expectedCashPaise,
        countedCashPaise,
        variancePaise: countedCashPaise - expectedCashPaise,
        materialVarianceAcknowledged: false,
        closedBy: input.adminId,
        closedAt: isoDateTime(cashOrder.businessDate, 22),
        createdAt: SEEDED_AT,
      });
    }

    let journalCount = 0;
    for (const fixture of FIXTURE_ORDERS) {
      const storeId = stores[fixture.storeId - 1];
      if (fixture.paymentStatus === "failed") {
        await seedEvent(tx, eventInput({ eventType: "payment_attempt.failed", sourceType: "payment_attempt", sourceId: paymentAttemptIds[fixture.id], storeId, businessDate: fixture.businessDate, occurredAt: new Date(fixture.placedAt), actorId: input.adminId, payload: { paymentAttemptId: paymentAttemptIds[fixture.id], orderId: orderIds[fixture.id], failureCode: "DEMO_PAYMENT_DECLINED" } }));
        continue;
      }
      const capture = eventInput({ eventType: "payment_attempt.captured", sourceType: "payment_attempt", sourceId: paymentAttemptIds[fixture.id], storeId, businessDate: fixture.businessDate, occurredAt: new Date(fixture.placedAt), actorId: input.adminId, payload: { paymentAttemptId: paymentAttemptIds[fixture.id], orderId: orderIds[fixture.id], provider: fixture.paymentMethod === "cod" ? "cod" : "razorpay", method: fixture.paymentMethod === "cod" ? "cash" : "upi", capturedPaise: fixture.grandTotalPaise, capturedAt: fixture.placedAt, providerReference: fixture.paymentMethod === "razorpay" ? `pay_fixture_order_${fixture.id}` : null, cashSessionId: fixture.paymentMethod === "cod" ? cashSessionByOrder.get(fixture.id) : null } });
      if (await seedEvent(tx, capture, buildCapturedPaymentPosting(asEvent(capture)))) journalCount += 1;
      const lineCostSnapshots = fixture.items.map((item, index) => ({
        orderItemId: orderItemIds.get(`${fixture.id}:${index}`)!,
        productId: productIdByFixtureId.get(item.productId)!,
        quantity: item.quantity,
        costVersionId: orderItemCostVersionIds.get(`${fixture.id}:${index}`)!,
        unitCostPaise: Math.trunc(item.totalCostPaise / item.quantity),
        lineCostPaise: item.totalCostPaise,
        lineSubtotalPaise: item.lineSubtotalPaise,
        discountAllocationPaise: item.discountAllocationPaise,
        taxableAmountPaise: item.taxableAmountPaise,
        taxPaise: item.taxPaise,
        taxRateBps: orderItemTaxRates.get(`${fixture.id}:${index}`)!,
      }));
      const deliveredAt = new Date(fixture.placedAt);
      const delivery = eventInput({
        eventType: "order.delivered", sourceType: "order", sourceId: orderIds[fixture.id],
        storeId, businessDate: fixture.businessDate, occurredAt: deliveredAt, actorId: input.adminId,
        payload: buildDeliveredOrderPayload(orderSnapshots.get(fixture.id)!, lineCostSnapshots, deliveredAt),
      });
      if (await seedEvent(tx, delivery, buildDeliveredOrderPosting(asEvent(delivery)))) journalCount += 1;
    }

    const refundedOrder = FIXTURE_ORDERS.find((order) => order.refundPaise)!;
    const refundedStoreId = stores[refundedOrder.storeId - 1];
    const refundTime = new Date("2026-07-23T08:00:00.000Z");
    const refundItemId = orderItemIds.get(`${refundedOrder.id}:0`)!;
    const [refund] = await tx.insert(refundsTable).values({
      orderId: orderIds[refundedOrder.id], paymentAttemptId: paymentAttemptIds[refundedOrder.id], storeId: refundedStoreId,
      amountPaise: refundedOrder.refundPaise!, currency: "INR", status: "processed", reasonCode: "DAMAGED_ITEM", reasonNote: refundedOrder.refundReason,
      clientRequestId: `demo-refund-${refundedOrder.id}`, providerRefundId: `rfnd_fixture_order_${refundedOrder.id}`, providerStatus: "processed", version: 4,
      requestedBy: input.adminId, approvedBy: input.adminId, submittedBy: input.adminId, processedBy: input.adminId,
      requestedAt: refundTime, approvedAt: refundTime, submittedAt: refundTime, processedAt: refundTime, createdAt: SEEDED_AT, updatedAt: SEEDED_AT,
    }).returning();
    const [refundAllocation] = await tx.insert(refundAllocationsTable).values({
      refundId: refund.id, orderId: orderIds[refundedOrder.id], kind: "item", orderItemId: refundItemId, quantity: 1,
      amountPaise: refundedOrder.refundPaise!, taxableAmountPaise: 38_095, taxPaise: 1_905, discountReversalPaise: 0, createdAt: SEEDED_AT,
    }).returning();
    const processedRefund = eventInput({ eventType: "refund.processed", sourceType: "refund", sourceId: refund.id, sourceVersion: 4, storeId: refundedStoreId, businessDate: "2026-07-23", occurredAt: refundTime, actorId: input.adminId, payload: { refundId: refund.id, orderId: orderIds[refundedOrder.id], paymentAttemptId: paymentAttemptIds[refundedOrder.id], totalPaise: refundedOrder.refundPaise!, provider: "razorpay", providerReference: `rfnd_fixture_order_${refundedOrder.id}`, processedAt: refundTime.toISOString(), fulfilmentState: "delivered", recognizedAt: refundedOrder.placedAt, allocations: [{ kind: "item", orderItemId: refundItemId, quantity: 1, amountPaise: refundAllocation.amountPaise, taxableAmountPaise: refundAllocation.taxableAmountPaise, taxPaise: refundAllocation.taxPaise, discountReversalPaise: 0 }] } });
    if (await seedEvent(tx, processedRefund, buildProcessedRefundPosting(asEvent(processedRefund)))) journalCount += 1;
    const disbursedRefund = eventInput({ eventType: "refund.disbursed", sourceType: "refund", sourceId: refund.id, sourceVersion: 5, storeId: refundedStoreId, businessDate: "2026-07-23", occurredAt: refundTime, actorId: input.adminId, payload: { refundId: refund.id, orderId: orderIds[refundedOrder.id], method: "razorpay", disbursedPaise: refundedOrder.refundPaise!, clearingReference: `rfnd_fixture_order_${refundedOrder.id}`, disbursedAt: refundTime.toISOString() } });
    if (await seedEvent(tx, disbursedRefund, buildDisbursedRefundPosting(asEvent(disbursedRefund)))) journalCount += 1;

    const settlementIds: Record<string, number> = {};
    for (const fixture of FIXTURE_SETTLEMENTS) {
      const storeId = stores[fixture.storeId - 1];
      const [batch] = await tx.insert(settlementBatchesTable).values({
        storeId, provider: "razorpay", providerSettlementId: fixture.id, providerStatus: "processed", status: "reconciled", source: "fixture",
        periodFrom: isoDateTime(fixture.businessDate, 0), periodTo: new Date(fixture.settledAt), grossAmountPaise: fixture.grossAmountPaise,
        feePaise: fixture.gatewayFeePaise, feeTaxPaise: fixture.gatewayTaxPaise, adjustmentPaise: -fixture.refundsDeductedPaise,
        netAmountPaise: fixture.netPayoutPaise, currency: "INR", utr: `UTR-${fixture.id}`, providerReference: `fixture-${fixture.id}`,
        payloadHash: HASH, settledAt: new Date(fixture.settledAt), importedBy: input.adminId, importedAt: new Date(fixture.settledAt), reconciledAt: new Date(fixture.settledAt), createdAt: SEEDED_AT, updatedAt: SEEDED_AT,
      }).returning();
      settlementIds[fixture.id] = batch.id;
      const lineMatches: Array<{ settlementLineId: number; matchStatus: "matched"; paymentAttemptId: number | null; refundId: number | null }> = [];
      for (const orderFixtureId of fixture.matchedOrderIds) {
        const [line] = await tx.insert(settlementLinesTable).values({
          batchId: batch.id, storeId, providerLineId: `line:${fixture.id}:payment:${orderFixtureId}`, providerTransactionId: `pay_fixture_order_${orderFixtureId}`,
          providerEntityId: `pay_fixture_order_${orderFixtureId}`, type: "payment", providerStatus: "captured",
          amountPaise: FIXTURE_ORDERS.find((order) => order.id === orderFixtureId)!.grandTotalPaise, currency: "INR", occurredAt: new Date(FIXTURE_ORDERS.find((order) => order.id === orderFixtureId)!.placedAt),
          matchStatus: "matched", paymentAttemptId: paymentAttemptIds[orderFixtureId], payloadHash: HASH, createdAt: SEEDED_AT, updatedAt: SEEDED_AT,
        }).returning();
        lineMatches.push({ settlementLineId: line.id, matchStatus: "matched", paymentAttemptId: paymentAttemptIds[orderFixtureId], refundId: null });
      }
      if (fixture.refundsDeductedPaise) {
        const [line] = await tx.insert(settlementLinesTable).values({
          batchId: batch.id, storeId, providerLineId: `line:${fixture.id}:refund:${refund.id}`, providerTransactionId: `rfnd_fixture_order_${refundedOrder.id}`,
          providerEntityId: `rfnd_fixture_order_${refundedOrder.id}`, type: "refund", providerStatus: "processed", amountPaise: -fixture.refundsDeductedPaise,
          currency: "INR", occurredAt: refundTime, matchStatus: "matched", refundId: refund.id, payloadHash: HASH, createdAt: SEEDED_AT, updatedAt: SEEDED_AT,
        }).returning();
        lineMatches.push({ settlementLineId: line.id, matchStatus: "matched", paymentAttemptId: null, refundId: refund.id });
      }
      const settlementEvent = eventInput({ eventType: "settlement.reconciled", sourceType: "settlement_batch", sourceId: batch.id, storeId, businessDate: fixture.businessDate, occurredAt: new Date(fixture.settledAt), actorId: input.adminId, payload: { batchId: batch.id, providerSettlementId: fixture.id, grossAmountPaise: fixture.grossAmountPaise, netAmountPaise: fixture.netPayoutPaise, feePaise: fixture.gatewayFeePaise, feeTaxPaise: fixture.gatewayTaxPaise, adjustmentPaise: -fixture.refundsDeductedPaise, refundDeductionPaise: fixture.refundsDeductedPaise, adjustments: [], lineMatches, utr: `UTR-${fixture.id}`, providerReference: `fixture-${fixture.id}`, settledAt: fixture.settledAt } });
      if (await seedEvent(tx, settlementEvent, buildSettlementPosting(asEvent(settlementEvent)))) journalCount += 1;
    }

    const cashOrder = FIXTURE_ORDERS.find((order) => order.id === 102)!;
    const cashStoreId = stores[cashOrder.storeId - 1];
    const closureEvent = eventInput({ eventType: "cash.session_closed", sourceType: "cash_session", sourceId: varianceCashSessionId, sourceVersion: 2, storeId: cashStoreId, businessDate: cashOrder.businessDate, occurredAt: isoDateTime(cashOrder.businessDate, 22), actorId: input.adminId, payload: { sessionId: varianceCashSessionId, variancePaise: -1_000, closedAt: isoDateTime(cashOrder.businessDate, 22).toISOString() } });
    if (await seedEvent(tx, closureEvent, buildCashClosurePosting(asEvent(closureEvent)))) journalCount += 1;

    const operatingAccount = (await tx.select().from(ledgerAccountsTable).where(eq(ledgerAccountsTable.code, "6900")))[0];
    const categoryNames = [...new Set(FIXTURE_EXPENSES.map((expense) => expense.category))];
    const categories = await tx.insert(expenseCategoriesTable).values(categoryNames.map((name) => ({ storeId: null, name, normalizedName: name.toLowerCase(), classification: name === "Rent" ? "fixed" as const : "variable" as const, ledgerAccountId: operatingAccount.id, createdBy: input.adminId, updatedBy: input.adminId, createdAt: SEEDED_AT, updatedAt: SEEDED_AT }))).returning();
    const categoryByName = new Map(categories.map((category) => [category.name, category]));
    const expenseIds: Record<number, number> = {};
    for (const fixture of FIXTURE_EXPENSES) {
      const storeId = stores[fixture.storeId - 1];
      const time = isoDateTime(fixture.businessDate, 10);
      const [expense] = await tx.insert(expensesTable).values({
        storeId, vendorName: "Deterministic Demo Vendor", expenseDate: fixture.businessDate, description: fixture.description,
        subtotalPaise: fixture.amountPaise, taxPaise: fixture.taxPaise, totalPaise: fixture.amountPaise + fixture.taxPaise, currency: "INR", status: "posted",
        paymentMethod: fixture.paymentMethod === "petty_cash" ? "cash" : "bank_transfer", paymentReference: `DEMO-EXP-${fixture.id}`,
        clientRequestId: `demo-expense-${fixture.id}`, payloadHash: HASH, version: 5, createdBy: input.adminId, updatedBy: input.adminId,
        submittedBy: input.adminId, submittedAt: time, approvedBy: input.adminId, approvedAt: time, paidBy: input.adminId, paidAt: time, postedBy: input.adminId, postedAt: time,
        createdAt: SEEDED_AT, updatedAt: SEEDED_AT,
      }).returning();
      expenseIds[fixture.id] = expense.id;
      const category = categoryByName.get(fixture.category)!;
      const [allocation] = await tx.insert(expenseAllocationsTable).values({
        expenseId: expense.id, expenseStoreId: storeId, storeId, categoryId: category.id, categoryName: category.name,
        categoryClassification: category.classification, ledgerAccountId: operatingAccount.id, costCenter: `STORE-${fixture.storeId}`,
        amountPaise: expense.totalPaise, createdAt: SEEDED_AT,
      }).returning();
      const expenseEvent = eventInput({ eventType: "expense.posted", sourceType: "expense", sourceId: expense.id, sourceVersion: 5, storeId, businessDate: fixture.businessDate, occurredAt: time, actorId: input.adminId, payload: { expenseId: expense.id, totalPaise: expense.totalPaise, paymentMethod: expense.paymentMethod, paymentReference: expense.paymentReference, paidAt: time.toISOString(), postedAt: time.toISOString(), allocations: [{ storeId, categoryId: category.id, ledgerAccountId: operatingAccount.id, ledgerAccountCode: "6900", costCenter: allocation.costCenter, amountPaise: allocation.amountPaise }] } });
      if (await seedEvent(tx, expenseEvent, buildExpensePosting(asEvent(expenseEvent)))) journalCount += 1;
    }

    const profileByFixtureId = new Map<number, { id: number; storeId: number }>();
    const compensationByKey = new Map<string, { id: number; componentId: number }>();
    for (const employee of FIXTURE_EMPLOYEES) {
      const storeId = stores[employee.storeId - 1];
      const [profile] = await tx.insert(employeeFinanceProfilesTable).values({ storeId, employeeCode: `DEMO-${employee.id}`, displayName: employee.name, employmentStartDate: "2026-01-01", status: "active", payFrequency: "monthly", createdBy: input.adminId, updatedBy: input.adminId, createdAt: SEEDED_AT, updatedAt: SEEDED_AT }).returning();
      profileByFixtureId.set(employee.id, profile);
      const versions = employee.monthlySalaryMonth1Paise === employee.monthlySalaryMonth2Paise
        ? [{ key: "2026-07", from: "2026-01-01", to: null, amount: employee.monthlySalaryMonth1Paise, note: "Deterministic fixture compensation" }]
        : [{ key: "2026-07", from: "2026-01-01", to: "2026-07-31", amount: employee.monthlySalaryMonth1Paise, note: "Deterministic fixture compensation" }, { key: "2026-08", from: "2026-08-01", to: null, amount: employee.monthlySalaryMonth2Paise, note: "Merit compensation change" }];
      for (const version of versions) {
        const [compensation] = await tx.insert(compensationVersionsTable).values({ profileId: profile.id, storeId, effectiveFrom: version.from, effectiveTo: version.to, currency: "INR", sourceNote: version.note, demoOnly: true, createdBy: input.adminId, createdAt: SEEDED_AT }).returning();
        const [component] = await tx.insert(compensationComponentsTable).values({ compensationVersionId: compensation.id, type: "earning", code: "BASE", name: "Base salary", amountPaise: version.amount, createdAt: SEEDED_AT }).returning();
        compensationByKey.set(`${employee.id}:${version.key}`, { id: compensation.id, componentId: component.id });
        if (version.key === "2026-07" && versions.length === 1) compensationByKey.set(`${employee.id}:2026-08`, { id: compensation.id, componentId: component.id });
      }
    }

    const payRunIds: Record<number, number> = {};
    for (const fixture of FIXTURE_PAY_RUNS) {
      const storeId = stores[fixture.storeId - 1];
      const periodStart = `${fixture.month}-01`;
      const periodEnd = fixture.month === "2026-07" ? "2026-07-31" : "2026-08-31";
      const time = isoDateTime(fixture.businessDate, 16);
      const [run] = await tx.insert(payRunsTable).values({
        storeId, periodStart, periodEnd, status: "posted", currency: "INR", demoOnly: true, employeeCount: fixture.employeeIds.length,
        grossPayPaise: fixture.totalGrossPayPaise, deductionPaise: fixture.totalDeductionsPaise, netPayPaise: fixture.totalNetPayPaise,
        employerCostPaise: 0, totalEmployerCostPaise: fixture.totalGrossPayPaise,
        clientRequestId: `00000000-0000-4000-8000-${String(fixture.id).padStart(12, "0")}`, payloadHash: HASH, version: 5,
        createdBy: input.adminId, calculatedBy: input.adminId, calculatedAt: time, approvedBy: input.adminId, approvedAt: time,
        paidBy: input.adminId, paidAt: time, paymentReference: `DEMO-PAYRUN-${fixture.id}`, postedBy: input.adminId, postedAt: time,
        createdAt: SEEDED_AT, updatedAt: SEEDED_AT,
      }).returning();
      payRunIds[fixture.id] = run.id;
      for (const employeeId of fixture.employeeIds) {
        const employee = FIXTURE_EMPLOYEES.find((candidate) => candidate.id === employeeId)!;
        const compensation = compensationByKey.get(`${employeeId}:${fixture.month}`)!;
        const amount = fixture.month === "2026-07" ? employee.monthlySalaryMonth1Paise : employee.monthlySalaryMonth2Paise;
        const profile = profileByFixtureId.get(employeeId)!;
        const [runEmployee] = await tx.insert(payRunEmployeesTable).values({ payRunId: run.id, payRunStoreId: storeId, profileId: profile.id, compensationVersionId: compensation.id, employeeCode: `DEMO-${employee.id}`, displayName: employee.name, grossPayPaise: amount, deductionPaise: 0, netPayPaise: amount, employerCostPaise: 0, totalEmployerCostPaise: amount, createdAt: SEEDED_AT }).returning();
        await tx.insert(payRunLinesTable).values({ payRunEmployeeId: runEmployee.id, compensationComponentId: compensation.componentId, type: "earning", componentCode: "BASE", componentName: "Base salary", amountPaise: amount, createdAt: SEEDED_AT });
      }
      const payRunEvent = eventInput({ eventType: "pay_run.posted", sourceType: "pay_run", sourceId: run.id, sourceVersion: 5, storeId, businessDate: fixture.businessDate, occurredAt: time, actorId: input.adminId, payload: { payRunId: run.id, periodStart, periodEnd, grossPayPaise: fixture.totalGrossPayPaise, deductionPaise: fixture.totalDeductionsPaise, netPayPaise: fixture.totalNetPayPaise, employerCostPaise: 0, totalEmployerCostPaise: fixture.totalGrossPayPaise, paymentReferenceRecorded: true, postedAt: time.toISOString() } });
      if (await seedEvent(tx, payRunEvent, buildPayRunPosting(asEvent(payRunEvent)))) journalCount += 1;
    }

    for (const storeId of stores) {
      await tx.insert(fiscalPeriodsTable).values([
        { storeId, name: "July 2026", startDate: "2026-07-01", endDate: "2026-07-31", status: "closed", softClosedBy: input.adminId, softClosedAt: SEEDED_AT, closedBy: input.adminId, closedAt: SEEDED_AT, createdAt: SEEDED_AT, updatedAt: SEEDED_AT },
        { storeId, name: "August 2026", startDate: "2026-08-01", endDate: "2026-08-31", status: "open", createdAt: SEEDED_AT, updatedAt: SEEDED_AT },
      ]);
    }

    return { reportingPeriods: ["2026-07", "2026-08"], orderIds, paymentAttemptIds, refundId: refund.id, settlementIds, cashSessionId: varianceCashSessionId, expenseIds, payRunIds, journalCount, expected: EXPECTED_CONSOLIDATED_TWO_MONTH_TOTAL };
  });
}

export const formatDemoScenarioSummary = (result: DemoScenarioResult, storeIds: [number, number]) => [
  `Reporting periods: ${result.reportingPeriods.join(", ")} (July closed; August open).`,
  `Fixture stores: S1=#${storeIds[0]}, S2=#${storeIds[1]}.`,
  `Orders: ${Object.entries(result.orderIds).map(([fixtureId, id]) => `${fixtureId}->#${id}`).join(", ")}.`,
  `Partial refund: #${result.refundId}; settlements: ${Object.entries(result.settlementIds).map(([source, id]) => `${source}->#${id}`).join(", ")}; COD session: #${result.cashSessionId}.`,
  `Expenses: ${Object.values(result.expenseIds).length}; pay runs: ${Object.entries(result.payRunIds).map(([fixtureId, id]) => `${fixtureId}->#${id}`).join(", ")}; balanced journals: ${result.journalCount}.`,
  `Expected customer headline totals: recognized revenue ${result.expected.netRecognizedRevenuePaise} paise; COGS ${result.expected.cogsPaise} paise; operating expenses ${result.expected.operatingExpensesPaise} paise; payroll ${result.expected.payrollCostPaise} paise; operating result ${result.expected.operatingProfitPaise} paise.`,
  `Expected ledger report/CSV totals (tax separated): recognized revenue ${EXPECTED_LEDGER_REPORT_CONSOLIDATED_TWO_MONTH_TOTAL.recognizedRevenuePaise} paise; COGS ${EXPECTED_LEDGER_REPORT_CONSOLIDATED_TWO_MONTH_TOTAL.cogsPaise} paise; operating expenses ${EXPECTED_LEDGER_REPORT_CONSOLIDATED_TWO_MONTH_TOTAL.operatingExpensesPaise} paise; payroll ${EXPECTED_LEDGER_REPORT_CONSOLIDATED_TWO_MONTH_TOTAL.payrollCostPaise} paise; operating result ${EXPECTED_LEDGER_REPORT_CONSOLIDATED_TWO_MONTH_TOTAL.operatingResultPaise} paise.`,
  `Expected store-month keys: ${Object.keys(EXPECTED_STORE_MONTH_SUMMARIES).join(", ")}.`,
];
