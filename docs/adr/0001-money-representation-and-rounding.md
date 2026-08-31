# ADR-001: Money representation, limits, rounding, and allocation

- Status: Accepted
- Date: 2026-08-31
- Decision owners: PizzaStore project owner and maintainers

## Context

PizzaStore currently mixes floating-point rupees and integer paise. Binary floating point cannot represent many decimal currency values exactly, and converting an exact checkout quote back to rupees before persistence loses the strongest existing guarantee. Finance work also introduces totals that can exceed the limit of one transaction even when each row is safely bounded.

The portfolio is INR-only. Razorpay already exchanges integer paise, and PostgreSQL can aggregate `integer` values as `bigint`.

## Decision

1. INR is represented in domain and persistence code as an integer number of paise. Authoritative fields use the `...Paise` suffix and currency is the ISO 4217 code `INR`.
2. Each stored transaction amount uses PostgreSQL `integer`. The technical range is -2,147,483,648 through 2,147,483,647 paise; ordinary amount fields are non-negative and therefore capped at 2,147,483,647 paise (₹21,474,836.47). Signed values are allowed only where the domain explicitly requires them, such as ledger lines or rounding adjustments.
3. Every bounded domain defines a smaller business cap in shared code and Zod validation. The shared money module rejects non-integers, unsafe integers, values outside the domain cap, and arithmetic whose intermediate or result cannot be represented safely. P1.1 will name the concrete per-domain caps before those values are accepted.
4. Bounded individual-transaction API fields are JSON numbers. SQL/report/ledger aggregates that use `bigint`, or could exceed JavaScript's safe integer range, are canonical base-10 paise strings such as `"2147483648"`. They contain an optional leading minus sign and digits only—no decimal point, separators, currency symbol, or exponent.
5. Arithmetic remains integer/rational until the presentation boundary. Percentage rates use integer basis points. Code must not multiply money by a binary floating-point rate.
6. When an exact rational result must become paise, round to the nearest paise with ties away from zero. Thus `10.5` becomes `11`, and `-10.5` becomes `-11`.
7. Proportional allocation operates on the absolute source amount and non-negative integer weights. It assigns each line its truncated exact share, then distributes remaining paise by descending fractional remainder; equal remainders are resolved by ascending stable line ID. Reapply the source sign after allocation. Zero-weight lines receive zero, and a non-zero source with zero total weight is invalid.
8. Formatting and rupee conversion are presentation concerns only. Browser-calculated prices, fees, discounts, taxes, costs, payroll totals, and refund amounts are never authoritative.

## Alternatives considered

### Floating-point rupees

Rejected because equality, summation, and boundary rounding are not deterministic enough for persisted financial truth.

### PostgreSQL `numeric` for every amount

Rejected for this INR-only portfolio because integer paise is simpler and already matches the payment-provider contract. `numeric` would still need an explicit driver and JSON string policy.

### PostgreSQL `bigint` for every amount

Rejected for individual rows because the transaction domain is intentionally bounded and JavaScript cannot safely represent all `bigint` values as numbers. It remains the database aggregate type.

### Give allocation leftovers to input order

Rejected because input order can change across database queries or clients. Stable IDs make the result replayable and auditable.

## Consequences

- Calculations and persisted values are exact to one paise and deterministic across retries.
- Services must use checked money primitives rather than ordinary arithmetic scattered across modules.
- Aggregate DTOs deliberately differ from bounded transaction DTOs: aggregate paise values are strings.
- Callers must parse aggregate strings with `BigInt` or a decimal-string-aware presentation helper.
- Migration from legacy rupee floats requires deterministic rounding and discrepancy reporting; historical values cannot be reconstructed from today's catalogue.
- Supporting another currency or materially larger transactions requires a new decision about minor units, persistence type, parsing, and serialization.

## Examples

### Rounding

At a calculated value of 100.5 paise, the stored result is 101 paise. At -100.5 paise, it is -101 paise.

### Allocation

Allocate 10 paise across lines `A`, `B`, and `C` with equal weights. The base shares are 3 paise each and one paise remains. Because the fractional remainders tie, ascending line ID wins: `A=4`, `B=3`, `C=3`.

### Aggregate serialization

An individual order may return `grandTotalPaise: 125000`. A consolidated report larger than the PostgreSQL integer limit returns `recognizedRevenuePaise: "3000000000"`.

## Testable invariants

- Every persisted `...Paise` transaction value is an integer within its declared domain and database bounds.
- Checked arithmetic rejects unsafe intermediates and out-of-domain results instead of wrapping, truncating, or returning `Infinity`/`NaN`.
- Rounding ties move away from zero.
- `sum(allocations) = sourceAmountPaise`, including zero and negative sources.
- Allocation output is independent of input order when stable line IDs and weights are unchanged.
- No allocation has a sign opposite to the non-zero source.
- Aggregate paise DTOs match `^-?\d+$` and round-trip through `BigInt` without loss.
- Authoritative server calculations never convert through floating-point rupees.
