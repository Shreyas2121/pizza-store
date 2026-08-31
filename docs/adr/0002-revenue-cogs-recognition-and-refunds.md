# ADR-002: Revenue/COGS recognition, cancellation, and refunds

- Status: Accepted
- Date: 2026-08-31
- Decision owners: PizzaStore project owner and maintainers

## Context

An order, its collection, its fulfilment, and a later refund are different events. Treating payment capture as revenue overstates performance for paid-but-undelivered orders. Treating every refund as a stock return also invents an operational fact: prepared food is commonly refunded without becoming reusable inventory.

The project needs a simple policy that is credible in a portfolio demonstration, produces repeatable store P&L, and supports an append-only ledger later.

## Decision

1. Recognize food revenue, eligible delivery revenue, and the snapshotted standard COGS exactly once when the order first reaches canonical `delivered`.
2. The recognition time is the persisted UTC transition time. The recognition business date is derived using ADR-005 and snapshotted so later timezone changes cannot move history.
3. Razorpay capture records a collection into provider clearing; it is not revenue. Razorpay settlement clears the provider balance into bank; it is not new revenue.
4. A COD order records collection only when it becomes `delivered` with the required staff confirmation. It belongs to exactly one open cash session for that store and business date.
5. `out_for_delivery` is not a recognition or COD-collection event. A duplicate delivery command/event must have no second financial effect.
6. Cancellation before delivery creates no revenue or COGS. Any earlier online collection remains a payment/refund obligation until separately resolved.
7. A post-delivery cancellation or finalized refund never edits or deletes the original recognition. It creates explicit, linked reversal/contra entries for the allocated recognized revenue and included tax. Delivery revenue and tax reverse only to the extent assigned by the finalized refund allocation.
8. A refund does not imply an inventory return. COGS reverses only when a separate explicit fulfilment/inventory-return event establishes that the recognized cost should return to inventory. If refunded food is not returned, original COGS remains recognized.
9. Requested, approved, submitted, failed, or cancelled refunds do not affect recognized results. Only a finalized/processed refund does, and its total processed amount cannot exceed captured or collected funds.
10. Reports expose recognized revenue and refunds separately. Gross profit is recognized revenue less COGS; it must not substitute collections or gross order value for recognized revenue.

## Alternatives considered

### Recognize revenue on online capture or order acceptance

Rejected because collection and performance are not the same event, and cancelled or undelivered orders would inflate revenue.

### Recognize at `out_for_delivery`

Rejected because customer fulfilment is not complete and the order can still fail before delivery.

### Rewrite the original order or journal after a refund

Rejected because it destroys the audit trail and makes reports change without a traceable correcting event.

### Reverse COGS for every item refund

Rejected because a monetary refund alone does not prove goods returned to usable inventory. This would overstate inventory or understate food cost.

## Consequences

- Payment, fulfilment, refund, settlement, inventory-return, and reporting states remain explicitly separate.
- Delivered orders require an immutable price and standard-cost snapshot before recognition can post.
- Retry-safe source identity/version controls are required so delivery and reversal events post once.
- A goodwill refund can reduce net revenue while leaving COGS unchanged, which is economically honest when food was consumed, discarded, or never returned.
- Correcting recognized history requires linked reversals; operational rows and posted journal entries are not overwritten.
- Refund allocation must identify item, delivery, discount, and included-tax effects before ledger posting.

## Examples

### Captured but not delivered

An online order for ₹500 is captured and later cancelled before delivery. Collections temporarily show ₹500 in provider clearing, recognized revenue and COGS remain zero, and the refund lifecycle resolves the ₹500 obligation.

### Delivered once

A ₹500 order reaches `delivered`. Revenue and its cost snapshot are recognized once. Replaying the delivery event changes neither amount.

### Goodwill partial refund without return

A delivered order receives a finalized ₹100 item refund. The allocated revenue and included tax are reversed through linked entries. With no explicit inventory return, the original COGS remains unchanged.

## Testable invariants

- An order has at most one original recognition event/version and one immutable `recognizedAt` value.
- `awaiting_payment`, `pending`, `preparing`, `out_for_delivery`, cancelled-before-delivery, and payment capture produce no recognized revenue or COGS.
- Canonical `delivered` recognizes the snapshotted revenue and COGS exactly once.
- Replaying a source event/version creates no duplicate financial effect.
- A finalized reversal links to its source; the original posted record remains unchanged.
- Refund states before finalization have no recognized financial effect.
- `sum(processedRefundPaise) <= capturedOrCollectedPaise` for the order.
- A refund without an explicit inventory-return event does not reverse COGS or increase inventory.
- COD collection belongs to exactly one open session for the order's store and recognition business date.
