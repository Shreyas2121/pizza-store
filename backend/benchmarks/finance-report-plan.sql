-- Run with: psql "$DATABASE_URL" -v from_date=2025-04-01 -v to_date=2026-03-31 -f benchmarks/finance-report-plan.sql
-- The selected database must contain at least two stores and twelve months of journal history.
\set ON_ERROR_STOP on

DO $$
DECLARE
  store_count integer;
  history_days integer;
BEGIN
  SELECT count(DISTINCT store_id), max(business_date) - min(business_date)
    INTO store_count, history_days
    FROM journal_entries;
  IF store_count < 2 OR history_days < 364 THEN
    RAISE EXCEPTION 'benchmark requires two stores and twelve months of journal history';
  END IF;
END $$;

BEGIN;
EXPLAIN (ANALYZE, BUFFERS, WAL, FORMAT JSON)
SELECT
  journal_entries.business_date,
  ledger_accounts.code,
  ledger_accounts.name,
  ledger_accounts.type,
  coalesce(sum(journal_lines.debit_paise)::text, '0') AS debit_paise,
  coalesce(sum(journal_lines.credit_paise)::text, '0') AS credit_paise
FROM journal_lines
JOIN journal_entries ON journal_entries.id = journal_lines.journal_entry_id
JOIN ledger_accounts ON ledger_accounts.id = journal_lines.account_id
WHERE journal_entries.status IN ('posted', 'reversed')
  AND journal_entries.currency = 'INR'
  AND journal_entries.business_date >= :'from_date'
  AND journal_entries.business_date <= :'to_date'
GROUP BY journal_entries.business_date, ledger_accounts.id
ORDER BY journal_entries.business_date, ledger_accounts.code;

INSERT INTO journal_entries (
  store_id, journal_number, business_date, occurred_at, description, currency,
  source_type, source_id, event_type, source_version, command_hash, status,
  created_at, updated_at
)
SELECT id, format('BENCHMARK-%s', txid_current()), :'to_date', now(), 'Rolled-back index write benchmark', 'INR',
  'benchmark', format('finance-report-index-%s', txid_current()), 'benchmark.write', 1, repeat('0', 64), 'draft', now(), now()
FROM stores ORDER BY id LIMIT 1
RETURNING id AS journal_id
\gset benchmark_

INSERT INTO journal_lines (journal_entry_id, line_number, account_id, debit_paise, credit_paise, dimensions, created_at)
SELECT :benchmark_journal_id, 1, id, 1, 0, '{}'::jsonb, now() FROM ledger_accounts WHERE code = '1000'
UNION ALL
SELECT :benchmark_journal_id, 2, id, 0, 1, '{}'::jsonb, now() FROM ledger_accounts WHERE code = '3000';

EXPLAIN (ANALYZE, BUFFERS, WAL, FORMAT JSON)
UPDATE journal_entries
SET status = 'posted', posted_at = now(), updated_at = now()
WHERE id = :benchmark_journal_id;

ROLLBACK;
