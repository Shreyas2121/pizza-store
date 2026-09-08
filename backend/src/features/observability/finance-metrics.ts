import { FINANCIAL_EVENT_TYPES, type FinancialEventType } from "../finance-events/financial-event.types";

export const REPORT_TYPES = ["overview", "profit_and_loss", "sales", "margins"] as const;
export type FinanceReportType = (typeof REPORT_TYPES)[number];
type ReportScope = "store" | "consolidated";
type Outcome = "success" | "failure";
type PostingKind = "source" | "manual";

const DURATION_BUCKETS_SECONDS = [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10] as const;
const EVENT_TYPES = new Set<string>(FINANCIAL_EVENT_TYPES);

type Sample = { labels: Record<string, string>; value: number };
export type FinanceOperationalSnapshot = {
  outbox: Array<{ status: string; count: number; retryCount: number; oldestAgeSeconds: number }>;
  refunds: Array<{ status: "pending" | "failed"; ageBucket: string; count: number }>;
  unsettled: Array<{ ageBucket: string; count: number; amountPaise: number }>;
  settlements: Array<{ matchStatus: string; count: number; variancePaise: number }>;
  openCashSessions: number;
  cashVariancePaise: number;
};

const labelText = (labels: Record<string, string>) => Object.keys(labels).length === 0 ? "" : `{${Object.entries(labels)
  .map(([key, value]) => `${key}="${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`)
  .join(",")}}`;

const metric = (name: string, help: string, type: "counter" | "gauge", samples: Sample[]) => [
  `# HELP ${name} ${help}`,
  `# TYPE ${name} ${type}`,
  ...samples.map((sample) => `${name}${labelText(sample.labels)} ${sample.value}`),
].join("\n");

const counterKey = (name: string, labels: Record<string, string>) => `${name}|${JSON.stringify(labels)}`;

export class FinanceMetrics {
  private readonly counters = new Map<string, Sample & { name: string }>();
  private readonly reportDurations = new Map<string, { labels: Record<string, string>; count: number; sum: number; buckets: number[] }>();
  private readonly reportFreshness = new Map<string, Sample>();

  recordPostingFailure(eventType: FinancialEventType | string) {
    this.increment("food_finance_posting_failures_total", { event_type: EVENT_TYPES.has(eventType) ? eventType : "unknown" });
  }

  recordDuplicateSuppression(eventType: FinancialEventType | string) {
    this.increment("food_finance_duplicate_event_suppressions_total", { event_type: EVENT_TYPES.has(eventType) ? eventType : "unknown" });
  }

  recordUnbalancedJournalAttempt(kind: PostingKind) {
    this.increment("food_finance_unbalanced_journal_attempts_total", { posting_kind: kind });
  }

  recordClosedPeriodPostingAttempt(kind: PostingKind) {
    this.increment("food_finance_closed_period_posting_attempts_total", { posting_kind: kind });
  }

  recordReport(reportType: FinanceReportType, scope: ReportScope, outcome: Outcome, durationSeconds: number) {
    const labels = { report_type: reportType, scope, outcome };
    const key = JSON.stringify(labels);
    const current = this.reportDurations.get(key) ?? { labels, count: 0, sum: 0, buckets: DURATION_BUCKETS_SECONDS.map(() => 0) };
    current.count += 1;
    current.sum += Math.max(0, durationSeconds);
    DURATION_BUCKETS_SECONDS.forEach((limit, index) => { if (durationSeconds <= limit) current.buckets[index] += 1; });
    this.reportDurations.set(key, current);
  }

  setReportFreshness(reportType: FinanceReportType, scope: ReportScope, ageSeconds: number | null) {
    this.reportFreshness.set(JSON.stringify({ report_type: reportType, scope }), {
      labels: { report_type: reportType, scope }, value: ageSeconds === null ? -1 : Math.max(0, ageSeconds),
    });
  }

  resetForTests() {
    this.counters.clear();
    this.reportDurations.clear();
    this.reportFreshness.clear();
  }

  render(snapshot: FinanceOperationalSnapshot) {
    const sections = [
      metric("food_finance_outbox_events", "Financial outbox events by bounded status.", "gauge", snapshot.outbox.map((row) => ({ labels: { status: row.status }, value: row.count }))),
      metric("food_finance_outbox_oldest_age_seconds", "Age in seconds of the oldest financial outbox event by status.", "gauge", snapshot.outbox.map((row) => ({ labels: { status: row.status }, value: row.oldestAgeSeconds }))),
      metric("food_finance_outbox_retry_count", "Sum of processing attempts for financial outbox events by status.", "gauge", snapshot.outbox.map((row) => ({ labels: { status: row.status }, value: row.retryCount }))),
      metric("food_finance_refunds", "Pending or failed refunds by age bucket.", "gauge", snapshot.refunds.map((row) => ({ labels: { status: row.status, age_bucket: row.ageBucket }, value: row.count }))),
      metric("food_finance_unsettled_captured_payments", "Unsettled captured Razorpay payments by age bucket.", "gauge", snapshot.unsettled.map((row) => ({ labels: { age_bucket: row.ageBucket }, value: row.count }))),
      metric("food_finance_unsettled_captured_amount_paise", "Unsettled captured Razorpay amount in integer paise by age bucket.", "gauge", snapshot.unsettled.map((row) => ({ labels: { age_bucket: row.ageBucket }, value: row.amountPaise }))),
      metric("food_finance_settlement_lines", "Settlement lines by bounded match status.", "gauge", snapshot.settlements.map((row) => ({ labels: { match_status: row.matchStatus }, value: row.count }))),
      metric("food_finance_settlement_variance_paise", "Absolute settlement line variance in integer paise by match status.", "gauge", snapshot.settlements.map((row) => ({ labels: { match_status: row.matchStatus }, value: row.variancePaise }))),
      metric("food_finance_settlement_match_ratio", "Matched settlement lines divided by all matchable settlement lines.", "gauge", [{ labels: {}, value: this.matchRatio(snapshot) }]),
      metric("food_finance_open_cash_sessions", "Currently open cash sessions.", "gauge", [{ labels: {}, value: snapshot.openCashSessions }]),
      metric("food_finance_cash_variance_paise", "Signed variance in integer paise across active cash-session closures.", "gauge", [{ labels: {}, value: snapshot.cashVariancePaise }]),
      ...this.renderCounters(),
      this.renderReportDurations(),
      metric("food_finance_report_freshness_seconds", "Seconds since the latest settlement reconciliation used by a report; -1 means never reconciled.", "gauge", [...this.reportFreshness.values()]),
    ];
    return `${sections.filter(Boolean).join("\n\n")}\n`;
  }

  private increment(name: string, labels: Record<string, string>) {
    const key = counterKey(name, labels);
    const current = this.counters.get(key);
    this.counters.set(key, { name, labels, value: (current?.value ?? 0) + 1 });
  }

  private renderCounters() {
    const definitions: Record<string, string> = {
      food_finance_posting_failures_total: "Financial posting failures by bounded event type.",
      food_finance_duplicate_event_suppressions_total: "Duplicate financial events safely suppressed by idempotent posting.",
      food_finance_unbalanced_journal_attempts_total: "Journal attempts rejected because debits and credits were unbalanced.",
      food_finance_closed_period_posting_attempts_total: "Posting attempts rejected by closed-period policy.",
    };
    return Object.entries(definitions).map(([name, help]) => metric(name, help, "counter", [...this.counters.values()].filter((sample) => sample.name === name)));
  }

  private renderReportDurations() {
    const name = "food_finance_report_duration_seconds";
    const lines = [`# HELP ${name} Finance report generation duration in seconds.`, `# TYPE ${name} histogram`];
    for (const value of this.reportDurations.values()) {
      DURATION_BUCKETS_SECONDS.forEach((limit, index) => lines.push(`${name}_bucket${labelText({ ...value.labels, le: String(limit) })} ${value.buckets[index]}`));
      lines.push(`${name}_bucket${labelText({ ...value.labels, le: "+Inf" })} ${value.count}`);
      lines.push(`${name}_sum${labelText(value.labels)} ${value.sum}`);
      lines.push(`${name}_count${labelText(value.labels)} ${value.count}`);
    }
    return lines.join("\n");
  }

  private matchRatio(snapshot: FinanceOperationalSnapshot) {
    const eligible = snapshot.settlements.filter((row) => row.matchStatus !== "ignored");
    const total = eligible.reduce((sum, row) => sum + row.count, 0);
    return total === 0 ? 1 : (eligible.find((row) => row.matchStatus === "matched")?.count ?? 0) / total;
  }
}

export const financeMetrics = new FinanceMetrics();
