import { pool } from "../../db";
import type { FinanceOperationalSnapshot } from "./finance-metrics";

type QueryResult = { rows: Array<Record<string, unknown>> };
type Queryable = { query(text: string): Promise<QueryResult> };

const number = (value: unknown) => Number(value ?? 0);

export class FinanceMetricsRepository {
  constructor(private readonly client: Queryable = pool) {}

  async snapshot(): Promise<FinanceOperationalSnapshot> {
    const [outbox, refunds, unsettled, settlements, cash] = await Promise.all([
      this.client.query(`
        select status, count(*)::text as count, coalesce(sum(attempt_count), 0)::text as retry_count,
          case when status = 'processed' then '0'
               else coalesce(extract(epoch from (now() - min(created_at))), 0)::text end as oldest_age_seconds
        from financial_outbox group by status`),
      this.client.query(`
        select case when status = 'failed' then 'failed' else 'pending' end as status,
          case when now() - requested_at < interval '1 hour' then 'lt_1h'
               when now() - requested_at < interval '24 hours' then '1h_24h'
               when now() - requested_at < interval '7 days' then '1d_7d'
               else 'gte_7d' end as age_bucket,
          count(*)::text as count
        from refunds
        where status in ('requested', 'approved', 'submitted', 'processing', 'failed')
        group by 1, 2`),
      this.client.query(`
        select case when now() - payment.captured_at < interval '1 hour' then 'lt_1h'
                    when now() - payment.captured_at < interval '24 hours' then '1h_24h'
                    when now() - payment.captured_at < interval '7 days' then '1d_7d'
                    else 'gte_7d' end as age_bucket,
          count(*)::text as count, coalesce(sum(payment.amount_paise), 0)::text as amount_paise
        from payment_attempts payment
        where payment.provider = 'razorpay' and payment.status = 'captured' and payment.captured_at is not null
          and not exists (
            select 1 from settlement_lines line
            where line.payment_attempt_id = payment.id and line.type = 'payment' and line.match_status = 'matched'
          )
        group by 1`),
      this.client.query(`
        select match_status, count(*)::text as count,
          coalesce(sum(case when match_status in ('unmatched', 'mismatch') then abs(amount_paise::bigint) else 0 end), 0)::text as variance_paise
        from settlement_lines group by match_status`),
      this.client.query(`
        select (select count(*) from cash_sessions where status = 'open')::text as open_sessions,
          coalesce((select sum(variance_paise::bigint) from cash_session_closures where reversed_at is null), 0)::text as variance_paise`),
    ]);

    const outboxStatuses = ["pending", "processing", "processed", "failed", "dead_letter"];
    const outboxByStatus = new Map(outbox.rows.map((row) => [String(row.status), row]));
    const settlementStatuses = ["matched", "unmatched", "mismatch", "ignored"];
    const settlementsByStatus = new Map(settlements.rows.map((row) => [String(row.match_status), row]));
    return {
      outbox: outboxStatuses.map((status) => {
        const row = outboxByStatus.get(status);
        return { status, count: number(row?.count), retryCount: number(row?.retry_count), oldestAgeSeconds: number(row?.oldest_age_seconds) };
      }),
      refunds: refunds.rows.map((row) => ({ status: String(row.status) as "pending" | "failed", ageBucket: String(row.age_bucket), count: number(row.count) })),
      unsettled: unsettled.rows.map((row) => ({ ageBucket: String(row.age_bucket), count: number(row.count), amountPaise: number(row.amount_paise) })),
      settlements: settlementStatuses.map((matchStatus) => {
        const row = settlementsByStatus.get(matchStatus);
        return { matchStatus, count: number(row?.count), variancePaise: number(row?.variance_paise) };
      }),
      openCashSessions: number(cash.rows[0]?.open_sessions),
      cashVariancePaise: number(cash.rows[0]?.variance_paise),
    };
  }
}

export default new FinanceMetricsRepository();
