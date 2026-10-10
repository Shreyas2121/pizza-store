# Promotion governance and media operations

Reviewed on 10 October 2026. Administration, authoritative pricing, COD/online snapshots, recovery, finance, public discovery and frontend governance are implemented. Deterministic fixtures and offline reconciliation support the policies; current executed checks and remaining PostgreSQL/browser/provider gates are in [verification](case-study-verification.md).

Only platform admins with `platform.promotions.manage` create, replace, deactivate, upload or remove media, or read analytics. `PUT /promotions/:id` is a full replacement with `expectedDefinitionVersion`. Deactivation preserves rules, media, historical applications and store choices. Exhaustion is derived from reserved plus consumed applications and never flips the administrative active switch.

Only an active same-store manager with `store.promotions.toggle` reads the manager list or writes participation. Platform admin overrides are deliberately denied for these manager endpoints. Absence of a setting means enabled. Disabling requires a trimmed reason; re-enabling restores participation without editing the definition. Global deactivation wins over explicit settings.

The manager mutation rechecks and locks membership within its transaction, then locks store, promotion and existing setting in that order. The store lock covers default-enabled absence. COD checkout follows ADR-006's compatible relative order, including user eligibility serialization and sorted catalogue locks. Unit tests check orchestration; PostgreSQL races are not claimed verified.

COD applications consume exact item and delivery savings in the transaction that writes the order, payment/attempt, stock movement and cart deletion. Online checkout reserves the same snapshots before provider creation. Reserved and consumed applications occupy global/per-user limits and exact global budget; released applications occupy neither. There are no mutable usage counters. Collection record/consume/release/restore operations verify snapshots and are idempotent. Retry checks capacity for the full released collection before updating, preserves captured amounts/versions after edits or opt-out, and never reprices. Consumed COD applications remain consumed on cancellation.

## Online payment recovery

Capture restores released applications under the saved contract and consumes the complete collection exactly once. Only verified provider capture bypasses current promotion capacity: captured customer money must retain its original discount, even if released capacity was subsequently occupied. Inventory restoration still checks physical stock; a stock conflict rolls back finalization and requires operational resolution. This bypass cannot be used by customer retries or receipt attachment. Reservations produce no revenue event; capture retains the existing payment-captured event, with revenue and standard cost recognized separately on delivery.

Failure releases inventory and all promotion reservations in one transaction. An owned failed `awaiting_payment` order can retry after restoring original inventory demand and promotion capacity together. Current opt-outs, deactivation, schedule expiry, names and definition versions do not reprice its snapshots. Capacity/budget or stock shortages reject the retry; cancelled/expired orders require a new checkout. Retrying a missing provider identity searches the saved receipt before creating a new order. Receipt recovery verifies amount/currency/receipt and preserves failed or terminal state without restoring released capacity.

Expiry considers both inventory deadlines and persisted payment-attempt deadlines for awaiting-payment holds, including orders with no tracked inventory. Provider outage, authorized payment, inconsistent paid state, or in-flight creation without an attached provider identity preserves reservations and reports a conflict/error. Before release, order/payment locks recheck completion, provider identity and activity since discovery; a concurrent retry or capture is preserved. Signed webhook duplicates do not repeat consumption, and current provider state takes precedence over out-of-order event hints. PostgreSQL concurrency and live provider/manual checks have not been run.

Success audits are committed with mutations and include actor, promotion version, before/after state, store and reason where applicable. Failure auditors run before authentication/authorization and persist safe operation/resource IDs and a stable reason code. They do not copy coupon codes or upload bytes into attempts. Every request retains the existing correlation-ID behavior.

## Images

The multipart request has `variant`, `imageAlt`, and one `file`. JPEG, PNG and WebP are decoded and re-encoded by `sharp`; header-only checks are insufficient. SVG, GIF, animation, truncated pixel data, MIME/extension mismatches, excess bytes and invalid variant dimensions are rejected. Re-encoding strips requester metadata and trailing content. Named byte and dimension limits live in `promotion.constants.ts`.

The media service uses Sharp to decode, validate and re-encode content; multipart parsing alone does not establish that an uploaded image is valid.

Files live under the backend working directory's `uploads/promotions`, matching the existing `/uploads` static server. API values are application URLs with randomized UUID filenames; requester filenames never determine storage paths. Mobile display falls back to desktop in the consuming UI when its URL is null. Offers without media remain valid discovery cards; featured placement requires desktop media and useful alt text.

Replacement writes the validated file, updates the reference/version and audit in a transaction, commits, and then removes the old unreferenced file. A DB failure preserves the old reference/file and leaves the new file for orphan cleanup. Post-commit deletion failure logs a safe storage key and correlation ID; the successful API response continues to reflect committed database truth.

`DELETE /promotions/:id/images` removes one variant. Removing desktop media disables homepage placement. Removing the last variant clears alt text. Deactivation never removes media.

## Orphan cleanup

Run from the repository root:

```powershell
pnpm.cmd --filter backend promotions:cleanup-media
```

This maintenance command uses the configured database and filesystem. Run it only against the intended application environment. It is not part of unit tests or preflight.

Cleanup takes the same transaction advisory lock as media writes, reads only current image references, and removes only unreferenced UUID-named files at least 24 hours old. It skips symlinks/junctions, non-file entries, unmanaged names and recent files. Path validation confines removal to the media root. Repeating cleanup is safe. A failed cleanup can be rerun; referenced assets are preserved.

## Analytics

Admin analytics use inclusive order pricing business dates and current application states. Reserved/consumed/released counts are separate. Savings, influenced order value and distinct users include consumed applications only. All report money and counts are canonical decimal strings, with platform distinct users calculated globally.

`influencedOrderValuePaise` is the order's immutable payable amount associated with this promotion, not incremental sales or recognized revenue. `netRevenueReductionPaise` apportions the actual tax-exclusive item line reduction across its applications. Inclusive tax rounds the tax component first; analytics uses the same policy, including half-paise ties. Delivery savings and bundle compare-at markdown contribute no item contra-revenue. Platform monetary totals reconcile to the per-store breakdown; distinct users are calculated globally rather than summing store counts.

Delivery recognition validates the saved item subtotal, inclusive item discount, charged delivery, tax and payable amount before publishing `order.delivered.v1`. Store account `4000` credits pre-discount tax-exclusive food revenue, `4100` debits the tax-exclusive item discount, and `2200` credits paid post-discount tax. Platform finance reports sum those store journals with no additional promotion deduction. Application analytics includes consumed orders before delivery and uses the pricing business date; ledger revenue uses the delivery business date. Compare equivalent delivered-order populations and dates when reconciling the two.

Refund capacity uses immutable paid line totals and charged delivery only. Partial refunds apportion saved paid tax cumulatively; the final allocation receives the remaining tax and quantity-rounding paise. A released refund reservation cannot cause negative tax in a replacement allocation. Delivered refunds debit `4110` and reverse paid tax; they do not debit or credit the original `4100` discount again. Bundle compare-at savings and waived delivery cannot be refunded.

## Customer and governance screens

Platform admins use `/admin/promotions` for definition/versioned editing, media, placement and analytics. Store managers use `/admin/store-promotions` for read-only global definitions and reason-backed participation changes. Definition drafts retain their captured version until explicit reload; media edits are separate. Customers use `/offers` and `/offers/:id/products`; discovery advertises conditions but never replaces the owned-cart quote. Store changes/errors hide stale offer results.

Checkout shows item savings, delivery savings and bundle markdown separately and reports coupon conflict/eligibility from the server. Saved history reads application/allocation/component snapshots, including released applications, rather than current campaign labels.

## Development promotion fixtures

The base `db:seed` creates eight validated global definitions and a pizza/drink combo after the catalogue/default store. For existing development catalogue/admin/store data, `pnpm --filter backend seed:promotions` adds missing fixture identities without replacing existing versions/media/store choices. Fixture identity uses kind/name and normalized code uniqueness; renaming a fixture can result in a new definition on rerun.

| Fixture | Behavior |
| --- | --- |
| Demo pizza 10 percent | Margherita savings with desktop/mobile featured artwork |
| Demo pizza 20 rupees off | Pizza-category fixed savings; desktop-only mobile fallback |
| Demo buy two get one pizza | Repeated eligible buy/get groups, text fallback |
| Demo delivery saving | Free-delivery offer from ₹200 item subtotal, only when an ordinary fee remains |
| Demo cart tiers | 5% from ₹1,000; 10% from ₹2,000; explicit caps |
| DEMO10 / DEMO30 | Manual percentage/fixed coupon on an offer-free non-bundle cart |
| DEMOFIRST | First-order tier coupon with normal eligibility and per-user capacity rules |

The fixed `demo:reset` adds Mumbai/Bengaluru managers, a customer with no orders and both-store addresses, one Bengaluru opt-out and the July/August finance scenario. [Recruiter showcase seeding](recruiter-demo.md) is a different seed with different codes, accounts and dates.

Trusted fixture SVG artwork is rasterized to managed UUID-named WebP files beneath `uploads/promotions`. Public upload validation still rejects SVG. Existing fixture files are not overwritten and incompatible paths/symlinks fail. Catalogue photos remain optional local assets rather than generated promotion artwork.

## Rehearsal and release checks

Before claiming a complete runtime release, exercise version conflicts, manager-only toggles and two-store isolation; offer-free coupon and first-order boundaries; component stock shortages; failure/retry/expiry/late capture and duplicate observations; media fallback and keyboard/reduced-motion controls; order savings, refunds, store journals and consolidated totals. Offline fixtures verify policies, not live campaign capacity races or the browser/provider flow.
