import { beforeEach, describe, expect, it } from "vitest";
import { FinanceMetrics, type FinanceOperationalSnapshot } from "./finance-metrics";

const snapshot: FinanceOperationalSnapshot = {
  outbox: [{ status: "dead_letter", count: 2, retryCount: 20, oldestAgeSeconds: 1800 }],
  refunds: [{ status: "failed", ageBucket: "1h_24h", count: 3 }],
  unsettled: [{ ageBucket: "gte_7d", count: 1, amountPaise: 12500 }],
  settlements: [
    { matchStatus: "matched", count: 9, variancePaise: 0 },
    { matchStatus: "mismatch", count: 1, variancePaise: 500 },
  ],
  openCashSessions: 4,
  cashVariancePaise: -250,
};

describe("finance operational metrics", () => {
  let metrics: FinanceMetrics;
  beforeEach(() => { metrics = new FinanceMetrics(); });

  it("renders counts, ages, retries, paise values, and settlement match ratio", () => {
    const output = metrics.render(snapshot);
    expect(output).toContain('food_finance_outbox_events{status="dead_letter"} 2');
    expect(output).toContain('food_finance_outbox_retry_count{status="dead_letter"} 20');
    expect(output).toContain('food_finance_refunds{status="failed",age_bucket="1h_24h"} 3');
    expect(output).toContain('food_finance_unsettled_captured_amount_paise{age_bucket="gte_7d"} 12500');
    expect(output).toContain("food_finance_settlement_match_ratio 0.9");
    expect(output).toContain("food_finance_cash_variance_paise -250");
  });

  it("uses only bounded labels for event counters and report histograms", () => {
    metrics.recordPostingFailure("customer@example.com");
    metrics.recordDuplicateSuppression("order.delivered");
    metrics.recordUnbalancedJournalAttempt("manual");
    metrics.recordClosedPeriodPostingAttempt("source");
    metrics.recordReport("sales", "store", "success", 0.075);
    metrics.setReportFreshness("sales", "store", 120);
    const output = metrics.render(snapshot);
    expect(output).toContain('food_finance_posting_failures_total{event_type="unknown"} 1');
    expect(output).not.toContain("customer@example.com");
    expect(output).toContain('food_finance_duplicate_event_suppressions_total{event_type="order.delivered"} 1');
    expect(output).toContain('food_finance_report_duration_seconds_bucket{report_type="sales",scope="store",outcome="success",le="0.1"} 1');
    expect(output).toContain('food_finance_report_freshness_seconds{report_type="sales",scope="store"} 120');
  });
});
