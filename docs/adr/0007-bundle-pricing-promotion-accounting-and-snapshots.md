# ADR-007: Bundle pricing, promotion accounting, and immutable snapshots

- Status: Accepted
- Date: 2026-09-12
- Decision owners: PizzaStore project owner and maintainers

## Context

Pre-built combos, item promotions, coupons, and free delivery all advertise customer savings, but they do not share the same taxable or accounting treatment. Online payments also need a stable amount after a promotion is edited, deactivated, exhausted, or disabled for a store.

## Decision

### Pre-built bundles

1. A combo is a catalogue product with `productType = bundle`, not a promotion rule. The customer adds it as one cart/order line.
2. Bundle component rows describe positive component quantities for display and inventory demand. A bundle cannot contain itself or another bundle, and duplicate component rows are forbidden.
3. `store_products.price_paise` is the authoritative bundle selling price. `compare_at_price_paise` is required for a marketed deal bundle and must be greater than the selling price.
4. Bundle markdown is `(compareAtPricePaise - sellingPricePaise) * quantity`. It is display metadata only: it does not enter taxable pricing, `orders.discount_paise`, promotion applications, refunds, or ledger account `4100`.
5. Component prices are not summed or repriced at checkout. Bundle availability and stock demand expand to components, aggregate with standalone demand, and use deterministic store-product lock order. The bundle SKU has no independent stock pool.

### Customer totals and tax

1. All amounts are integer paise under ADR-001. Rates are integer basis points.
2. `itemsSubtotalPaise` uses authoritative selling prices plus eligible customization charges. `itemDiscountPaise` contains offer/coupon item savings only and feeds `orders.discount_paise`.
3. `standardDeliveryFeePaise` is the fee before a delivery offer. `chargedDeliveryFeePaise` is the amount charged. `deliveryDiscountPaise = standardDeliveryFeePaise - chargedDeliveryFeePaise`.
4. `promotionSavingsPaise = itemDiscountPaise + deliveryDiscountPaise`. `totalDisplayedSavingsPaise = promotionSavingsPaise + bundleMarkdownPaise`.
5. `grandTotalPaise = itemsSubtotalPaise - itemDiscountPaise + chargedDeliveryFeePaise + roundingAdjustmentPaise`. Delivery savings and bundle markdown are not subtracted again.
6. Inclusive item tax is recalculated independently on every post-discount order-item line. Delivery tax is calculated only on the charged delivery fee. Taxable components plus included tax reconcile exactly to their charged inclusive amounts under ADR-004.
7. Pricing policy v4 does not independently apply the legacy delivery-pricing free-delivery threshold. A new quote waives a positive standard fee only through an eligible `free_delivery` offer, ensuring every non-zero `deliveryDiscountPaise` has one promotion allocation and budget owner.

### Ledger and refund treatment

1. At delivery, pre-discount tax-exclusive food revenue credits store-scoped account `4000`; the tax-exclusive component of actual item offer/coupon discounts debits store-scoped account `4100`; post-discount included tax credits `2200`.
2. Free delivery records zero delivery revenue for the waived portion. `deliveryDiscountPaise` remains promotion/budget analytics data but creates no account `4100` entry.
3. Bundle compare-at markdown creates no ledger entry because the compare-at amount was never charged or recognized.
4. Platform reporting consolidates already-adjusted store journals and never subtracts promotion spend a second time.
5. Refunds allocate from immutable paid post-discount item, charged delivery, and tax snapshots. They never refund compare-at markdown or more than the customer paid.
6. This policy assumes company-operated stores within one PizzaStore entity. It defines no platform-funded subsidy, franchise reimbursement, marketplace commission, or intercompany balance; any such funding model requires a superseding ADR and explicit funding-source allocations.

### Immutable order and payment lifecycle

1. Order items snapshot product/bundle name, selling price, compare-at price, markdown, and customization values. Bundle component snapshots retain component product ID, name, quantity per bundle, and total quantity.
2. Each promotion application snapshots kind, name, normalized coupon code or null, discount type, definition version, status, item saving, delivery saving, total saving, standard delivery fee, and charged delivery fee. Allocation rows identify the affected order item or delivery component.
3. COD creation consumes applications in the successful order transaction. Razorpay initiation reserves applications and exact budget/capacity with the immutable order amount.
4. Capture consumes reservations exactly once. Confirmed failure/expiry releases them exactly once. Retry/restore uses the same immutable application snapshots and provider amount; it does not recalculate against current promotion definitions or store settings.
5. Reservations and releases do not recognize revenue. Existing online orders remain payable under their captured contract after definition edits, global deactivation, or store opt-out.
6. A customer retry restores original inventory demand and checks current global/per-user promotion capacity and budget atomically. It never recalculates promotion eligibility or prices. Cancelled/expired orders cannot retry; they require a new checkout.
7. Verified provider capture may restore released promotion capacity without enforcing current limits, then consume the original collection, because the customer already paid the captured contract. This exception does not authorize customer retries or unpaid provider-order attachment to bypass capacity. Inventory shortages remain conflicts requiring operational resolution. Captures received after order cancellation remain `PAYMENT_ORDER_NOT_PAYABLE` conflicts rather than resurrecting fulfillment.
8. Receipt attachment verifies the immutable amount/currency/receipt, preserves failed/completed/refunded state, and does not restore released applications. Retry searches by receipt before creating another provider order after an unattached creation failure.

## Alternatives considered

### Model a combo as a BXGY or cart promotion

Rejected because a combo is purchased as one advertised SKU and its components exist for display/inventory, not for searching separately added cart items.

### Book compare-at markdown as a discount

Rejected because it would debit revenue that was never booked and would distort refunds and promotion budgets.

### Put delivery savings in the item discount field

Rejected because zeroing delivery and subtracting the same saving as an order discount double-counts the benefit and breaks reconciliation.

### Recalculate promotions during payment retry

Rejected because it could change an already-created provider amount and make webhook/recovery behavior non-idempotent.

## Consequences

- Customer-facing savings have three deliberately separate components: item promotion/coupon, delivery promotion, and bundle markdown.
- Orders need immutable application/allocation and bundle-component rows rather than mutable joins to current definitions.
- Financial events need both inclusive customer savings and tax-exclusive posting components.
- Payment recovery operates on captured snapshots, while new quotes use current definitions and store settings.

## Testable invariants

- Bundle markdown never contributes to `orders.discount_paise`, promotion budget, account `4100`, or refund capacity.
- `sum(item allocations) = itemDiscountPaise` and `sum(delivery allocations) = deliveryDiscountPaise`.
- Every charged line reconciles as `taxableAmountPaise + taxPaise = lineTotalPaise`.
- The quote grand-total equation holds exactly.
- Every delivered-order journal balances and platform consolidation applies each store discount once.
- Reservation, consume, release, and restore are idempotent for every application row.
- Later promotion, catalogue, or store-setting edits do not change order history or an existing provider amount.
