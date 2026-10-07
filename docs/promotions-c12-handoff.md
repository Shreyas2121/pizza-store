# C12 — Offer discovery and bundle merchandising

- Branch: `feature/promotions-overhaul`.
- Starting SHA: `7d02ae275cbab578eba86a044d066125144dc835` (C11 and its prerequisites integrated).
- Feature commit: `feat(frontend): add offer discovery and bundle merchandising`. Resolve its SHA with `git log -1 --format=%H -- docs/promotions-c12-handoff.md`.
- Implementation date: 2026-10-07.

C12 adds the customer discovery and catalogue/cart presentation slice. Checkout eligibility explanations and historical order UX remain C13. This handoff does not claim the C14 release gate is complete.

## Completed behavior

`/offers` lists public offers for the resolved delivery store. Cards display uploaded artwork or a readable fallback, offer names/descriptions, discount descriptions, minimum subtotal/quantity, first-order restrictions, validity in the store timezone, local day/time windows, and BXGY/tier summaries. Offers are informational: there is no Apply action and no client offer ID is sent to checkout. The navbar links to this page.

`/offers/:id/products` links each card to its product/category targets. It loads the existing store-priced `/product/menu` endpoint one page at a time on explicit request, filters by public target IDs, and renders ordinary product cards. No target-specific backend endpoint is added. Matching products on later pages require “Load more menu products”; an empty loaded page is distinguished from exhausting the catalogue. Unrestricted cart/delivery offers browse all menu products. Targets describe discovery, while checkout decides cart eligibility, capacity and the winning offer. A promotion removed from discovery cannot continue to display its target catalogue through the offer route.

Public discovery uses `/promotions/offers` and `/promotions/featured` exclusively. Cache keys contain store ID and featured placement. Requests consume cancellation signals; pending store resolution hides old results, and store changes do not use previous-store placeholder data. Explicit refresh and window-focus refetch pick up updated participation/schedules. Failed refreshes hide stale cards and offer retry. Missing-store, loading, empty, error and refreshing states are explicit.

The homepage slider orders display priority descending, then promotion ID ascending, and displays at most five offers. It starts paused, has explicit previous/next controls and optional seven-second rotation, and supports left/right arrow keys. Focus stops rotation, pointer hover suspends it, and hiding the page stops it. Reduced motion removes the play control and prevents automatic rotation. Only one slide is rendered; its product link stays mounted across navigation. The slide/count has accessible labels and manual changes announce the position. Existing global focus styles provide visible focus rings. `<picture>` uses mobile artwork below 640px with desktop fallback when the mobile variant is absent, meaningful alt text, and contain sizing so banner text is not cropped. Missing/broken artwork renders readable offer content. Media/slide keys reset image failure state when the source changes.

Bundle product cards use backend selling/compare-at prices and supplied markdown. They show a struck-through regular price, combo price, savings and per-combo contents, plus one Add Combo action through the existing authenticated cart mutation. Unavailable bundles are disabled. Bundles bypass customization selection. Cart bundles remain one line, display supplied aggregate markdown, retain quantity/removal controls and expose per-combo contents through native keyboard-operable `<details>`.

## Changed boundaries

- New `frontend/src/features/offers/`: public DTO, display constants/helpers, cancellable queries, offer/media/region/slider components, discovery/target catalogue routes and tests.
- Catalogue product types, card, homepage, new bundle presentation components and public exports.
- Cart item DTO fields and bundle line presentation.
- Router and storefront navbar expose customer discovery.
- Promotion barrel exports existing discount/weekday presentation helpers and types for the customer feature. This is the only expansion into the C11 boundary; no governance implementation changes.
- Guide progress, architecture, API reference, README and this handoff.

No backend endpoint, schema, migration, permission, money calculation, tax policy, inventory mutation, payment lifecycle or financial posting change. Frontend types now describe the existing public offer and bundle metadata; no hidden code/admin DTO is used for discovery. Selling prices and markdown remain separate from promotion savings, and bundle markdown never changes payable or ledger amounts. No dependency or lockfile change.

## Verification

Baseline frontend gate passed: 40 tests in 6 files, lint with no errors and 3 existing warnings, typecheck and production build. During implementation, `pnpm.cmd preflight` passed: 866 backend tests in 120 files, 58 frontend tests in 7 files, both lint/typechecks/builds. Existing lint warnings were 298 backend and 3 frontend; existing Vite chunk/barrel-import warnings remain.

The final frontend gate includes 59 tests in 7 files (19 new C12 cases): `pnpm.cmd --filter frontend test`, `lint`, `typecheck`, `build`. The tests exercise public/store-specific transport, cancellation, on-demand pagination, priority ties, target matching, slider wraparound and accessible/reduced-motion markup, responsive media/fallback markup, store/loading/empty/error/stale states, bundle prices/contents, unavailable bundles and expandable cart summaries. Rendering tests use React's server renderer with existing Vitest infrastructure. They do not execute browser event handlers or prove responsive layout, timed rotation, broken-image events or focus interactions in a browser.

`git diff --check` and staged diff checks are required before integration; the post-commit gate follows the guide. Final gate results and the commit SHA are reported in the implementation handoff message.

No live database verification, migration application or seed/reset was run, per persistent owner instructions. No browser or visual walkthrough was run; this workspace exposes no browser tool/test dependency. Keyboard/focus/timer/pointer interactions, broken-media behavior and viewport layouts remain in the C14 manual matrix. No existing blocker was demonstrated during this slice; implementation-time import-boundary errors were corrected using public feature exports without disabling lint rules.

## Follow-up

C13 must render authoritative quote coupon eligibility and automatic savings, revalidate coupons when the cart changes, and finish immutable order-history presentation. C14 owns deterministic customer media/bundle fixtures, browser/manual evidence and the release gate. Catalogue stock and checkout remain authoritative for component demand; public discovery is neither a reservation nor a promise that an offer will win at checkout.
