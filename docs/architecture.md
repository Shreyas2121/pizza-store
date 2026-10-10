# Architecture

Reviewed against the working tree on 10 October 2026. Start with [the high-level diagram](high-level-design.md); this reference explains the boundaries behind it.

## Runtime and module boundaries

PizzaStore is a modular monolith: one React SPA, one Express process hosting HTTP and Socket.IO, and PostgreSQL through Drizzle. The financial posting worker is invoked separately as a bounded command using the same backend modules. It is not an automatic loop inside the HTTP server.

[index.ts](../backend/src/index.ts) installs request context, protected metrics, the raw-body Razorpay webhook, normal body parsing/CORS, static uploads, HTTP logging, the main API router and error handling. [routes.ts](../backend/src/routes.ts) mounts domain routers under `/api/v1`. External provider calls and filesystem writes cannot be rolled back by a PostgreSQL transaction.

| Module group | Responsibility |
| --- | --- |
| users, auth, access, staff, audit | Identity, current principals, memberships, invitations and safe lifecycle evidence |
| products, category, menu, customization, stores, bundles | Global catalogue, store prices/serviceability, component-backed combos and pricing defaults |
| cart, pricing, checkout, promotions | Owned cart, exact quotes, locked snapshot writing, eligibility and promotion lifecycle |
| order, inventory, payments | Fulfillment, stock/reservations, provider adapters, verification and recovery |
| refunds, settlements, cash-management | Customer money return, provider matching, cash collection/variance |
| costs, vendors, expenses, payroll | Effective costs, supplier expenses, private receipts and restricted pay runs |
| finance-events, ledger, finance-reports | Financial outbox, balanced posting, reversals, periods, reports and CSV |
| realtime, chat, observability, system-maintenance | Authorized event audiences, support, metrics and explicit demo maintenance |

Routes authenticate/validate and delegate to workflows. Complex domains split services into repositories, pure policies, DTO mappers and injected collaborators. A single two-file service pattern does not describe every module.

## Pricing and checkout

[PricingService](../backend/src/features/pricing/pricing.service.ts) produces quote version `2026-10-10-01`, pricing policy v5, using current store prices, valid customization choices, effective delivery/tax rules, store-local time and promotion usage.

- Money stays integer paise; rates use integer basis points and checked rounding/allocation helpers.
- Menu prices and charged delivery are tax-inclusive. Included tax is disclosed and accounted for, not added again.
- The ordinary store free-delivery threshold applies to the pre-discount item subtotal, including customizations. Offer resolution runs against any remaining ordinary delivery fee.
- An applied automatic offer or deal bundle blocks manual coupon use. Non-overlapping winning unit allocations can apply different offers; winners use savings, priority and stable IDs.
- Bundle selling price is authoritative. Compare-at markdown is display-only and never creates discount budget, contra-revenue or refundable money. Inventory demand expands to saved components.

The final [checkout snapshot writer](../backend/src/features/checkout/checkout-snapshot.service.ts) is shared by COD and online initiation. It locks/revalidates the owned cart, eligibility, store, catalogue/stock and applicable promotions; it saves order/items/customizations, bundle components and promotion applications/allocations in the caller's transaction. Preview is informational; checkout rebuilds authoritative inputs.

COD creates a pending order/payment, deducts tracked stock, consumes promotions and clears the cart together. Online initiation creates an awaiting-payment order and immutable payable snapshot, reserves tracked stock and promotion capacity, and clears the cart before calling the provider outside SQL. Provider identity is attached in a later transaction.

## Inventory and recovery

[InventoryService](../backend/src/features/inventory/inventory.service.ts) implements:

```text
available = null, when on-hand quantity is null (untracked)
available = max(0, on-hand - active reserved), otherwise
```

Manual product/store availability remains a separate gate. Customized variants share base-product demand; bundle demand includes components. Several stock helpers acquire store-product locks in ascending ID order. Do not infer global deadlock freedom from these helpers: checkout, existing-order lifecycle, membership, reservation release and cancellation have different prefixes and dependencies.

Online holds default to 30 minutes and persist after transaction locks are released. Passing the timestamp does not release them; reconciliation must change their status. Expiry discovery includes persisted payment-attempt deadlines, so it can also find orders without tracked-stock rows. Provider/configuration uncertainty preserves holds.

Failure releases inventory and promotion reservations together. Customer retry restores saved demand and current capacity in one transaction, without repricing. Verified capture can restore released promotions without current capacity limits because the customer already paid; inventory must still be available. Capture of a cancelled order is rejected. Order cancellation restores recorded tracked sales once but does not issue a refund or reverse consumed promotion applications. See [reservation recovery](payment-inventory-retry.md).

Inventory movements carry arithmetic/nonnegative checks and sale/cancellation idempotency keys. They are operational history; the explicit system-maintenance reset can truncate them. Posted financial journals have stronger immutability controls.

## Payment boundaries

[Payment routes](../backend/src/features/payments/payment.routes.ts) mount method discovery, initiation, owned status/retry, verification, admin stale reconciliation and simulator events. The simulator is credential-free and in-process; optional Razorpay Test Mode uses the external adapter. Live mode/key IDs are rejected by startup configuration.

Finalization verifies ownership where applicable, provider/local identity, exact amount/currency and captured/paid state. The locked [finalizer](../backend/src/features/payments/payment-finalization.service.ts) consumes saved inventory/promotions, updates payment/attempt/order and writes the captured financial event atomically. Repeated completion with the same provider payment identity returns without a second effect. Webhook claims, finalization, event acknowledgment and notifications remain separate boundaries.

The simulator's provider state is memory-only. A restart does not reconstruct persisted historic provider IDs. Use fresh checkout for payment/refund demonstrations. The fixed and recruiter seeds contain prepared history, not live provider objects.

## Accounting and reports

Business operations write financial events with source identity/version in their SQL transaction. [PostingWorker](../backend/src/features/finance-events/posting-worker.ts) claims supported events using leases; repositories use `FOR UPDATE SKIP LOCKED`, retry/backoff and dead-letter policy. [CommercePostingService](../backend/src/features/ledger/commerce-posting.service.ts) dispatches posting policies; some lifecycle events are deliberately acknowledged without a journal.

The [ledger kernel](../backend/src/features/ledger/ledger.service.ts) inserts a draft journal, inserts lines and posts only when valid. Migration 0023 adds database balance and posted-history immutability triggers. Source uniqueness makes repeated posting idempotent, including retry after a journal commits before event acknowledgment. Corrections create linked reversal entries.

Collection, recognition and settlement are distinct. Capture credits customer advances; delivery recognizes tax-exclusive revenue, actual item discount and standard COGS; settlement clears provider funds into bank with fees. Refunds use paid snapshots and do not imply stock return. Free-delivery savings and bundle markdown do not create item contra-revenue.

Open periods allow posting. Soft-closed periods allow source postings but require an authorized explicit override for manual posting. Closed periods reject all new postings until an audited owner reopen. Reports/CSV read posted/reversed journal populations with saved business dates and shared projection policy. Unauthorized viewers receive masked payroll-sensitive aggregates. See [finance contracts](finance-lifecycle-contracts.md), [operations](finance-operations-runbook.md) and [ADRs](adr/README.md).

## Authorization and realtime

JWTs identify the principal; each authenticated request reloads active user/token version. Current store memberships and resource-derived scope determine authority. Platform admins normally bypass membership checks; manager-only promotion participation deliberately rejects an admin override.

Socket handshakes authenticate and derive personal/platform/store rooms on the server. Clients cannot choose arbitrary audiences. Membership changes disconnect affected sockets visible to the local process; a new handshake reloads memberships. Shared multi-instance revocation is not established.

The [typed event contract](../backend/src/features/realtime/realtime.types.ts) includes `orderPlaced`, `orderStatusChanged`, `lowStock`, `inventoryChanged`, `refundStatusChanged`, `expenseStatusChanged`, `chatRequest`, `chatStatusChange`, `newMessage` and `membershipChanged`.

Notifications are sent after commit and are best-effort. The financial outbox supports accounting, not universal socket replay. Some payment finalization results still omit audience context expected by HTTP/webhook callers; CLI reconciliation sends no socket events. Refresh authoritative API state after a missed notification.

## Frontend organization

[AppRoutes](../frontend/src/app/router/routes.tsx) defines lazy feature pages and four shells: MainLayout, nested ProfileLayout, guarded AdminLayout and public DocsLayout. `/docs` content is local; [App](../frontend/src/app/app.tsx) isolates business effects while reading it. See [public docs authoring](public-docs.md).

TanStack Query owns server data; Zustand owns auth and transient UI/socket state. The Axios token getter keeps shared transport independent of feature stores. Private query keys include principal identity; staff queries use store scope and cancellation signals. Cache root prefixes support reliable invalidation after stock/checkout changes. See [cache isolation](client-cache-isolation.md).

The offers API can return eight featured candidates; the homepage displays at most five and optional rotation is seven seconds, initially paused. Hover, focus, hidden-page and reduced-motion behavior constrain rotation. Forms validate client shape while the server owns pricing/eligibility. Shared skeletons preserve layout for initial loading and leave cached content visible during refresh.

## Files, diagnostics and deployment limits

Catalogue/promotion images use public `uploads`; expense receipts use private `.private/expense-receipts` with authorized downloads and content/type/size validation. Promotion uploads decode/re-encode JPEG/PNG/WebP with Sharp; replacement crosses filesystem/database boundaries and orphan cleanup handles unreferenced managed files after 24 hours.

Request middleware retains or generates a UUID `X-Request-ID`. Safe high-risk audit evidence uses request/resource identities. Winston writes console and dated local files; protected `/metrics` exposes financial operational observations. This is not a supplied centralized log/trace/retention system.

No Docker, CI-provider configuration, deployment pipeline or automatic scheduler is supplied. Multi-instance serving would require coordinated storage, socket audiences and provider simulation strategy. PostgreSQL race tests, actual-host SPA fallback, browser/provider flows and measured report latency remain separate verification work; see [the current record](case-study-verification.md).
