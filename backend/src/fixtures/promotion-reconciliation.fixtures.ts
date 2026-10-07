import type { FinancialOutboxEvent } from "../db/schema";
import { buildDeliveredOrderPayload } from "../features/finance-events/order-recognition.payload";
import { buildDeliveredOrderPosting } from "../features/ledger/commerce-posting.policy";
import { validatePostingCommand } from "../features/ledger/ledger.policy";
import { SYSTEM_LEDGER_ACCOUNTS } from "../features/ledger";
import { projectFinanceReport, type FinanceMovement } from "../features/finance-reports/finance-report.policy";
import { promotionFinanceFixture } from "./promotion-finance.fixtures";
import { PROMOTION_FIXTURE_DATE } from "./promotions.fixtures";

// Pure integration evidence: production recognition -> posting -> consolidated report.
// No executor, connection, migration or seed/reset is invoked.
export function reconcilePromotionFinanceFixtures() {
  const cases = [
    { mode: "automatic_deals" as const, bundle: false, expectedRevenue: "27000", expectedDiscount: "3000" },
    { mode: "coupon" as const, bundle: false, expectedRevenue: "37000", expectedDiscount: "3000" },
    { mode: "automatic_deals" as const, bundle: true, expectedRevenue: "30000", expectedDiscount: "0" },
  ];
  let journals = 0;
  for (const scenario of cases) {
    const movements: FinanceMovement[] = [];
    let storeRevenue = 0n;
    for (const storeId of [1, 2] as const) {
      const fixture = promotionFinanceFixture(storeId, scenario.mode, scenario.bundle);
      const payload = buildDeliveredOrderPayload(fixture.order, fixture.lines, PROMOTION_FIXTURE_DATE);
      const event: FinancialOutboxEvent = {
        id: storeId, eventId: `promotion-fixture:${scenario.mode}:${scenario.bundle}:${storeId}`,
        eventType: "order.delivered", schemaVersion: 1, sourceType: "order", sourceId: String(fixture.order.id), sourceVersion: 1,
        storeId, currency: "INR", occurredAt: PROMOTION_FIXTURE_DATE, businessDate: "2026-10-07", timezone: "Asia/Kolkata",
        actorId: null, correlationId: null, causationId: null, payload, payloadHash: "0".repeat(64), status: "pending",
        attemptCount: 0, availableAt: PROMOTION_FIXTURE_DATE, claimedAt: null, claimedBy: null, processedAt: null,
        lastError: null, createdAt: PROMOTION_FIXTURE_DATE, updatedAt: PROMOTION_FIXTURE_DATE,
      };
      const command = buildDeliveredOrderPosting(event);
      validatePostingCommand(command);
      if (command.storeId !== storeId) throw new Error("Promotion fixture crossed fulfilling stores.");
      const rows: FinanceMovement[] = command.lines.map((line) => {
        const account = SYSTEM_LEDGER_ACCOUNTS.find((a) => a.code === line.accountCode);
        if (!account) throw new Error(`Unknown fixture account ${line.accountCode}.`);
        return { businessDate: command.businessDate, accountCode: account.code, accountName: account.name,
          accountType: account.type, debitPaise: line.side === "debit" ? String(line.amountPaise) : "0",
          creditPaise: line.side === "credit" ? String(line.amountPaise) : "0" };
      });
      if (scenario.bundle && rows.some((r) => r.accountCode === "4100")) throw new Error("Bundle markdown entered contra-revenue.");
      if (scenario.mode === "automatic_deals" && rows.some((r) => r.accountCode === "4010")) throw new Error("Waived delivery entered revenue.");
      storeRevenue += BigInt(projectFinanceReport(rows).totals.recognizedRevenuePaise);
      movements.push(...rows); journals += 1;
    }
    const totals = projectFinanceReport(movements).totals;
    if (totals.recognizedRevenuePaise !== scenario.expectedRevenue || totals.discountsPaise !== scenario.expectedDiscount ||
      BigInt(totals.recognizedRevenuePaise) !== storeRevenue) throw new Error("Promotion fixture failed platform/store reconciliation.");
  }
  return { journals, consolidatedScenarios: cases.length, databaseQueries: 0 as const };
}
