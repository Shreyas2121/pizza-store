# ADR-006: Promotion resolution, eligibility, and governance

- Status: Accepted
- Date: 2026-09-12
- Decision owners: PizzaStore project owner and maintainers

## Context

PizzaStore is replacing the legacy coupon-only model with automatic offers and manually entered coupons. Pricing must remain deterministic across preview and checkout, promotions must not leak across store or role boundaries, and global redemption/budget limits must remain correct across all participating stores and online-payment reservations.

## Decision

### Exclusive discount modes

1. Every quote and order has exactly one `DiscountMode`: `none`, `automatic_deals`, or `coupon`.
2. Offers are discovered and applied automatically from authoritative store, catalogue, cart, user, clock, and usage data. Clients never submit an offer ID or remove an eligible offer independently of its cart item.
3. Coupons are hidden, code-based promotions. The server evaluates a coupon only when a customer manually submits its code; it never searches for or auto-selects a coupon.
   Normalized codes must satisfy the length cap after uppercase conversion, including Unicode expansions, before persistence.
4. If any offer has a non-zero application, or any pre-built deal bundle is present, a submitted coupon fails with `COUPON_NOT_COMBINABLE_WITH_OFFERS`. The server does not remove or reprice the offer or bundle to make the coupon eligible.
5. When both an applied offer and a deal bundle block a coupon, `couponEligibility.reasonCode` is `OFFER_APPLIED`. `conflictingLineIds` contains the sorted union of every offer-affected and deal-bundle line. `DEAL_BUNDLE_PRESENT` is used when bundles are the only blocker.
6. Coupon mode contains exactly one coupon application. Automatic-deals mode may contain multiple offer applications, but only through non-overlapping winning unit/delivery allocations.

### Deterministic offer resolution

1. Authoritative cart units are expanded in ascending stable line ID and then ascending zero-based unit index. A unit can receive at most one offer allocation; different units and lines may receive different offers.
2. Each eligible offer calculates its candidate allocation independently. Percentage calculations use integer basis points. A fixed amount applies once per promotion evaluation, is capped by its eligible basis, and is allocated by ADR-001. A cart-level candidate is allocated across eligible units before overlap resolution.
3. For every unit, the candidate with the largest saving wins. Equal savings are resolved by `displayPriority` descending and then promotion ID ascending. Input/query order is never a tie-breaker.
4. Allocations from losing candidates are discarded and are not redistributed. A promotion is returned or persisted only when at least one of its allocations survives and its total saving is positive.
5. BXGY forms `floor(qualifyingBuyUnits / buyQuantity)` groups, supports repeated groups, consumes a unit at most once, and chooses get units by authoritative base-unit price ascending, stable line ID ascending, then unit index ascending.
6. Tiered promotions choose exactly one highest qualifying tier using the pre-promotion eligible subtotal. Fixed and percentage savings never exceed the eligible basis, and aggregate item discounts never exceed the item subtotal.
7. Item discounts use base-product value only unless `includeCustomizationValue` is explicitly true. Minimum order value and tier qualification use the complete pre-promotion item subtotal, including customizations and excluding delivery. Minimum cart quantity is the sum of purchasable line quantities; a bundle counts as one unit rather than the sum of its components.
8. Preview and final checkout use the same pure resolution engine. Final checkout rebuilds authoritative inputs and resolves again inside its transaction.

### Eligibility time and identity

1. Promotion validity is half-open: `startsAt <= now < endsAt`. `endsAt` must be later than `startsAt`.
2. Day and time restrictions use the selected store's snapshotted IANA timezone. Weekdays are integers `0=Sunday` through `6=Saturday`.
3. A non-overnight window `[startTime, endTime)` belongs to the current local date. An overnight window where `startTime > endTime` belongs to the local date on which it starts: for a Tuesday `22:00-02:00` window, Tuesday 22:00 through Wednesday 01:59:59.999 is the Tuesday window. Equal start and end times are invalid; two null times mean unrestricted.
4. An anonymous customer is ineligible for first-order or per-user-limited promotions because eligibility cannot be proven. Coupon validation against the active cart is authenticated.
5. First-order eligibility is disqualified by an existing order in `awaiting_payment`, `pending`, `preparing`, `out_for_delivery`, or `delivered`. `cancelled` orders and failed payment attempts do not disqualify.

### Global governance, capacity, and store participation

1. Promotion definitions are global. Only a platform admin with `platform.promotions.manage` may create, edit, schedule, activate/deactivate, change rules or budgets, manage media, or read global analytics.
2. Stores participate by default. Absence of a `(promotionId, storeId)` setting means enabled. Only an active same-store `manager` with `store.promotions.toggle` may create or change that explicit store setting. Other store roles cannot read the management endpoint or toggle participation.
3. Global deactivation always wins. Reactivation restores each store's last explicit setting; it does not overwrite store choices.
4. Redemption limits and budgets are global across stores. `null` means unlimited; no numeric sentinel is accepted in the new domain.
5. Reserved and consumed application rows occupy global and per-user redemption capacity. Their exact item plus delivery savings occupy budget. Released rows occupy neither.
6. Application rows are usage truth. No mutable redemption/spend counters are part of the write contract.
7. Final checkout lock order is: cart row; user eligibility row/key; store row; required store-product rows by ascending ID; promotion rows by ascending ID; existing store-setting rows by promotion ID; then application/reservation rows by ascending ID. Capacity is checked while promotion rows are locked. A manager toggle locks the store, then promotion, then existing setting in the same relative order, so default-enabled absence cannot race final resolution.
8. Definition changes affect new quotes/orders only. Every material definition or media edit increments `definitionVersion`; immutable order applications retain the version and values they captured.
9. Exhaustion is derived from reserved-plus-consumed application rows. It blocks new applications but does not silently change the administrative `isActive` flag; a released reservation can therefore restore capacity without an admin reactivation.

#### C07 catalogue lock refinement

Within the catalogue stage, checkout locks all parent/component product rows by ascending product ID with `FOR NO KEY UPDATE`, then the complete required store-product set by ascending store-product ID. Referenced customization options use the same non-key lock in ascending ID, followed by product/group mappings in product/group order. Non-key locks stabilize prices, names, availability and bundle definitions without blocking foreign-key key-share reads from promotion-rule writers already holding promotion locks. Bundle writers lock affected stores ascending before products ascending and store-product writes. Checkout reads component identities before product locks and verifies them after acquisition; a changed component set fails with `CHECKOUT_CATALOGUE_CHANGED` instead of acquiring additional lower-ID locks.

Cart mutations lock their parent cart before reading quantities or modifying children. Cancellation locks the order, then its user/store before restoring inventory and handling applications. Re-acquiring an already-held user/store/product/promotion lock in a caller transaction adds no new lock dependency. PostgreSQL race/deadlock integration evidence remains required; query-construction tests do not prove these properties.

## Alternatives considered

### Let the customer choose between an offer and a coupon

Rejected because an advertised automatic deal must not disappear when a coupon is entered, and client choice would make pricing easier to manipulate.

### Stack a coupon with distinct-line offers

Rejected because the owner decision makes the whole cart coupon-ineligible when any automatic deal or deal bundle is present.

### Choose the best promotion for the cart as one aggregate

Rejected because different units may receive different offers and the product contract requires a deterministic best offer per unit.

### Use mutable usage and spend counters

Rejected because counters can drift from reservations/applications during retries and recovery. Indexed application aggregates are the authoritative source.

### Evaluate time windows in UTC or server time

Rejected because offer advertising is store-local and must be stable across deployments and DST-capable timezones.

## Consequences

- Quote construction must include stable unit identities, category IDs, store prices, separate base/customization amounts, user eligibility facts, store-local time context, and global application aggregates.
- Offer discovery is informational; the quote is authoritative and checkout re-resolves it under locks.
- Public endpoints can return offer-kind rows only. Coupon codes are disclosed only in a direct validation result, an authorized admin/store-management response, or the immutable owning customer's order.
- Capacity errors can appear between preview and checkout and must use stable error codes rather than message parsing.

## Testable invariants

- An order never contains both offer-kind and coupon-kind applications.
- A unit receives at most one offer allocation.
- Equal inputs produce equal winners independent of database row order.
- Any applied offer or deal bundle rejects a submitted coupon.
- `startsAt` is inclusive and `endsAt` is exclusive.
- Overnight windows use the weekday of their local start date.
- Reserved plus consumed applications exactly determine occupied usage and budget.
- Only platform admins mutate global definitions; only same-store managers toggle store participation.
- Definition or store-setting changes never alter an existing order/application snapshot.
