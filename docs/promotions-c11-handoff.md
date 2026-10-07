# C11 — Promotion administration and store controls

- Branch: `feature/promotions-overhaul`
- Slice starting SHA: `ab2a072a05998eba46847b867a24bb997a3e7a55`
- Prerequisite fix: `b7c13b6` — isolate authenticated access capabilities by account.
- Feature commit: `feat(frontend): add promotion administration and store controls` (find the final SHA with `git log -1 --format=%H -- docs/promotions-c11-handoff.md`).
- Implementation date: 2026-10-07.

C11 implements the frontend governance slice. Customer discovery/homepage presentation is C12; checkout/history presentation is C13. This handoff does not claim the C14 release gate is complete.

## Workspaces and workflows

`/admin/promotions` is platform-only. It provides kind/global-status filters, bounded pagination, refresh, server-derived status badges, selected-store participation summaries, creation/editing, global deactivation/reactivation, media and global/per-store analytics. Editing a definition remains global even when a store is selected in the staff header. Platform users receive no manager participation controls.

The controlled definition form uses strict Zod validation matching the frozen backend write contract. It handles percentage, fixed amount, BXGY, tiered and free-delivery definitions; compatible kind/type/scope choices; product/category catalogue selectors; complete buy/get targets; unique tier thresholds; customization basis; eligibility; nullable limits and global budget. Empty required numeric fields remain invalid, and out-of-range inputs are not silently clamped. Amounts are integer paise and rates are integer basis points; the browser does not evaluate eligibility or calculate customer pricing.

Start/end timestamps are explicitly entered in UTC and retain seconds/milliseconds. The end is exclusive. Weekdays and paired daily windows use each participating store's configured IANA timezone, including overnight ranges owned by their starting weekday. A selected store's actual timezone is fetched and displayed; its loading failure does not substitute another timezone.

Edits retain a captured `definitionVersion`, even during background refresh. The full PUT includes `expectedDefinitionVersion`. A known newer version or `PROMOTION_VERSION_CONFLICT` blocks saving while preserving the draft. Reload requires confirmation before replacing the draft with the latest server definition; failed refreshes preserve it. Cancel confirms unsaved edits. Save failures focus an alert/validation summary. Mantine inputs have labels, and dialogs use [Mantine's modal focus and keyboard behavior](https://mantine.dev/core/modal/); browser interaction verification remains pending.

Media is a separate dialog, avoiding a media upload silently advancing an open definition draft's version. Desktop/mobile uploads support file previews, replacement, shared meaningful alt text, MIME/byte/dimension advisory checks, server validation, removal confirmation and desktop fallback for missing mobile media. Preview object URLs are revoked. The request contains exactly `file`, `variant`, and `imageAlt`; the Axios JSON default is removed so the browser supplies the multipart boundary.

To feature an offer: create/save with homepage placement off; upload desktop media with alt text; reopen Edit and enable homepage placement. Removing desktop media clears placement on the server. Coupons cannot be featured. Changing alt text uses a new upload of either variant, matching the existing API.

`/admin/store-promotions` is available only to a manager with `store.promotions.toggle` for the selected membership. It shows read-only global definitions, global status, server effective status, default/explicit participation, prior reason/actor/time and details. Disable/re-enable requires confirmation naming the promotion and store. Disable requires a trimmed, bounded reason; enable permits an optional reason. The choice follows `explicitSetting`, so a globally inactive promotion can retain a manager's participation preference without bypassing global activation. Other store roles and platform admins are denied.

The workspace remounts on store changes, clearing pending dialogs and pagination. Query keys include principal, store, promotion ID and all relevant filters. Queries pass cancellation signals to Axios following [TanStack Query's cancellation guidance](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation), omit cross-store placeholder data, and do not retry authorization/validation failures. Mutations invalidate the principal's governance queries after server success. Loading, empty, error, refresh and stale-edit states are explicit; stale list results following failed refresh cannot be used for participation/deactivation actions.

Analytics retain base-10 aggregate strings and format money through BigInt. Inclusive business-date and optional store filters are validated. The UI separates reserved/consumed/released applications, unique users, item discounts, delivery savings, total savings, influenced payable value and tax-exclusive item revenue reduction. It explicitly identifies application attribution rather than delivered-ledger recognition; reservations are not revenue.

## Changed boundaries

- New feature: `frontend/src/features/promotions/` — DTOs/constants/strict schemas, keys, queries/mutations, rule/discount/form/media/status/analytics/summary components, route guard, platform and store pages, tests.
- Router, staff layout titles and sidebar configuration add the two permission-specific entries. Page imports are direct lazy imports.
- The prerequisite access fix touches the shared capability-query key/API, its regression suite and architecture docs. See [account isolation](access-cache-account-isolation.md).
- Guide progress, API reference, architecture and README link this workflow.
- No endpoint, permission policy, schema, migration, price calculation, financial posting or transaction-lock behavior changes.

## Verification

Final `pnpm.cmd preflight` passed with exit code 0: 866 backend tests in 120 files and 40 frontend tests in 6 files; both typechecks and production builds; lint with no errors (298 existing backend warnings, 3 existing frontend warnings). Existing Vite barrel-import/chunk warnings remain. The targeted promotion suites passed 26 cases before the final retry-policy cases were added; the final gate includes all 28 promotion cases and the 2 access-cache regressions. `git diff --check` and `git diff --cached --check` passed, including newly added files.

The existing Vitest setup is used without adding dependencies or a frontend testing framework. Coverage includes strict input/rule/schedule/limit validation, UTC conversion, exact aggregate money, versioned writes and conflict preservation, multipart shape/header handling, query cancellation and account/store isolation, same-store manager restrictions and reason validation, route rendering, read-only details, labels and stale-save blocking. Rendering tests run through React's server renderer; they are not browser interaction tests.

No live database checks, migration application, seed/reset, or database-backed end-to-end checks were run, as requested. No browser create/edit/upload/toggle walkthrough, focus/keyboard/responsive checks or visual review was run. Those remain in the guide's manual release matrix. No dependency or lockfile change is required.

## Existing issue and follow-up

The demonstrated existing issue was the principal-independent `/access/me` cache. `b7c13b6` fixes it separately with two regressions. No unrelated refactor is included. Existing lint/build warnings are reported with the gate rather than suppressed.

Client form validators and constants mirror the frozen backend contract in this feature; future contract changes must update both sides. The API remains authoritative for target existence, unique codes, occupied limits/budget, decoded media and eligibility. Global date/day/time/status changes or another manager's participation updates are visible on refresh. Drafts are held in memory and are lost when navigating away or switching the staff store; there is no autosave.

Next slice: C12 customer offer discovery, homepage offers and bundle catalogue presentation. C13 then completes checkout/order UX, followed by C14 release evidence.
