# C13 — Checkout eligibility and saved order savings

- Branch: `feature/promotions-overhaul`.
- Starting SHA: `5834adc508014d73ad3d5ad58385845ee392622a` (C12).
- Prerequisites: `f217d41` isolates private caches by account; `51a2842` repairs cart/catalogue invalidation. Each includes failing-before/passing-after regressions and a separate handoff.
- Feature commit: `feat(frontend): explain automatic deals and manual coupon eligibility`. Resolve its SHA with `git log -1 --format=%H -- docs/promotions-c13-handoff.md`.
- Implementation date: 2026-10-07.

## Completed behavior

Checkout renders authoritative `discountMode`, coupon eligibility and conflicting line IDs. Automatic offer names and item/delivery savings appear only in automatic mode; one manually validated coupon appears only in coupon mode. Ineligible input is disabled, with `OFFER_APPLIED`/`DEAL_BUNDLE_PRESENT` explanations and links to the affected cart lines. Discovery remains available through View offers. No offer selection or inferred client eligibility is sent to the server.

Manual validation posts only `couponCode` to `/promotions/validate`, consumes an abort signal and accepts only a matching coupon-mode response without offers. An observable coupon session belongs to one account/store/cart revision/address. Context changes clear input and applied code, cancel pending validation and ignore late responses. Repeated validation while pending is blocked. Errors remain inline, associated with the input through Mantine's description/error API, announced and focused. A removed or newly invalid coupon requires manual re-entry; the current delivery quote is fetched after validation.

Authenticated checkout quotes omit explicit `items` so the server reads the owned cart and preserves actual cart line IDs. Keys include account and cart context; obsolete queries are cancellable. Quotes refresh on focus and every 30 seconds while visible, with at most one transient retry and no retry for HTTP client errors. Refreshing, failed, mismatched or unresolved-store states suppress old prices/promotions and disable ordering. Identity/quantity/customization mismatch requests a cart refresh; matching by line ID also supports reordered responses. The client does not compare or recompute prices. Stable coupon rejection codes clear the applied code and reload a base quote. Final checkout remains authoritative and transactional.

One shared breakdown formats supplied subtotal, item discount, charged delivery, rounding, included tax and grand total. A separate panel explains item savings, delivery savings, combo markdown and total displayed savings. Displayed savings never subtract from payable again. Customer and admin order details use saved product/customization/component names, post-discount line totals, compare-at markdown, promotion names/types/status and allocation links. The customer order list shows saved savings and discount mode. Current product images only decorate historical lines.

COD and online initiation retain the existing optional manual coupon contract. Online request identity resets with checkout context or coupon changes. Address/payment/coupon controls are disabled during placement. Placement failures show inline feedback and refresh pricing/cart/catalogue data. Saved online orders retry by order ID, explain their captured total and promotions, and retain inline retry errors. No new quote or promotion selection is sent on retry.

## Boundaries and prerequisite fixes

C13 changes checkout controllers, types, queries and presentation; shared order snapshot types, history/detail presentation; the promotion code-length constant's public export; and guide/README/API/architecture documentation. Retired coupon field/mutation files are removed. No dependency, backend endpoint, schema, migration, tax policy, inventory behavior, payment reservation/reconciliation or financial posting changes.

The required account-isolation fix expanded into auth/profile/address/cart/order query hooks and shared query transport. Six regressions demonstrated private cached data crossing account boundaries. Private reads now include principal identity, signed-out reads are disabled, order placeholders are removed and requests consume cancellation signals. See [account isolation](checkout-order-account-isolation.md).

The required invalidation fix expanded into cart/catalogue key factories. Two regressions demonstrated that existing `['cart']` and `['catalog']` invalidations matched no relevant keys. All keys now share their respective root. See [cache invalidation](cart-catalog-invalidation.md). Both fixes were committed separately before the feature.

## Verification and remaining evidence

The baseline frontend gate passed 59 tests in 7 files, lint, typecheck and build. Each prerequisite passed its frontend gate before and after commit (65 and 67 tests respectively). The final frontend suite has 96 tests in 12 files: 29 C13 cases plus 8 prerequisite regressions. Coverage includes manual-only validation, pending/abort/late responses, checkout context changes, stable errors and bounded retry, quote cancellation/keys/owned-cart transport, offer/coupon exclusivity, conflict links, input error association, stale/loading/error presentation, server line identity, payable versus displayed savings, payment initiation/retry transport and saved order snapshots.

The frontend full gate passed, and pre-commit `pnpm.cmd preflight` passed both packages' lint/typecheck/test/build: 866 backend tests in 120 files and 96 frontend tests in 12 files. `git diff --check` passed; staged diff and post-commit preflight are required before completion. Preflight performs no live database operations. The implementation completion message records the post-commit result. Existing lint warnings are 298 backend and 3 frontend; existing Vite chunk/barrel import warnings remain.

Rendering tests use React's server renderer with real Mantine and existing Vitest infrastructure; controller and transport tests execute async behavior. No browser walkthrough was run. Browser focus, click/keyboard interactions, rapid changes across tabs, viewport layouts and actual provider popup recovery remain C14 manual checks. No live database verification, migration application, seed/reset, database concurrency or live finance reconciliation was run, per persistent owner instructions. C13 does not claim the C14 release gate is complete.

C14 owns deterministic fixtures, complete operational/release documentation and integration/manual evidence, while carrying forward the owner's database-check restriction.
