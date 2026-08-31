# ADR-004: Tax-inclusive demo calculation and compliance boundary

- Status: Accepted
- Date: 2026-08-31
- Decision owners: PizzaStore project owner and maintainers

## Context

PizzaStore is a consumer food-ordering portfolio application. Customers should see menu prices as the amounts they expect to pay, while the project should still demonstrate exact tax extraction, effective-dated rules, immutable snapshots, and auditable reporting.

It is not a statutory tax product. Rates and obligations can change, and the project has no GST portal, return filing, IRP, or professional compliance review.

## Decision

1. Catalogue prices, item subtotals, discounts, delivery fees, line totals, and the grand total are customer-facing tax-inclusive paise amounts.
2. Included tax is a component of those amounts, not an additional charge. Therefore:

   ```text
   grandTotalPaise = itemsSubtotalPaise
                   - discountPaise
                   + deliveryFeePaise
                   + roundingAdjustmentPaise
   ```

   `taxPaise` is not added again.
3. Allocate the customer-facing discount across eligible inclusive item lines first. For each discounted inclusive line and its integer rate in basis points:

   ```text
   taxableAmountPaise = roundHalfAwayFromZero(
     discountedInclusivePaise * 10_000 / (10_000 + taxRateBps)
   )
   taxPaise = discountedInclusivePaise - taxableAmountPaise
   ```
4. Calculate lines independently in integer/rational paise arithmetic. Reconcile any allocation remainder using ADR-001's deterministic allocation rule. Order tax is the exact sum of snapshotted line and delivery tax components.
5. Item and delivery tax rules are separate, effective-dated, versioned, configurable demo rules. Rule selection uses the store business date from ADR-005. Overlapping applicable versions are invalid; absence of an applicable required rule fails the quote rather than silently assuming a rate.
6. Persist the applied rule identity/version, rate, taxable amount, included tax, place-of-supply inputs, currency, and calculation-policy version on the order line or delivery snapshot. Later rule edits never rewrite an order.
7. Tax collected is a liability, never revenue. Recognized revenue excludes the included tax component.
8. Storefront and checkout copy says `Tax included`. Order details expose the breakdown without implying an extra charge.
9. Seeded registration data and rates are fictional and visibly labelled as demo data. Every generated receipt/invoice-like document must display exactly: `Portfolio demo — not a statutory tax invoice`.
10. The project does not generate IRNs or official QR codes, file GST returns, claim input tax credit, connect to government portals, or claim statutory accuracy.

## Alternatives considered

### Add tax on top of menu prices

Rejected because it conflicts with the approved consumer-facing tax-inclusive model and makes the displayed menu price differ from the expected checkout amount.

### Add extracted tax to the total again

Rejected because it double-charges the included tax component. Tax is disclosed and accounted for, not added twice.

### Hard-code a current GST rate

Rejected because rates and classification rules can change, and hard-coding would turn a portfolio demonstration into a misleading compliance claim.

### Omit tax entirely

Rejected because effective dating, exact extraction, snapshotting, liability treatment, and reporting are valuable financial-engineering demonstrations when the limitations are explicit.

## Consequences

- The customer total remains intuitive: displayed inclusive prices minus inclusive discounts plus inclusive delivery and any explicit rounding adjustment.
- Finance reporting separates the included tax liability from recognized revenue without changing what the customer paid.
- Quote, persistence, receipt, refund allocation, and ledger code must share one versioned calculation policy.
- Historical tax remains reproducible from snapshots even when demo rules change.
- The project demonstrates tax mechanics but cannot be presented as filing-ready or legally authoritative.

## Examples

### Included-tax extraction

A discounted inclusive item line is 20,000 paise at a 5% demo rate (`500` basis points):

```text
taxableAmountPaise = round(20_000 * 10_000 / 10_500) = 19_048
taxPaise = 20_000 - 19_048 = 952
lineTotalPaise = 20_000
```

The 952 paise tax is disclosed within the ₹200.00 line total; it is not added to make ₹209.52.

### Order total

For a 50,000 paise inclusive subtotal, 5,000 paise inclusive discount, 4,000 paise inclusive delivery, and zero rounding adjustment, the customer total is 49,000 paise. Included item and delivery tax are reported as components of that 49,000 paise.

## Testable invariants

- `grandTotalPaise = itemsSubtotalPaise - discountPaise + deliveryFeePaise + roundingAdjustmentPaise`.
- `taxPaise` is never added a second time to a tax-inclusive line, delivery fee, or order total.
- For each inclusive component, `taxableAmountPaise + taxPaise = discountedInclusivePaise`.
- `sum(lineDiscountAllocationPaise) = orderDiscountPaise`.
- `sum(itemAndDeliveryTaxPaise) = orderTaxPaise`.
- The same inputs, business date, stable line IDs, and rule versions produce byte-for-byte equivalent financial snapshots.
- A quote fails on overlapping or missing required rule versions.
- Changing a rule does not change an existing order snapshot.
- Recognized revenue excludes included tax.
- Every invoice-like output contains the required portfolio disclaimer and makes no statutory claim.
