# Finance report performance decision

## Target and representative workload

The management-report latency budget is 500 ms at the HTTP service boundary and 250 ms for the shared ledger-movement query on two stores with at least twelve months of journal history. `backend/benchmarks/finance-report-plan.sql` validates that minimum shape and captures `EXPLAIN (ANALYZE, BUFFERS, WAL, FORMAT JSON)` for both the report read and a rolled-back journal write.

## Bottleneck and index decision

All four reports and their CSV exports use `FinanceReportRepository.movements`. Store-scoped reads already have `journal_entries_store_date_idx`, while the consolidated query has no store equality predicate. Before P5.6 its only date-capable index was store-leading, leaving PostgreSQL without a date-leading access path for a bounded consolidated period.

P5.6 adds one partial index:

```sql
CREATE INDEX journal_entries_finance_report_idx
ON journal_entries (business_date, store_id)
WHERE status IN ('posted', 'reversed') AND currency = 'INR';
```

The predicate exactly matches the immutable reporting population, excludes drafts, and supports the consolidated date range. No materialized projection is justified for the current two-store workload. No additional line index is added because `journal_lines_entry_line_unique` already begins with `journal_entry_id` and supports the report join.

## Verification record

Runtime database checks were intentionally not executed in this implementation environment. Therefore this change does not claim fabricated latency or buffer numbers. Before release, run the checked-in benchmark before and after the migration and retain its JSON plans with the release evidence. Accept the index only when the report query stays under 250 ms, uses the partial index for a selective consolidated range, and the rolled-back write remains within 10% of its baseline latency/WAL. If PostgreSQL correctly chooses a sequential scan for a full-history range, that alone is not a failure; compare elapsed time and buffers.
