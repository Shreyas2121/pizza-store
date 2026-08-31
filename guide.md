# Financial Overhaul Implementation Guide for AI Agents

> Target branch: `feature/financial-overhaul`  
> Source of product truth: `plan.md`  
> Repository: PizzaStore (`backend/` + `frontend/`)  
> Audience: AI coding agents implementing one reviewable commit at a time  
> Standard: senior-engineer quality, portfolio-ready, deterministic, auditable, and easy to hand off

> Testing decision (31 August 2026): automated tests are backend-only. Frontend changes require lint, TypeScript/Vite build, and documented manual acceptance checks; do not add a frontend test framework unless the user later changes this decision.

## 1. Purpose and authority

This guide converts `plan.md` into an execution sequence. It does not replace the plan’s business definitions, accounting policy, data model, acceptance criteria, or confirmed product decisions.

Use this precedence when instructions appear to conflict:

1. The user’s latest explicit instruction
2. Repository-level `AGENTS.md`, if one is added later
3. `plan.md` for target behavior and scope
4. This guide for execution order and commit boundaries
5. Current code for existing contracts, conventions, and migration reality
6. Existing docs, which may be stale and must be verified against code

The current code is the source of truth for what exists. The plan is the source of truth for where the system is going. Never pretend a planned table, endpoint, permission, or workflow already exists.

## 2. Branch and commit policy

### 2.1 Create the integration branch

Implementation belongs on one new branch created from the latest intended `main`:

```powershell
git status --short
git branch --show-current
git switch -c feature/financial-overhaul
```

Rules:

- Do not discard or overwrite untracked `plan.md`, `guide.md`, or user changes when creating the branch.
- If `feature/financial-overhaul` already exists, inspect it and switch to it; never delete/recreate it automatically.
- Do not pull, rebase, merge, push, force-push, create a PR, or alter remote state unless the user explicitly asks.
- Keep all implementation commits on this integration branch unless the user requests phase branches.
- The first commit should add the approved planning documents if they are still untracked.

Suggested first commit:

```text
docs(finance): add overhaul plan and implementation guide
```

### 2.2 Commit rules

- One commit must represent one coherent, reviewable behavior or one backward-compatible schema expansion.
- Do not implement an entire phase in one commit.
- Do not mix unrelated cleanup, formatting, dependency upgrades, or UI redesign into finance commits.
- Schema and its generated migration belong in the same commit. A data backfill may be a separate commit/migration.
- Tests for behavior belong in the same commit as the behavior.
- Documentation/API-reference changes belong with the contract they describe, plus a final consolidation pass.
- Never commit failing tests, type errors, generated junk, secrets, local `.env` files, database dumps, payment payloads, or private receipt/payroll data.
- Follow the repository’s conventional style: `fix(scope): ...`, `feat(scope): ...`, `test(scope): ...`, `refactor(scope): ...`, `docs(scope): ...`, `chore(scope): ...`.
- Do not amend or squash commits unless the user explicitly requests history rewriting.

### 2.3 Agent assignment size

Assign an agent one numbered commit at a time, or at most two adjacent commits when the second cannot be tested independently. Every agent must read:

- This guide completely
- The relevant sections of `plan.md`
- All current files it will modify
- Existing tests for the touched domain
- The latest migration journal/schema before schema work

An agent must not rely only on a prior agent’s summary.

## 3. Mandatory senior-engineer practices

### 3.1 Before editing

For every commit:

1. Run `git status --short` and preserve unrelated/user changes.
2. Confirm the active branch is `feature/financial-overhaul`.
3. Inspect the current implementation with `rg`; do not assume paths from older docs are exact.
4. State the commit objective, invariants affected, expected files, and validation commands.
5. Identify whether the change is additive, a cutover, or destructive.
6. Read relevant migration snapshots when changing existing columns or constraints.

### 3.2 While implementing

- Keep routes thin: authenticate, authorize, validate, call a service, map the response.
- Keep business rules out of React, Express request handlers, and Drizzle schema definitions.
- Use domain services/policies for calculations and repositories/query functions when a service becomes difficult to test.
- Pass a transaction executor through multi-write workflows; do not start nested independent transactions.
- Use the repository’s established lock order. If a finance workflow adds locks, document the global order before merging it.
- Put source mutation, audit/outbox record, and critical financial state transition in the same transaction.
- Use idempotency keys and unique constraints as correctness controls, not only in-memory checks.
- Make state transitions explicit and deny invalid transitions with stable `AppError` codes.
- Never delete or mutate posted financial history; reverse it.
- Use UTC timestamps in storage and store-aware business dates/timezones for reporting.
- Keep money in integer paise throughout domain and persistence logic. Convert to formatted INR only at presentation boundaries.
- Never trust a browser-calculated price, discount, tax, total, refund amount, cost, or payroll total.
- Never expose cross-store resource existence. Reuse resource-scoped authorization behavior.
- Never log secrets, signatures, full provider payloads, bank data, identifiers such as PAN-like values, or employee compensation details.
- Prefer existing dependencies and primitives. New dependencies require a clear reason, lockfile update, and targeted tests.

### 3.3 After editing

1. Review the diff for unintended files, secrets, debug logging, and migration mistakes.
2. Run the smallest relevant tests first, then the phase quality gate.
3. Inspect generated SQL manually; a generated migration is not automatically correct.
4. Update API types, frontend types, docs, and permissions when the contract changes.
5. Verify negative paths: unauthorized store, invalid state, duplicate request, overflow, concurrency, and empty data.
6. Commit only after the work is internally complete.
7. Produce the handoff described in Section 17.

## 4. Match the current repository

### 4.1 Backend conventions

Continue using:

- Node.js/TypeScript, Express 5, Drizzle ORM, PostgreSQL, Zod 4, Vitest
- `backend/src/features/<domain>/` feature ownership
- Thin `*.routes.ts` handlers and service-owned business logic
- Repositories, policy/logic files, schemas, and domain types for complex modules; do not follow the stale “exactly two files” documentation rule
- `authenticateUser`, centralized authorization service, store permissions, platform capabilities, and not-found masking
- `AppError`, stable error codes, `asyncHandler`, body/query parsing utilities, Winston structured logging
- Append-only `audit_logs`, inventory movement/idempotency patterns, and payment webhook inbox patterns
- Schema modules under `backend/src/db/schema/`, exports in `index.ts`, and relations in `_relations.ts`
- Drizzle-generated migrations under `backend/migrations/`
- `/api/v1` as the only API prefix

Do not introduce Prisma, NestJS, a second ORM, a second HTTP framework, GraphQL, or a separate microservice for this portfolio overhaul.

### 4.2 Frontend conventions

Continue using:

- React 19, TypeScript, Vite, Mantine, Tailwind, TanStack Query, Zustand, React Hook Form, Zod
- Feature folders under `frontend/src/features/<domain>/`
- `api/` query/mutation hooks, `model/` types/schemas/keys, `components/`, `pages/`, and feature `index.ts`
- Shared API client and query helpers; do not call Axios directly throughout page components
- Existing admin layout, store context, route guards, permission-driven navigation, shared DataTable, page header, empty/error/loading patterns
- Existing theme and design language; finance should look native to the project

Do not add Redux or a second component library. Zustand is for local/transient state; TanStack Query owns server state.

### 4.3 Known documentation drift

When implementation reveals a mismatch between docs and code:

- Treat code/tests/migrations as current reality.
- Record the mismatch in the commit handoff.
- Fix directly affected docs in the same commit or the phase documentation commit.
- If matching current code would violate an approved plan invariant, stop and inform the user before changing the plan or architecture.

## 5. Non-negotiable system invariants

Every agent must preserve these:

```text
grandTotalPaise = itemsSubtotalPaise
                - discountPaise
                + deliveryFeePaise
                + roundingAdjustmentPaise

sum(line discount allocations) = order discountPaise
sum(line tax amounts)           = order taxPaise
taxPaise is included in customer-facing amounts and is never added again
sum(line totals) + delivery adjustments = order grandTotalPaise
processed refunds <= captured amount
sum(journal debits) = sum(journal credits)
posted records are corrected by reversal, never overwrite/delete
one source event version creates at most one journal entry
```

Additional rules:

- Revenue and COGS are recognized once at canonical `delivered`, not payment capture or `out_for_delivery`.
- Razorpay capture is a collection event; settlement is a bank-clearing event.
- COD is collected only at `delivered` and belongs to one open store cash session.
- A refund does not imply an inventory return.
- Tax rules, standard costs, delivery prices, and compensation are effective-dated and snapshotted.
- Individual stored money uses bounded PostgreSQL `integer` paise; wider SQL aggregates use an explicit bigint/string DTO policy.
- All financial resources are store-scoped unless explicitly consolidated for the owner.
- A permission check and an actor-level policy are both required where segregation of duties applies; possessing a role must not allow self-approval when policy forbids it.
- Platform admin represents the owner of one business with multiple branches, not a marketplace operator.
- Live payment processing is unsupported; deterministic simulator/fixtures are the default.

## 6. Quality gates and commands

### 6.1 Current commands

Backend:

```powershell
Set-Location backend
pnpm test
pnpm typecheck
pnpm build
```

Frontend:

```powershell
Set-Location frontend
pnpm lint
pnpm build
```

There is intentionally no frontend `test` or `test:e2e` requirement. For every changed frontend workflow, record the manual scenarios checked, including permission visibility, loading/error/empty states, keyboard access for changed controls, and displayed monetary totals.

### 6.2 Gate levels

- **Commit gate:** backend changes require relevant backend tests and typecheck; frontend changes require lint/build and recorded manual acceptance checks.
- **Schema/migration gate:** clean database forward migration, constraint/backfill verification, backend full tests/typecheck/build.
- **Phase gate:** backend full suite/typecheck/build; frontend lint/build plus documented manual UI checks; deterministic finance fixture reconciliation; docs updated.
- **Release gate:** fresh clone/install, database migration from baseline and current schema, seed/demo reset, all backend tests, documented end-to-end manual demo scenarios, and no open critical reconciliation mismatch.

If an unrelated pre-existing test fails, verify it on the parent commit and report it. Do not hide, delete, skip, or weaken the test.

## 7. Migration rules

- Use expand -> dual write -> backfill -> verify -> switch reads -> observe -> contract.
- Never use `db:push` as the committed migration strategy.
- Update Drizzle schemas, run `pnpm run db:generate`, and inspect SQL/snapshots/journal.
- Do not hand-edit generated snapshots casually. If generated SQL needs a data migration/check, use a reviewed custom SQL migration pattern consistent with existing migrations.
- Never change an already committed/applied migration. Add a new migration.
- Each destructive contract migration must be a later commit after new reads are proven.
- Backfills must be deterministic, idempotent where practical, and report unmatched/ambiguous legacy rows.
- Never derive historical order prices from today’s catalog.
- Provide forward recovery; do not promise rollback when a data transformation cannot be safely reversed.
- Because this is a deterministic demo, test both migration from the current database shape and fresh migration from baseline.

## 8. Commit sequence overview

Do not skip phase gates. Commits may be split further if a diff becomes large; do not merge unrelated listed commits.

| Phase | Commit range | Outcome |
| --- | --- | --- |
| Bootstrap | B01 | Planning documents and branch foundation |
| Immediate fix | Q01 | Truthful current GOV dashboard |
| Phase 0 | P0.1-P0.6 | Decisions, fixtures, contracts, authorization, characterization |
| Phase 1 | P1.1-P1.10 | Exact authoritative order pricing |
| Phase 2 | P2.1-P2.10 | Attempts, refunds, simulator, settlement reconciliation |
| Phase 3 | P3.1-P3.9 | Outbox contracts, costs, COD cash, expenses |
| Phase 4 | P4.1-P4.9 | Balanced ledger, posting, periods, trial balance |
| Phase 5 | P5.1-P5.7 | Finance reports, drill-down, exports, portfolio demo |
| Phase 6 | P6.1-P6.7 | Payroll-lite as operating cost |
| Phase 7 optional | P7.1-P7.5 | Clearly non-statutory demo invoicing |

## 9. Bootstrap and immediate correction

### B01 — `docs(finance): add overhaul plan and implementation guide`

Scope:

- Add `plan.md` and `guide.md` on `feature/financial-overhaul`.
- Confirm both documents reflect owner-operated multi-store scope and no live payments.

Validation:

- Markdown structure/links render.
- No application changes.

### Q01 — `fix(dashboard): report eligible gross order value`

Scope:

- Create one backend eligible-order filter excluding `cancelled` and `awaiting_payment`.
- Reuse it for GOV, order count, AOV, active customers, charts, and comparison periods.
- Rename backend/frontend labels and chart copy from Revenue to Gross Order Value.
- Preserve `/api/v1/dashboard` response shape.
- Add regression tests for cancelled/unpaid exclusion and store/date filtering.

Do not:

- Call this recognized revenue.
- Add ledger dependencies.

Gate:

- Backend dashboard tests, backend typecheck/build, frontend lint/build, and manual verification of the renamed card/chart and empty/date/store states.

## 10. Phase 0 — decisions, fixtures, and characterization

### P0.1 — `docs(finance): define money and recognition decisions`

Add ADRs for:

- Integer paise limits, aggregate serialization, overflow, rounding, allocation
- Delivery-based revenue/COGS recognition and reversal policy
- Store timezone/business date and Indian financial-year presets
- Tax-inclusive demo policy and disclaimer

Each ADR contains context, decision, alternatives, consequences, examples, and testable invariants.

### P0.2 — `docs(finance): define ledger and lifecycle contracts`

Add:

- Chart-of-accounts/posting-rule ADR
- State diagrams for order, payment attempt, refund, settlement, cash session, expense, pay run, journal
- Explicit event names, source identity/version, payload minimums, and reversal behavior
- Global database lock order including new finance aggregates

Do not implement tables yet.

### P0.3 — `docs(api): map finance compatibility rollout`

Document:

- `/api/v1/dashboard` remains operational during transition
- New `/api/v1/finance/*` contracts
- Coupon preview/final checkout consolidation
- Existing order/payment endpoint compatibility
- Feature flags, dual reads/writes, deprecation policy, and stable error codes
- Final finance/payroll role-permission matrix and actor-level segregation rules

### P0.4 — `test(payments): characterize reconciliation behavior`

Scope:

- Add tests around all public reconciliation paths before refactoring the 837-line service.
- Cover captured, failed, stale, expired reservation, recovered provider order, mismatch, duplicate, and observation-recording cases.
- Do not change observable behavior except to correct a proven bug in a separate commit.

### P0.5 — `test(finance): add deterministic two-store fixtures`

Scope:

- Add a deterministic, checked-in scenario for two stores and two months.
- Include COD, simulated online capture/failure, discount, cancellation, partial refund, settlement fee/tax, cost change, expense allocation, payroll change, and period boundary.
- Add an expected-results artifact for order totals, collections, refunds, settlement, COGS, expenses, payroll, P&L, and future trial balance.
- Avoid Faker for values used by reconciliation assertions.

### P0.6 — `feat(authz): establish finance role and permission foundation`

Scope:

- Extend store roles with `finance_manager` and `payroll_manager` rather than giving every new permission to the existing manager role.
- Add the finance/payroll permissions from `plan.md` using least privilege.
- Keep platform admin as the explicitly confirmed demo owner with consolidated access.
- Give store managers operational finance/refund/expense-approval access but no payroll detail.
- Keep operators limited to order lookup, refund request, and authorized COD actions.
- Enforce self-approval/payment restrictions in domain policies later; role membership alone is not segregation of duties.
- Update schema checks/migration, invitation/staff validation, access DTOs, frontend role types, seeds, and authorization tests together.

Do not replace the current authorization system with a new permissions framework unless the fixed-role approach proves unable to express an approved rule; report that conflict first.

Phase 0 gate:

- ADRs agree with `plan.md`.
- Every KPI has a formula/status/date policy.
- Expected fixture totals are hand-checkable.
- Finance/payroll permissions are explicit, store-scoped, and covered by allow/deny tests.
- Existing tests remain green.

## 11. Phase 1 — exact money and order financial truth

### P1.1 — `feat(money): add bounded paise primitives`

Scope:

- Replace ad hoc conversions with checked money functions for parse, add, subtract, multiply, percentage, comparison, allocation, overflow, and display conversion.
- Define domain caps and aggregate DTO parsing/serialization.
- Add table-driven/property-style invariant tests, including allocation remainder and overflow cases.

Do not change persistence yet.

### P1.2 — `feat(pricing): centralize quote and coupon policy`

Scope:

- Extract one authoritative pricing/coupon policy from checkout.
- Make coupon preview and order creation call the same paise-based validation/calculation.
- Add stable quote DTO/version and parity tests.
- Keep old endpoint response compatibility through adapters.

### P1.3 — `feat(finance): expand order money schema`

Scope:

- Add nullable paise/currency/pricing-version/recognition timestamp columns to orders.
- Add order-line/customization snapshot columns from the plan.
- Add checks that are valid before backfill; defer `NOT NULL` until verified.
- Generate and review migration.

No read cutover in this commit.

### P1.4 — `feat(finance): dual-write exact order snapshots`

Scope:

- Make `createOrderSnapshot` write paise columns directly from the quote.
- Continue legacy rupee writes temporarily from the same source for compatibility.
- Never use `paiseToRupees` as the authoritative stored path.
- Add customized, discounted, zero-total, and boundary tests.

### P1.5 — `chore(finance): backfill and verify order paise`

Scope:

- Backfill legacy order/item/customization values deterministically.
- Produce verification queries/report for legacy-vs-new discrepancies.
- Mark unknown legacy tax/delivery/cost honestly; do not invent values.
- Test migration from a representative pre-finance database fixture.

### P1.6 — `feat(delivery): add store-scoped effective pricing`

Scope:

- Replace the global delivery-price singleton with store-scoped effective-dated rules.
- Include delivery fee in server quote and persisted order snapshot.
- Define rule selection, minimum/free-delivery behavior if needed, overlap constraints, and seed data.
- Keep a compatibility read for legacy global config until cutover.

### P1.7 — `feat(tax): add tax-inclusive demo rules`

Scope:

- Add effective-dated item/delivery demo tax rules and rule versioning.
- Allocate discount first, extract inclusive tax in paise, distribute remainder deterministically.
- Persist rule/rate/taxable/tax snapshots.
- Add explicit portfolio disclaimer metadata.
- Do not add IRP/GST filing behavior or claim legal accuracy.

### P1.8 — `feat(checkout): expose authoritative server quote`

Scope:

- Add/version the quote API under existing `/api/v1` conventions.
- Update frontend query keys/types/hooks.
- Render subtotal, discount, delivery, included tax, rounding, and total from the server quote.
- Remove client-side financial recomputation from checkout/cart.
- Handle stale quote/version/stock conflicts explicitly.

### P1.9 — `fix(orders): canonicalize delivery status lifecycle`

Scope:

- Expand acceptance to `delievered`, `delivered`, and `out_for_delivery`.
- Normalize API output, write only canonical values, backfill legacy rows, then tighten checks.
- Temporarily preserve `preparing -> delivered`; make current UI use `preparing -> out_for_delivery -> delivered`.
- Fire collection/recognition events only once at `delivered`.
- Add transition, migration, compatibility, COD, and idempotency tests.

### P1.10 — `refactor(finance): switch reads to exact order amounts`

Scope:

- Switch order/customer/admin reads to paise snapshots through DTO mappers.
- Add dual-read mismatch instrumentation before removing legacy reads.
- Make new paise columns required where backfill proved safe.
- Keep physical removal of legacy floating columns for a later contract migration after all consumers are verified.
- Update schema/API docs.

Phase 1 gate:

- No authoritative calculation/persistence uses float rupees.
- Preview equals final checkout under all fixtures.
- Delivery/tax/discount allocations reconcile exactly.
- Fresh and upgrade migrations pass.
- Backend suite/typecheck/build and frontend lint/build pass; affected checkout/order screens have documented manual verification.

## 12. Phase 2 — payment attempts, refunds, and settlements

### P2.1 — `refactor(payments): decompose reconciliation service`

Split behind P0.4 characterization tests into focused verification, finalization, stale recovery, provider-order recovery, and observation collaborators. Preserve routes, errors, transactions, and observable behavior.

### P2.2 — `feat(payments): expand to order payment attempts`

Scope:

- Add order-to-many payment-attempt schema and relations.
- Preserve existing payment IDs/provider references through migration.
- Add indexes/unique keys/checks and compatibility repository adapters.
- Do not remove `orders.paymentId` until all consumers move.

### P2.3 — `refactor(payments): cut services over to attempts`

Scope:

- Move COD and Razorpay initiation, verification, reconciliation, and order reads to payment attempts.
- Support retries without changing order/customer/amount identity.
- Add duplicate client-request/provider-event tests and concurrent attempt tests.

### P2.4 — `feat(payments): add deterministic provider simulator`

Scope:

- Implement the same provider interface as Razorpay for local demo use.
- Script successful, failed, delayed, duplicate, and out-of-order events.
- Make simulator the safe default; Razorpay test mode remains optional; live mode refuses startup/configuration.
- Never put fake provider behavior inside production domain policy.

### P2.5 — `feat(refunds): add refund aggregate and allocation schema`

Scope:

- Add refunds and refund allocations with state checks, idempotency/provider uniqueness, actor/reason/timestamps.
- Model item, quantity, delivery, tax, and discount reversal allocations.
- Add store-scoped permissions and migrations.

### P2.6 — `feat(refunds): implement request and approval workflow`

Scope:

- Operator request, manager/finance approval threshold, provider submission, finalization/failure.
- Lock aggregate during concurrent refunds.
- Enforce processed refunds <= captured amount.
- Keep inventory return as an explicit separate action.
- Audit request/approval/denial/provider outcomes without sensitive payloads.

### P2.7 — `feat(refunds): process provider refund events`

Scope:

- Verify raw webhook signatures for Razorpay adapter.
- Handle duplicate/out-of-order asynchronous refund states idempotently.
- Add reconciliation fallback and stuck/failed refund visibility.
- Extend webhook inbox without weakening existing payment behavior.

### P2.8 — `feat(settlements): add batches lines and issues`

Scope:

- Add settlement batches, lines, and reconciliation issues.
- Support checked-in fixture import first and optional test-provider sync.
- Model gross, fee, fee tax, adjustment, net, UTR/reference, match status.

### P2.9 — `feat(settlements): implement deterministic matching`

Scope:

- Match provider transactions to local attempts/refunds by immutable references and amount/currency/status.
- Surface missing-local, missing-provider, mismatch, duplicate, and stale cases.
- Resolution requires reason/actor/time and never silently mutates source truth.

### P2.10 — `feat(finance-ui): add refunds and reconciliation workspace`

Scope:

- Refund request/approval UI with exact confirmation summary.
- Settlement list/detail, match status, issue queue, safe fixture import/sync.
- Permission-aware actions, accessible status, loading/error/empty states.
- Manual checks for permission visibility, irreversible-action summaries, keyboard use, loading/error/empty states, and exact displayed amounts.

Phase 2 gate:

- Duplicate/out-of-order events have one effect.
- Concurrent partial refunds cannot over-refund.
- Fixture captures/refunds trace to settlement net/fees/tax.
- Reconciliation issues are visible, owned, and audited.

## 13. Phase 3 — COD cash, standard costs, vendors, and expenses

### P3.1 — `feat(finance-events): add transactional outbox contracts`

Scope:

- Add outbox schema, unique source/event/version identity, status/attempt metadata.
- Add writer API that accepts the caller’s transaction.
- Emit versioned events without a ledger consumer yet.
- Add claim/retry/idempotency/concurrency tests.

### P3.2 — `feat(costs): add effective product cost versions`

Scope:

- Effective-dated standard unit cost per store product with no overlaps.
- Snapshot unit/line cost on delivery/recognition.
- Ensure current cost edits cannot rewrite historical margins.
- Add cost-specific permissions and audit.

### P3.3 — `feat(cash): add cash sessions and movements`

Scope:

- One open session per store/business date.
- Opening float, COD collection, refund, cash in/out, deposit, adjustment, expected/counted/variance.
- Manual reason and material-variance acknowledgement.
- Closed sessions immutable except controlled reopen/reversal.
- Emit outbox events transactionally.

### P3.4 — `feat(cash-ui): add COD session workflow`

Add open session, movement history, counted close, variance confirmation, and owner/manager review. Manually verify keyboard use, labels, status text, permission visibility, and error/empty states.

### P3.5 — `feat(vendors): add vendor and expense categories`

Scope:

- Store/platform-scoped vendor master and hierarchical categories.
- Normalize/search safely; soft deactivate instead of deleting referenced data.
- Prepare ledger-account mapping field without requiring ledger tables prematurely if FK ordering prevents it.

### P3.6 — `feat(expenses): add expense workflow schema`

Scope:

- Expenses and exact allocations with draft/submitted/approved/paid/posted/rejected/voided lifecycle.
- Amount/status/approval checks, idempotency, store scope, actor/timestamps.
- Outbox source contracts for paid/posted/voided events.

### P3.7 — `feat(expenses): implement approval and payment policies`

Scope:

- Separate create, approve, pay permissions.
- Owner/manager thresholds and segregation of duties.
- Transactional audit/outbox and reversal after posting.
- Concurrency tests for approve-vs-void and duplicate payment.

### P3.8 — `feat(expenses): add private receipt attachments`

Scope:

- Storage abstraction and attachment metadata.
- Do not expose receipts through the current public `/uploads` route.
- Validate size/type/name; authorize every download; prevent path traversal.
- Use safe demo-local storage with a production-hardening note.

### P3.9 — `feat(finance-ui): add costs vendors and expenses`

Scope:

- Standard-cost editor/history, vendor/category management, expense form/list/detail/approval/payment.
- Store filters, exact allocation UI, receipt access, permission states.
- Initial non-ledger operating-cost/margin view clearly marked as source-based/pre-ledger.

Phase 3 gate:

- Every delivered COD order enters exactly one session.
- Expected cash is reproducible and variance explicit.
- Historical cost remains stable.
- Posted/paid workflows use reversals, not edits.
- All Phase 3 source events are replayable by planned Phase 4 posting rules.

## 14. Phase 4 — general ledger and posting engine

Do not start this phase unless Phase 0 posting ADR and Phase 3 event contracts are complete.

### P4.1 — `feat(ledger): add chart accounts journals and periods`

Scope:

- Ledger accounts, journal entries, journal lines, fiscal periods.
- Checks/indexes/source identity/reversal references.
- Seed the minimum system chart from `plan.md` deterministically.
- No posting worker yet.

### P4.2 — `feat(ledger): implement balanced posting kernel`

Scope:

- Typed posting command and line builder.
- Reject empty/unbalanced/invalid-side/closed-period journals.
- Make posted entries immutable.
- Implement reversal linking and exact zero-net-effect tests.

### P4.3 — `feat(finance-events): add idempotent posting worker`

Scope:

- Claim/process/retry/dead-letter outbox events safely.
- Unique source identity prevents duplicate journals.
- Record errors without logging sensitive payloads.
- Add two-worker and replay tests using PostgreSQL behavior, not mocks alone.

### P4.4 — `feat(ledger): post order collection and recognition`

Rules for:

- Online capture to clearing
- COD collection to cash
- Delivered sales/delivery revenue and tax liability
- COGS offset
- Cancellation/reversal

Prove capture is not revenue and `out_for_delivery` posts nothing.

### P4.5 — `feat(ledger): post refunds fees and settlements`

Add refund contra entries, refund payable/clearing, provider fee/tax, bank settlement, and mismatch-safe behavior. Reconcile fixture journals to settlement net.

### P4.6 — `feat(ledger): post expenses and cash variance`

Post approved/paid expenses according to ADR policy, cash over/short, deposits, and reversals. Map categories to accounts; do not silently use a generic account when mapping is missing.

### P4.7 — `feat(ledger): enforce fiscal period close`

Scope:

- Open, soft close, close, controlled reopen.
- Reject backdated posting into closed period.
- Owner capability, recent authentication, full audit.
- Test timezone and 31 March/1 April boundaries.

### P4.8 — `feat(ledger): expose journals and trial balance`

Add store-scoped `/api/v1/finance/ledger/*` list/detail/accounts/trial-balance endpoints with cursor pagination, aggregate serialization, policy metadata, and cross-store denial tests.

### P4.9 — `feat(ledger-ui): add journal trial balance and close screens`

Add drill-down, balanced line display, reversal/manual-adjustment confirmation, period close/reopen, permission-aware navigation, and tests. Manual journals require strict validation and never bypass the posting kernel.

Phase 4 gate:

- Trial balance is zero per store/currency/fixture period.
- Replaying every event adds no duplicates.
- Reversal neutralizes the original entry.
- Closed periods reject posting.
- Rebuilt ledger from fixtures matches expected results.

If any of these fail, Phase 4 is not complete and must not be presented as a working ledger.

## 15. Phase 5 — finance reporting and portfolio polish

### P5.1 — `feat(finance-reports): add report query layer`

Implement policy-backed queries/projections for recognized revenue, collections, refunds, COGS, gross profit/margin, expenses, operating result, unsettled balance, reconciliation issues, and cash variance. Reuse shared filters/date basis.

### P5.2 — `feat(finance-api): expose overview pnl sales and margin`

Add `/api/v1/finance` endpoints with store/consolidated scope, comparison metadata, generated time, currency, timezone, included statuses, cursor/pagination as needed, and exact DTO validation.

### P5.3 — `feat(finance-ui): add owner finance workspace`

Add Finance navigation and pages for overview, P&L, sales/margin, payments/refunds, settlements, cash, expenses, ledger, and close. Reuse current layouts/theme/shared UI; do not create a separate visual system.

### P5.4 — `feat(finance-ui): add traceable drill-down`

Every KPI/chart/table aggregate must navigate to filtered journal/source transactions. Handle zero, partial, stale, loading, and error states explicitly. Status must not rely on color alone.

### P5.5 — `feat(finance): add consistent CSV exports`

Use the same service/query policy as screens. Add permission checks, formula-injection-safe CSV fields, deterministic headings/amount units/date timezone, and export-vs-screen reconciliation tests.

### P5.6 — `perf(finance): index measured report bottlenecks`

Measure representative two-store/12-month data before adding indexes/materialized projections. Record query plans/latency target, add only justified indexes, and verify writes/migrations remain acceptable.

### P5.7 — `docs(finance): publish demo and operations runbooks`

Update README, architecture, database schema, API reference, setup, seed instructions, limitations, migration recovery, reconciliation/refund/outbox/period-close runbooks, and recruiter walkthrough. Add one-command deterministic demo reset/seed.

Phase 5 gate:

- Expected fixture file equals API, screen, export, and ledger results.
- Cancelled/failed/unpaid orders are not recognized revenue.
- Per-store and consolidated totals reconcile.
- The documented manual walkthrough covers simulated online and COD paths through P&L drill-down, while backend tests cover the underlying state and financial invariants.
- Fresh setup works without live credentials.

This is the recommended public v1 cut line.

## 16. Phase 6 and optional Phase 7

### Phase 6 — payroll-lite as operating cost

#### P6.1 — `feat(payroll): add restricted permissions and profiles`

Add finance profiles separate from memberships, explicit payroll permissions, employment dates/status, masked/encrypted sensitive metadata, and no automatic owner/manager salary visibility beyond confirmed policy.

#### P6.2 — `feat(payroll): add effective compensation versions`

Add non-overlapping effective-dated earning, deduction, and employer-cost components. Configuration is demo-only; no hard-coded statutory rates or compliance claims.

#### P6.3 — `feat(payroll): add pay run calculation workflow`

Implement draft -> calculated -> approved -> paid -> posted, plus void/reversal. Snapshot all lines; deterministic recalculation only while draft; stable error codes.

#### P6.4 — `feat(payroll): add approval payment and privacy audit`

Separate calculate/approve/pay duties, add payment reference, prevent sensitive audit/log leakage, and test list/detail/export inference attacks.

#### P6.5 — `feat(ledger): post payroll operating cost`

Post payroll expense/employer cost/payable/payment and reversals through the existing posting kernel/outbox.

#### P6.6 — `feat(payroll-ui): add pay runs and statements`

Add restricted operating-cost/payroll navigation, compensation history, pay-run workflow, gross-to-net and payslip-style output with `demo only` boundary.

#### P6.7 — `docs(payroll): document scope privacy and limitations`

Document retention, masking, permissions, demo deductions, no TDS/EPF/ESI filing claim, and recruiter scenario.

Phase 6 gate:

- Effective changes affect only correct periods.
- Posted runs require reversal.
- Unauthorized users cannot infer compensation through any API/UI/export/log.
- Payroll employer cost reconciles to P&L and ledger.

### Optional Phase 7 — India-style demo invoicing

Do not start unless core v1 is complete.

#### P7.1 — `feat(invoicing): add fictional business tax profile`

Add clearly fictional registration/profile data and HSN/SAC metadata with visible portfolio-demo status.

#### P7.2 — `feat(invoicing): add immutable invoice numbering`

Add legal-entity/financial-year sequence, concurrency-safe allocation, invoice snapshots, and no renumber/delete behavior.

#### P7.3 — `feat(invoicing): add credit notes for refunds`

Link credit-note snapshots to finalized refund allocations and original invoice; never modify original invoice.

#### P7.4 — `feat(invoicing-ui): add demo receipt downloads`

Add accessible HTML/PDF-style receipt/invoice view with persistent `Portfolio demo — not a statutory tax invoice` label. Do not claim IRN/QR validity.

#### P7.5 — `docs(invoicing): document non-statutory boundary`

Document fields, calculation source, limitations, and excluded GST portal/return/IRP behavior.

## 17. Agent handoff format

After each commit, provide this exact information to the next agent/user:

```text
Commit: <hash or proposed commit title>
Objective: <one sentence>
Changed: <key files/modules and behavior>
Schema/migration: <migration name, forward/backfill/contract behavior, or none>
Invariants verified: <list>
Tests run: <exact commands and results>
Not run: <commands and reason>
Known limitations/risks: <honest list>
Plan/guide deviation: <none, or approved deviation and reason>
Next commit: <ID/title and prerequisites>
Working tree: <clean or preserved unrelated files>
```

Do not say “all tests pass” without listing commands. Do not call a phase complete until its gate passes.

## 18. Stop-and-inform conditions

Pause implementation and inform the user before proceeding when:

- The current schema/data makes a planned backfill ambiguous or destructive.
- A requested change would alter money representation, rounding, recognition timing, tax mode, owner-vs-marketplace model, or ledger posting policy.
- A new dependency or infrastructure service materially changes setup/deployment.
- Existing authorization cannot express a required privacy boundary without redesign.
- Lock ordering or concurrent workflows create a deadlock/data-loss risk not covered by the plan.
- A provider/API behavior contradicts the planned state machine.
- A migration would rewrite historical financial meaning rather than preserve it.
- A phase gate exposes unexplained reconciliation or trial-balance differences.
- Completing the commit requires deleting user work, rewriting git history, using live payment credentials, or making external changes not explicitly authorized.

When reporting, include:

1. Exact code/schema evidence
2. The plan/guide assumption that failed
3. Two viable options with trade-offs
4. Your recommended option
5. Which later commits/phases are affected

Routine implementation details that preserve approved behavior do not require permission. Record them in the handoff.

## 19. Final release checklist

- Active implementation branch is `feature/financial-overhaul`.
- Working tree contains no accidental files or secrets.
- All migrations apply from current pre-finance database and clean baseline.
- All backend tests/typecheck/build pass.
- Frontend lint/build pass and all required manual UI/demo scenarios are recorded as passed.
- Deterministic demo works without network or payment credentials.
- Money, refund, allocation, ledger, period, authorization, and concurrency invariants pass.
- Per-store totals reconcile to consolidated totals.
- Reports, exports, journals, and source transactions agree.
- No endpoint leaks cross-store or payroll-sensitive data.
- Live payment mode is disabled/unsupported.
- Demo tax/payroll/invoice limitations are visible.
- README, architecture, database schema, API reference, setup, and runbooks match code.
- Each completed phase has an interview-ready diagram, failure scenario, rejected trade-off, invariant test, and measurable result.

The goal is not maximum feature count. The goal is a sequence of small, defensible commits that leaves the system correct at every checkpoint and gives another engineer—or recruiter—a clear path from source transaction to financial result.
