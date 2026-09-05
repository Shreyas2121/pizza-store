# Implementation guide: PizzaStore engineering case study

Status: implementation started. See the progress tracker and latest handoff for completed tasks and baseline limitations.

## Purpose and source of truth

This is too much work for one reviewable commit. Implement it as the ordered tasks below, with one coherent commit per task where practical. Work may happen on `main`; a feature branch is not required. Do not switch branches or discard existing changes merely to match this suggestion.

Read [plan.md](plan.md) for product intent, page content, and design constraints. This guide supplies execution order, file boundaries, acceptance criteria, and handoffs. [implementation_plan_docs.md](implementation_plan_docs.md) is the original proposal; use the corrected approach in `plan.md` when they differ. Current source code is authoritative for claims about existing behavior.

The target is a public engineering case study for a developer with 4+ years of experience: clear product context, defensible design decisions, failure handling, supporting evidence, and one useful interactive example.

## Start here: instructions for every implementing agent

1. Read applicable `AGENTS.md` instructions, this guide, and the relevant sections of `plan.md`.
2. Inspect `git status --short`, the current branch, and recent commits. Preserve user changes, including untracked planning files. Do not assume a clean worktree or that a checked box reflects current code.
3. Read the latest handoff and inspect dependency tasks before starting. If a task is partly complete, finish it rather than recreating it.
4. Claim a task in the tracker below. Implement only its scope plus necessary integration. Record any deviation with its reason.
5. Read current source before writing behavioral claims. Document unresolved behavior as a limitation; do not silently repair backend business logic as part of a docs task.
6. Run applicable checks, review the diff, and record results. If committing is part of the active implementation request, stage only files belonging to the task. Avoid `git add .` in a dirty worktree.
7. Update the tracker and handoff. A passing build alone is insufficient for tasks that require browser or evidence checks.

No need to ask about ordinary component names, spacing, or file splits. Use the existing conventions. Missing personal ownership details or public URLs can be recorded as publication follow-ups while implementation continues. Do not invent them.

Writing this guide does not start application implementation, deployment, or publishing. Future agents should follow the user's active request for which tasks to execute. Main-branch work does not imply permission to push or deploy.

## Commit map and dependencies

Each row is a proposed commit, not a commit already made. IDs stay stable even if a task is split into smaller commits.

| ID | Phase | Suggested commit | Depends on |
| --- | --- | --- | --- |
| C01 | Audit | `docs: audit case study claims and implementation evidence` | None |
| C02 | Foundation | `refactor: isolate application effects from public docs` | C01 |
| C03 | Foundation | `feat: add public docs shell and project overview` | C02 |
| C04 | First case study | `feat: add architecture docs and lazy diagram rendering` | C03 |
| C05 | First case study | `feat: document checkout and payment lifecycle` | C04 |
| C06 | First case study | `feat: document inventory consistency and locking` | C05 |
| C07 | Engineering depth | `docs: add architecture decisions and reliability evidence` | C06 |
| C08 | Interactive example | `feat: add deterministic inventory simulation model` | C06 |
| C09 | Interactive example | `feat: add accessible inventory scenario explorer` | C08 |
| C10 | Release preparation | `feat: finish case study discovery and presentation` | C07, C09 |
| C11 | Release verification | `docs: record case study release verification` | C10 |
| E01 | Optional expansion | `feat: add domain data model documentation` | C11 |
| E02 | Optional expansion | `feat: add store access control case study` | C11 |
| E03 | Optional stronger evidence | `test: verify stock allocation with concurrent database transactions` | C01; separately scoped infrastructure |

Recommended sequential order: C01 through C11, then selected expansions. C07 and C08 have independent content scopes after C06, but sequential execution on shared `main` is simplest.

Useful checkpoints:

- After C04: a functioning public introduction and architecture explanation.
- After C06: a complete static checkout/inventory story suitable for early review.
- After C11: the full core implementation is reviewed; publication readiness is reported separately if hosting or owner details remain unavailable.

Every commit should leave the app buildable and navigation truthful. Register pages only when they contain useful content. No empty routes or links to future pages.

## C01: audit claims and establish evidence

Read:

- `backend/src/features/checkout/checkout.service.ts`
- `backend/src/features/order/order.service.ts` and `order.logic.ts`
- `backend/src/features/inventory/inventory.service.ts` and `inventory.logic.ts`
- `backend/src/features/payments/` services, repository, webhook handling, and tests
- `backend/src/features/access/`, `staff/`, and `realtime/` for boundary claims
- Related schema files, reconciliation scripts, `backend/src/index.ts`, and route wiring
- `docs/architecture.md`, `docs/razorpay-runbook.md`, `docs/store-staff-authorization.md`, both package manifests, and `readme.md`

Tasks:

1. Create `docs/case-study-evidence.md` with stable claim IDs, current behavior, source path/symbol, relevant test/category, reviewed revision/date, and limitations.
2. Trace current order transitions, payment finalization, cancellation, reservation expiry, and locking. Record transaction boundaries and provider calls separately.
3. Determine whether reconciliation is scheduled in the available deployment configuration or only exposed as commands. If hosting configuration is absent, say scheduling could not be established.
4. Classify tests as pure logic, mocked service, real database integration, or browser coverage. Do not count mocks as proof of database concurrency.
5. Correct verified stale paths and descriptions in the references that the core pages will cite. Avoid rewriting unrelated documentation.
6. Establish the applicable check baseline and record the revision and results. Inspect local Git remote configuration for a usable repository URL without publishing any embedded credentials.

Known traps to recheck: persisted `delievered` spelling; no `out_for_delivery` in the reviewed transition map; untracked stock uses `null`; tracked availability is clamped; default reservation duration does not establish cleanup punctuality; no existing `preflight` script.

Done when: every core narrative has evidence or an explicit unresolved label, cancellation/recovery outcomes are mapped, and stale references used by the case study are corrected. Do not change order enums, refund behavior, locking, or migrations in this commit.

Handoff: claim IDs and policy details needed by C05, C06, and C08; outstanding questions that affect publication rather than implementation.

## C02: isolate global effects before adding public routes

This is a separate commit because it touches existing behavior and deserves focused regression checking.

Read `frontend/src/app/app.tsx`, providers, layouts, auth state, support hooks, and socket store. The reviewed `App` currently starts authenticated sockets and calls `useSyncChatStatus` globally; moving docs outside `MainLayout` alone will not isolate them. `GlobalModal` is also globally mounted.

Tasks:

1. Scope business socket/chat effects and storefront-only modal behavior so `/docs` and `/docs/*` can be read without them, including when a stored auth token exists.
2. Prefer a small app-level boundary/component using existing routing conventions. Do not place feature-specific logic in `shared` or introduce conditional hook calls.
3. Ensure cleanup disconnects the previous socket and clears stale socket references where required by the store contract.
4. Preserve socket/chat behavior across storefront and staff routes; verify returning from docs reconnects appropriately.
5. Match the `/docs` route segment precisely, rather than accidentally treating `/docs-other` as docs.

Files: `frontend/src/app/app.tsx`, a small app-level runtime component if needed, and affected integration points only.

Checks: frontend lint/build; inspect runtime behavior entering/leaving the future `/docs` location even if it temporarily renders the existing not-found view. Check logged-out and authenticated navigation. If browser tooling is unavailable, record the manual checks as pending, not passed.

Done when: docs locations do not start business effects, and existing app behavior remains intact. No docs page content is required yet.

## C03: public shell and useful landing page

Files:

- `frontend/src/features/docs/components/{docs-layout,docs-nav,docs-page}.tsx`
- `frontend/src/features/docs/pages/docs-index-page.tsx`
- `frontend/src/features/docs/content/{navigation,evidence}.ts`
- `frontend/src/app/router/routes.tsx`
- Docs-scoped styles and evidence-link component as needed

Tasks:

1. Create a public `/docs` layout with an outlet, desktop sidebar, accessible mobile drawer, skip link, and back-to-store link.
2. Add a substantive landing page: project summary, verified engineering highlights, stack summary, and limitations. Omit unsupplied personal ownership claims and unavailable external actions.
3. Establish the navigation manifest, stable section IDs, page metadata convention, and source-link rendering from C01 claim IDs.
4. Add direct file-based lazy imports at the app router. Add local loading/error handling so subsequent page failures do not remove docs navigation, plus an unknown docs-route fallback.
5. Respect existing dependency rules: feature files use relative imports for their own internals; they must not import app modules or deep internals of other features. The app router can integrate docs page files.
6. Check existing `ScrollManager` before adding anchor behavior. Avoid two competing scroll implementations.

Evidence strategy: `docs/case-study-evidence.md` remains the detailed audit record; `content/evidence.ts` is a curated public projection keyed by its IDs. Keep overlapping claims consistent within the same task. Do not build a Markdown parser or content platform for this.

Checks: lint/build; direct `/docs`, refresh, keyboard drawer operation, unknown child route, and API-offline reading. On this commit, nav includes only the landing page.

Done when: `/docs` is useful on its own, accessible without auth, and independent of API availability.

## C04: renderer and architecture page

Files: docs diagram components, `content/diagrams/architecture.ts`, `pages/architecture-page.tsx`, navigation, router, frontend manifest and its actual lockfile.

Tasks:

1. Add Mermaid using the existing package manager and a version compatible with the current project. Commit the resulting lockfile; do not hand-edit it or upgrade unrelated packages.
2. Implement a dynamically imported renderer using the official documentation linked in `plan.md`. Explicit strict security, central initialization, unique IDs, async cleanup, and readable failure/loading states are required.
3. Keep links in normal React controls outside SVG diagrams. Provide title, caption, prose equivalent, source fallback, and contained overflow.
4. Publish context and container views plus one verified request flow. Explain actual state ownership and why the current modular monolith fits.
5. Add `/docs/architecture` to routing/navigation and landing links in this same commit.

Checks: lint/build; multiple diagrams under Strict Mode, rapid navigation, malformed-diagram fallback during development, mobile overflow, and built chunk/network inspection showing Mermaid is not loaded by the initial storefront.

Done when: architecture is readable even if a diagram fails and all depicted boundaries match C01. Do not publish timing claims without measurements.

## C05: order lifecycle and payment case study

Files: `pages/order-lifecycle-page.tsx`, `content/diagrams/order-lifecycle.ts`, affected evidence/reference files, router and navigation.

Tasks:

1. Add COD and online payment narratives, with actual transaction boundaries visible in sequence diagrams.
2. Show order and payment state separately. Use current transitions and explain the legacy stored spelling without changing backend values.
3. Include snapshots, cart clearing, callback/webhook behavior, deduplication, and reconciliation as established in C01.
4. Populate the cancellation matrix covering reservations, stock, coupons, payments, and recovery actions.
5. Explain duplicate notifications, provider timeouts, callback/webhook races, and late capture. Unknown outcomes remain labelled limitations.
6. Link claims to source and tests; add `/docs/order-lifecycle` atomically with its nav entry.

Checks: lint/build; review every transition and cancellation matrix row against code, verify diagram rendering and anchors.

Done when: a reviewer can distinguish what commits locally, what happens at the provider, and how failures are handled. No unproven “exactly once” or automatic-refund claims.

## C06: inventory explanation before simulation

Files: `pages/inventory-page.tsx`, `content/diagrams/inventory.ts`, affected evidence/reference files, router and navigation.

Tasks:

1. Explain tracked/untracked stock, demand aggregation, manual availability, reservations, and the displayed availability calculation.
2. Show the audited lock sequence across owning rows, stock rows, and reservations, including relevant admin operations.
3. Add a small movement ledger with arithmetically consistent synthetic entries and an explicit example label.
4. Explain last-item contention, expiry processing, late capture, and admin adjustment/restock interactions using verified policies.
5. Add a static last-item walkthrough that remains useful when the simulator arrives.
6. Publish `/docs/inventory` with complete text and evidence links; no disabled simulator placeholder is needed.

Checks: lint/build; quantities and invariants reviewed step by step, source links and anchors checked, mobile readability.

Done when: C04-C06 form a complete static case study. A reader can distinguish a lock held during a transaction from a reservation surviving that transaction.

## C07: decisions and reliability evidence

Files: `pages/decisions-page.tsx`, `pages/reliability-page.tsx`, evidence data, affected runbooks, router and navigation. Split into C07a/C07b if review becomes unwieldy.

Tasks:

1. Write four to six short decisions using the template in `plan.md`. Label retrospective assessments when historical intent is unknown.
2. Publish the failure/test matrix with accurate test categories and scoped claims.
3. Document real reconciliation commands, scheduling evidence or uncertainty, diagnostic information, and current operational limitations.
4. Explain recovery/delivery gaps, including any verified gap between database commit and realtime notification. Keep proposed improvements visibly separate from existing behavior.
5. Publish both routes and update guided reading links.

Checks: frontend lint/build; run relevant existing backend checks when presenting their results, or link test source while clearly saying execution is unverified. Do not execute payment or inventory reconciliation against an unidentified database just to document it.

Done when: every decision includes a cost/tradeoff and every reliability claim identifies its evidence and limits.

## C08: deterministic simulation model and focused tests

Files: `simulations/inventory-simulation.ts`, `simulations/inventory-simulation.test.ts`, frontend manifest/lockfile and minimal test configuration if necessary.

Tasks:

1. Define typed state/events for two customers, one tracked item, lock ownership, reservation state, payment outcome, and event history.
2. Model successful capture, failure, and expiry according to C01/C06. Do not invent unresolved late-capture behavior.
3. Use pure transitions and deterministic event sequences. Support replay to a step so previous/next/reset requires no mutation tricks or real timers.
4. Distinguish rejected checkout from a newly initiated retry after stock is released; releasing stock must not silently resume a completed rejected request.
5. Add a compatible frontend test runner and `test` script. Match module resolution and existing TypeScript/lint settings; avoid global test-type leakage where explicit imports suffice.
6. Test allocation exclusivity, reservation accounting, repeated capture behavior, release/expiry, reset, and deterministic replay. If an event is invalid, explicitly reject it or return the documented unchanged state.

Checks: new frontend tests, lint/build. No browser APIs, network, real payments, or backend imports in the simulation model.

Done when: the model is usable without React and meaningful invariant tests pass. It may remain unmounted until C09; this is the one deliberate internal-only implementation commit.

Handoff: exported state/event interfaces, scenario fixtures, invariants, and exact new test command.

## C09: accessible scenario explorer

Files: `simulations/inventory-simulator.tsx`, inventory page, small simulation view components/styles as needed.

Tasks:

1. Integrate C08 with scenario selection and previous/next/reset controls.
2. Display actors, lock owner/waiting state, stock/reservation/availability values, and chronological explanatory text.
3. Label it explicitly as a deterministic teaching simulation, not a live database test.
4. Provide keyboard access, labelled status updates, reduced-motion handling, and a static/print transcript.
5. Keep local state local. Add no API calls or global store. The unsafe comparison mode is optional and should be skipped if it delays the core scenarios.

Checks: frontend tests/lint/build; exercise every scenario, backwards navigation, reset, changing scenarios mid-flow, narrow viewports, keyboard-only use, and final-state controls.

Done when: a visitor can explain why customer B cannot allocate the final item after A reserves it, and can inspect the recovery scenarios without relying on animation or color.

## C10: discovery, presentation, and portfolio handoff

Files: docs layout/page styles, landing page, `frontend/src/app/layouts/components/storefront-footer.tsx`, `readme.md`, actual screenshot assets, and `docs/case-study-walkthrough.md`.

Tasks:

1. Add the storefront footer link and README entry now that the case study is complete.
2. Finish consistent page metadata, section navigation, mobile layout, loading/error presentation, focus behavior, and print styles.
3. Add a current screenshot of the actual application if it can be captured. Use meaningful alternative text and a reasonably sized asset. Do not substitute a generated mockup for implementation evidence.
4. Configure real repository/demo links where available; hide missing actions. Finish ownership copy only from user-provided facts.
5. Write a concise two-minute walkthrough and three interview discussion prompts grounded in the implementation.
6. Update setup/runbook documentation for any new frontend test command and relevant hosting requirements.

Checks: tests/lint/build plus keyboard, mobile, print, link, and metadata review. Confirm no nav item references an optional page that has not shipped.

Done when: the core experience has a clear entry point and polished reading flow. Record missing screenshot/ownership/hosting inputs as explicit remaining publication work rather than pretending they are finished.

## C11: final verification and release report

Files: `docs/case-study-verification.md`, tracker/handoff, and narrowly scoped fixes discovered during verification. If fixes are material, commit them separately before recording the final result.

Tasks:

1. Verify all six core routes through direct load, refresh, back/forward, and section links. Verify unknown docs URLs and diagram error behavior.
2. Verify logged-out and stored-token access with the API unavailable, including navigation from and back to the working app.
3. Inspect the production build for page splitting and Mermaid isolation. Record actual build/measurement conditions and results.
4. Verify mobile, keyboard, focus, reduced motion, print, screenshots, internal links, and public evidence links.
5. Test hosted SPA rewrites only if a deployment is available and in scope. Otherwise write the requirement and record hosted refresh as unverified. Local client navigation is insufficient evidence.
6. Run applicable final checks once after changes settle. Record exact commands, date, tested revision, pass/fail, and limitations in the verification report.
7. Report local implementation completion and publication readiness separately. Do not push or deploy as an implicit part of this documentation task.

Done when: local core checks pass or failures are explicitly reported, the report is reproducible, and remaining external checks have a clear owner. Never mark a hosted check passed if no hosted environment was tested.

## Optional expansion tasks

### E01: domain data model

Add `/docs/data-model`, three focused ER views, verified cardinalities/constraints, schema rationale, and canonical schema links. Read current schema and migrations first. Add route/nav together; run frontend lint/build and validate each relationship against the schema. Keep full column enumeration in the existing reference.

### E02: store authorization

Add `/docs/access-control`, the role/permission matrix derived from current definitions, allowed/denied request examples, store ownership checks, membership lifecycle, and socket-room authorization. Link relevant backend tests and limitations. Add route/nav together; run frontend lint/build and applicable evidence checks.

### E03: stronger database concurrency evidence

This is an optional testing workstream, not a hidden dependency of docs completion. First inventory existing integration coverage and disposable database tooling. If infrastructure is missing, define isolation and teardown before writing tests. Never use a shared or unidentified database.

Use separate connections and explicitly coordinated overlapping transactions to exercise competing allocation of one stock item. Verify committed order, reservation, and stock outcomes. Extend to repeated finalization only after the initial test is reliable. Avoid sleep-based races. Add explicit setup/test commands, meaningful CI integration if available, and update public claims only after results exist. Separate discovered backend bugs into their own scoped implementation tasks.

## Verification commands and rules

Commands currently identified in the plan, run from the repository root:

```powershell
pnpm.cmd --dir frontend run lint
pnpm.cmd --dir frontend run build
pnpm.cmd --dir backend run typecheck
pnpm.cmd --dir backend run test
pnpm.cmd --dir backend run build
```

After C08 creates the frontend `test` script:

```powershell
pnpm.cmd --dir frontend run test
```

Recheck manifests before execution; do not assume scripts remain unchanged. Use existing lockfiles and the installed package manager. Record dependency-install or environment blockers honestly.

For frontend commits, frontend checks plus the task's behavior checks are the default. Backend checks are relevant to audited evidence and backend changes, not every styling commit. Do not rerun broad suites without a change or unresolved concern that justifies them. Pure prose commits need reference/diff review rather than arbitrary new tests.

Browser automation is not assumed to exist. Use available browser tools or manual verification; record unavailable checks. If adding a browser runner is useful, make its setup an explicit additional task with a small scope rather than silently expanding C11.

## Coordination and handoff rules

The guide supports different agents working in successive sessions. Multiple agents are not required.

If the user assigns parallel work, give each agent one task and exclusive files. Have one integrator own router/navigation registration, `app.tsx`, dependency manifests/lockfiles, shared docs components, and this tracker. Page authors provide their proposed integration edits to that owner. Do not run concurrent Git commits or installations in one shared worktree. Do not change another agent's unstaged files.

Before each implementation commit, review the staged diff and confirm it contains only intended files. Do not squash earlier phases, amend user commits, or reformat unrelated modules. Smaller follow-up commits are fine when a task uncovers additional necessary work.

Record handoffs in this file under the tracker, using:

```text
Task ID and status:
Owner/session:
Implementation commit(s):
Files changed:
Decisions and evidence added:
Commands run and exact result:
Browser/manual checks performed:
Known limitations or blocked checks:
Remaining work:
Next eligible task:
```

Record the commit hash in a subsequent tracker update or final handoff after creating the implementation commit; do not attempt to embed a commit's own hash into itself. If no commit was requested or possible, say “uncommitted” and list the relevant files.

## Progress tracker

Use `not started`, `in progress`, `implemented; verification pending`, `complete`, or `blocked`. Fill in the reason for blocked status. A task with required checks pending is not complete.

| Task | Status | Owner | Commit / handoff |
| --- | --- | --- | --- |
| C01 | complete | Codex | Evidence audit against `15362b5`; see latest handoff and `docs/case-study-evidence.md` |
| C02 | implemented; verification pending | Codex | Runtime isolation committed; browser checks pending; existing build failure deferred |
| C03 | not started | - | - |
| C04 | not started | - | - |
| C05 | not started | - | - |
| C06 | not started | - | - |
| C07 | not started | - | - |
| C08 | not started | - | - |
| C09 | not started | - | - |
| C10 | not started | - | - |
| C11 | not started | - | - |
| E01 | optional; not started | - | - |
| E02 | optional; not started | - | - |
| E03 | optional; not started | - | - |

### Latest handoff

Task: C02 implemented (2026-09-05); browser verification pending. Local commit title: `refactor: isolate application effects from public docs`.

- Owner: Codex.
- Files: `frontend/src/app/app.tsx`, new `frontend/src/app/business-runtime.tsx`, `frontend/src/features/support/api/chat.queries.ts`, and architecture/evidence handoff notes.
- Behavior: React Router's `/docs/*` match unmounts `BusinessRuntime`; exact `/docs`, its descendants, and case-insensitive equivalents are isolated, while `/docs-other` remains a business route. The component owns authenticated chat sync, socket connection, and `GlobalModal`.
- Cleanup: disconnect the owned socket, clear its store reference if it is still current, and close/reset the global app modal. Returning to a business route mounts fresh effects. Ordinary storefront/staff navigation retains the component instance.
- Chat sync now consumes the query cancellation signal through Axios, allowing observer unmount to abort an in-flight request. It returns the chat or `null` so successful queries have a defined result.
- Checks: `pnpm.cmd --dir frontend run lint` passed with the same 3 existing warnings; `pnpm.cmd run build` from `frontend/` stopped at the same inventory-schema Zod TS2353 baseline failure. Ten checks using installed React Router `matchPath` passed for `/docs`, trailing slash, nested paths, uppercase `/DOCS`, and non-docs paths. Diff whitespace checked. No backend tests or dependency changes were needed.
- Browser tools/runner were unavailable. Pending: signed-out and stored-token direct docs visits; storefront -> docs during chat fetch; socket disconnection and cleared reference; no app modal on docs or stale modal when returning; docs -> storefront/staff reconnection; token change/logout; Strict Mode behavior. Docs currently render the existing not-found view until C03.
- Financial/build baseline remains deferred per owner direction. C02 is not marked fully verified. C03 can build on the implemented boundary; carry these browser checks into the next available browser verification session.
- Implementation commit hash is reported in the user-facing handoff; no push/deployment performed.

### Previous handoff: C01

Task: C01 complete (2026-09-05), audited source revision `15362b5a3500d4ea596e66bd2e9e519a418ed650`. Completion means the evidence audit and baseline record are complete, not that the application baseline is all green.

- Owner: Codex.
- Deliverable: [case-study evidence](docs/case-study-evidence.md), with stable claim IDs, current transactions/order states, cancellation/expiry matrices, lock-path audit, and test classifications.
- References updated: `docs/architecture.md`, `docs/razorpay-runbook.md`, `docs/store-staff-authorization.md`, and `readme.md`.
- Checks: backend typecheck/build passed; frontend lint passed with 3 existing warnings. Frontend build failed on locally resolved Zod types; backend tests had 200 passing and 1 failing due to an unmocked database lookup. Exact commands and evidence are in the audit. Documentation diff/relative file links checked.
- Owner direction: defer financial/build findings to the financial rework on another branch. No source-code fixes, dependency installs, migrations, seeds, or reconciliation runs in C01. Do not repeat the database-coupled test against shared configuration; re-audit financial claims after integration.
- Browser/manual checks: not performed; not required for this documentation-only audit. Deployment, public URLs, and personal contribution remain unverified.
- Commit: use the local commit titled `docs: audit case study claims and implementation evidence`; its hash is reported in the implementation handoff. The planning files `plan.md` and `implementation_plan_docs.md` remain outside this task's staged changes.
- Next eligible task: C02, isolating app-level chat/socket/modal effects. Read ARCH-03. Keep existing baseline failures distinct from any new regression. C05/C06/C08 must recheck PAY/ORDER/INV/REC claims once financial work merges.

## Copyable agent prompt

> Read `guide.md`, `plan.md`, applicable repository instructions, and the latest handoff. Implement the next incomplete core task whose dependencies are satisfied. Work on the current branch; main is acceptable. Preserve existing changes, keep the task within scope, and validate its acceptance criteria. Create a focused local commit containing only that task's changes, then report the commit and update the handoff. Do not push or deploy. If a dependency is partially implemented, finish it first. Do not infer backend correctness from diagrams or mocked tests, and do not claim checks you could not run.
