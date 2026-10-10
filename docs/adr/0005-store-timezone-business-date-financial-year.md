# ADR-005: Store timezone, business date, and Indian financial year

- Status: Accepted
- Date: 2026-08-31
- Decision owners: PizzaStore project owner and maintainers

Implementation review (2026-10-10): Implemented behavior and current evidence are described by the linked contracts; the dated decision context is retained as history. See [architecture](../architecture.md), [lifecycle contracts](../finance-lifecycle-contracts.md) and [verification](../case-study-verification.md).

## Context

Database timestamps alone do not answer which store day owns a delivery, cash movement, tax rule, or report row. UTC midnight is 05:30 in India, and grouping by server or browser timezone can move the same event between dates. Finance also needs a predictable Indian financial-year preset while preserving arbitrary reporting ranges.

## Decision

1. Persist event instants as UTC timestamps. Servers, database sessions, browsers, and worker hosts do not define financial dates through their local timezone.
2. Every store has a validated IANA timezone identifier, initially `Asia/Kolkata` for seeded PizzaStore branches. Fixed offsets and abbreviations such as `IST` are not accepted as configuration because they do not encode complete timezone rules.
3. A store business day is its local civil calendar day from 00:00 inclusive to the next local 00:00 exclusive. The business date is the `YYYY-MM-DD` local date containing the event instant.
4. Financial source records snapshot both the derived business date and the timezone used to derive it where relevant. Changing a store timezone is prospective and never re-dates posted history.
5. Effective-dated tax, delivery-price, standard-cost, and compensation rules are selected using the source record's store business date. The selected rule/version is also snapshotted.
6. API date ranges use inclusive `fromBusinessDate` and `toBusinessDate` values. Query execution converts the start of the first local date and the start of the day after the last local date to a half-open UTC interval. This avoids precision-dependent end-of-day comparisons.
7. The Indian financial-year preset runs from 1 April through 31 March. A year is labelled by both calendar years—for example, `FY 2026-27` is 2026-04-01 through 2027-03-31 inclusive.
8. Arbitrary business-date ranges remain supported. Calendar-month, comparison, and financial-year presets are conveniences, not alternate date semantics.
9. Per-store reports group by each record's snapshotted store business date. Consolidated reports use the same requested business-date labels across stores and include timezone/date-basis metadata; they do not regroup stored events using the viewer's timezone.
10. Cash sessions are unique per store and business date. A delivered COD order is assigned using its recognition business date from ADR-002.

## Alternatives considered

### Group all reports by UTC date

Rejected because events during the first 5 hours 30 minutes of an Indian day would be attributed to the previous local date.

### Use the server or browser timezone

Rejected because deployments and users can differ, making results non-deterministic and allowing the same report to change by location.

### Store only a fixed UTC offset

Rejected because it loses timezone-rule identity and is unsafe if the project later demonstrates stores in regions with daylight-saving changes.

### Recompute all historical business dates after a timezone change

Rejected because previously closed cash sessions, periods, and reports would silently move.

### Make the financial-year preset the only allowed range

Rejected because operations still require daily, monthly, comparison, and arbitrary-date reporting.

## Consequences

- Every financial query must state whether it filters an instant or a business date; report APIs return timezone and date-basis metadata.
- Store setup and migration need an explicit timezone, with `Asia/Kolkata` as seeded data rather than a hidden server assumption.
- Business dates and rule versions make historical calculations stable after configuration changes.
- Consolidated reporting is reproducible even if stores eventually use different IANA timezones, though one UTC instant can legitimately belong to different store dates.
- Half-open UTC query intervals avoid lost or duplicated sub-second events at date boundaries.

## Examples

### Local midnight boundary

For `Asia/Kolkata`, `2026-03-31T18:29:59Z` belongs to business date `2026-03-31`. One second later, `2026-03-31T18:30:00Z`, belongs to `2026-04-01`.

### Financial-year boundary

The first event is in `FY 2025-26`; the second is in `FY 2026-27`. A `FY 2026-27` query covers local business dates 2026-04-01 through 2027-03-31.

### Inclusive date request

For an `Asia/Kolkata` report from 2026-08-01 through 2026-08-31, the UTC interval is `[2026-07-31T18:30:00Z, 2026-08-31T18:30:00Z)`. The exclusive upper bound is the start of local 1 September.

## Testable invariants

- Every persisted financial event instant is UTC and every applicable source record has a store business date.
- The same instant and snapshotted IANA timezone always derive the same business date.
- A store timezone change does not alter existing snapshotted business dates or posted periods.
- A report's UTC interval is start-inclusive and next-day-start-exclusive, with no gap or overlap between adjacent business dates.
- `FY Y-(Y+1)` begins on 1 April of `Y` and ends on 31 March of `Y+1`.
- The 31 March/1 April boundary is tested using instants on both sides of local midnight.
- Effective-dated rule selection uses the source store business date, not UTC date or the current date.
- At most one cash session exists for a `(storeId, businessDate)` pair.
- Consolidated report metadata states the business-date basis and involved store timezones.
