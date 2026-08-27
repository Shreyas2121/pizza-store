# Inventory & Stock Management — Implementation Guide

This is the execution guide for implementing [`inventory-feature.md`](./inventory-feature.md). It is written for AI coding agents and human reviewers. The feature must be delivered on a separate branch in small, reviewable commits.

The proposal is the product specification. This guide defines implementation order, safety rules, commit boundaries, and verification gates. If the two documents appear to conflict, stop and resolve the conflict before coding; do not silently invent a third design.

## Definition of done

The feature is complete only when all of the following are true:

- Product-level stock is tracked per `store_products` row; customizations consume the base product's stock.
- Manual availability is never changed by inventory code.
- COD purchases deduct stock atomically.
- Razorpay attempts reserve stock, captures consume it, and terminal failure/cancellation/verified expiry releases it.
- Cancellation restores previously deducted stock exactly once.
- Concurrent checkouts cannot oversell.
- Retried requests, webhooks, and reconciliation cannot duplicate movements.
- Out-of-stock products remain visible in the storefront but cannot be added or checked out.
- Admins can view, restock, adjust, and configure stock.
- Low-stock calculations use **available quantity**, not merely on-hand quantity.
- Backend unit tests cover inventory calculations, lifecycle branches, error propagation, and idempotency behavior.
- Backend typecheck/build and frontend lint/build pass.
- API and schema documentation reflect the shipped behavior.

---

## Agent operating rules

### Before editing

- Read this guide and `inventory-feature.md` completely.
- Inspect `git status --short --branch`.
- Preserve all pre-existing user changes. Never stage unrelated files with `git add .` or `git add -A`.
- Inspect the exact target files before modifying them; line numbers and code may have changed.
- Use the repository's existing pnpm package layout: `backend/` and `frontend/` are independent packages.
- Do not use `db:push` as the migration artifact. Generate and commit a migration.
- Do not implement ingredient-level stock or quantities for customization options.

### Branch setup

Create the feature branch before implementation:

```powershell
git switch -c feat/inventory-stock-management
```

If that branch already exists, inspect it before switching. Do not delete or overwrite it. If the working tree contains user changes that prevent a safe branch switch, stop and ask the user how to handle them.

Verify:

```powershell
git branch --show-current
git status --short
```

Expected branch: `feat/inventory-stock-management`.

### Commit discipline

- Complete commits in the order documented below.
- Each commit must build on the previous one and leave the repository in a coherent state.
- Run the commit's verification gate before committing.
- Stage only the paths belonging to that commit.
- Do not mix formatting, unrelated cleanup, or dependency upgrades into this feature.
- Do not rewrite or squash earlier commits unless the user asks.
- Check off the commit and master checklists as work is completed.

### Source-of-truth invariants

Every implementation decision must preserve these invariants:

```text
available_quantity = on_hand_quantity - active_reserved_quantity

sellable = products.is_available
        && store_products.is_available
        && (on_hand_quantity IS NULL || available_quantity > 0)
```

- `on_hand_quantity = NULL` means inventory is untracked/unlimited.
- Inventory code never writes `store_products.is_available`.
- Demand is aggregated by `productId` across customized cart lines.
- Every operation that can race locks store-product rows in ascending ID order.
- Inventory movements are append-only.
- A stock-changing business event has a unique idempotency key.
- Socket events are emitted only after the database transaction commits.

### Global lock order

Use one lock order throughout the codebase to reduce deadlocks:

```text
1. Existing owning row when required (cart or order/payment)
2. store_products rows, ascending store_products.id
3. inventory_reservations rows, ascending inventory_reservations.id
4. inventory movement insert
```

When consuming reservations, first read the relevant store-product IDs, lock the store-product rows in ascending order, and then lock the reservation rows. Do not introduce a path that locks reservations first and store-products second.

---

## Important clarifications to apply during implementation

### Customizations

Customized versions are not separate SKUs in this feature. These cart rows:

```text
Margherita / regular cheese × 1
Margherita / extra cheese × 2
```

produce a single stock demand of `Margherita × 3`. Customization-option availability remains boolean and continues to be validated by the existing customization/cart logic.

### Low-stock transitions use available quantity

Storefront status, dashboard counts, and alerts must use `available_quantity`.

- COD sale: available quantity decreases; it may cross the threshold.
- Razorpay reservation: available quantity decreases; it may cross the threshold.
- Razorpay reservation consumption: on-hand decreases while the reservation disappears, so available quantity is unchanged; do not emit the same alert again.
- Reservation release: available quantity increases; do not emit a low-stock alert.
- Restock: available quantity increases; do not emit a downward-crossing alert.

This prevents online stock from appearing available while it is already reserved and prevents duplicate alerts when a reservation is consumed.

### Reservation expiry is correctness work

Although the proposal lists the reconciliation job under Phase 2, a reservation system is not correct without a release path. Implement a minimal expiry/reconciliation command in the backend phase.

Never release reservations as a side effect of a storefront/list query. Never release solely because the local clock passed `expires_at` if the provider might already have captured payment. The expiry process must:

1. Find expired local reservations in bounded batches.
2. Reconcile or verify the Razorpay payment state outside the release transaction.
3. Release only when payment is confirmed non-captured/terminal or when the local attempt has been atomically made non-payable.
4. Skip completed/refunded payments and consumed reservations.
5. Log late-capture or state-conflict cases for manual resolution; never silently create paid-but-unfulfillable orders.

Keep external provider calls outside database transactions.

### Structured errors must match the existing error envelope

The current `AppError` handler returns:

```json
{
  "message": "Insufficient stock for one or more items",
  "code": "INSUFFICIENT_STOCK",
  "data": { "items": [] }
}
```

Use that existing envelope unless the error middleware is deliberately migrated across the whole app in a separate commit. Do not return the nested `{ "error": ... }` example from the proposal in only one feature.

---

## Commit plan

## Commit 1 — Add inventory schema, constraints, relations, and migration

Suggested commit:

```text
feat(db): add inventory stock reservation schema
```

### Target files

- `backend/src/db/schema/store.schema.ts`
- `backend/src/db/schema/inventory.schema.ts` (new)
- `backend/src/db/schema/index.ts`
- `backend/src/db/schema/_relations.ts`
- `backend/src/utils/types.ts`
- Generated `backend/migrations/*` files and matching metadata
- Schema documentation if needed to keep generated types understandable

### Tasks

- Add `onHandQuantity`, `lowStockThreshold`, and `lastRestockedAt` to `storeProductsTable`.
- Add Drizzle CHECK constraints for non-negative on-hand quantity and threshold.
- Create `inventoryReservationsTable` with status typing, expiry/lifecycle timestamps, unique `(orderId, storeProductId)`, and required indexes.
- Create `inventoryMovementsTable` with append-only fields, quantity equation CHECK, allowed change types, nullable unique idempotency key, and required indexes.
- Use `ON DELETE SET NULL` for `createdBy`.
- Preserve store-product referential history with restrictive/default FK behavior; do not cascade-delete movements.
- Export both tables and add relations.
- Add inventory status/type unions to `utils/types.ts`.
- Generate the migration through Drizzle.
- Inspect the generated SQL manually. Confirm all constraint names, indexes, FKs, and defaults are present.
- Inspect the migration SQL for database-enforced negative-quantity, status, movement-equation, uniqueness, and FK constraints. These database constraints are reviewed manually in this unit-test-only scope.

### Migration commands

```powershell
Set-Location backend
pnpm run db:generate
pnpm run typecheck
pnpm run build
```

Do not casually edit an already-applied migration. If generation produces unrelated schema changes, investigate before committing.

### Checklist

- [ ] Store-product inventory columns added with correct null/default behavior.
- [ ] Reservation constraints and indexes exist.
- [ ] Movement constraints and indexes exist.
- [ ] Relations and exports compile.
- [ ] Generated SQL inspected.
- [ ] Generated constraint SQL was reviewed against the proposal.
- [ ] No inventory logic writes `isAvailable`.

---

## Commit 2 — Implement inventory reads and admin stock operations

Suggested commit:

```text
feat(inventory): add stock queries and admin operations
```

### Target files

- `backend/src/features/inventory/inventory.service.ts` (new)
- `backend/src/features/inventory/inventory.routes.ts` (new)
- `backend/src/routes.ts`
- `backend/src/utils/zodSchema.ts` or feature-local schemas
- `backend/src/features/stores/stores.service.ts` for safe mapping removal
- `backend/package.json`, backend lockfile, and unit-test configuration if no test runner exists yet

### Backend unit-test setup

The backend currently has no working automated test command. Add only a lightweight unit-test setup—no test database, migration runner, containers, or PostgreSQL harness.

- Prefer Vitest unless the repository adopts another TypeScript-capable runner first.
- Add `test` and `test:watch` scripts to `backend/package.json`.
- Keep unit tests beside the inventory feature or under `backend/tests/unit/` consistently.
- Mock transaction/query collaborators at service boundaries.
- Extract pure inventory math and transition decisions so they can be tested without a database.
- Do not add frontend tests as part of this feature.

Unit tests are the only automated tests required for this implementation. They can validate demand aggregation, stock math, state transitions, idempotency decisions, generated update payloads, call order, and error propagation with mocked transaction collaborators. They cannot prove PostgreSQL row-lock serialization, database CHECK enforcement, or actual rollback behavior. Review the generated SQL and Drizzle query construction carefully, and report that limitation honestly in the final handoff; a database test harness is intentionally deferred.

### Service responsibilities

Implement reusable helpers rather than duplicating stock math in checkout/payment services:

- `aggregateCartDemand(items)` with safe-integer checks.
- `lockStoreProducts(storeId, productIds, tx)` ordered by store-product ID.
- `getActiveReservedQuantities(storeProductIds, tx)` as one grouped query, not N+1 queries.
- `getAvailableQuantity(onHand, reserved)`.
- `deriveStockStatus(onHand, available, threshold)`.
- Paginated inventory list with search/status filters.
- Single product detail.
- Paginated movement history.
- `restockProduct()` using row locks and an append-only movement.
- `adjustProduct()` using row locks, absolute target quantity, and required reason.
- `updateThreshold()`.
- Bulk service primitives may be added now, but do not add UI in this commit.

All writes must run in a transaction. Restock/adjustment idempotency is not derived from order IDs, so decide whether admin requests need a request ID. At minimum, one HTTP request must create one movement and the route must not retry writes automatically.

### API rules

- Mount routes at `/api/v1/inventory` using `mainRoutes.use("/inventory", inventoryRoutes)`.
- Protect every inventory route with `authenticateAdmin`.
- Parse route IDs with `parseIntegerParam`.
- Bound `page` and `limit`; reject rather than silently accepting invalid values.
- Maximum page limit: choose and document a finite value such as 100.
- Validate restock `quantityAdded` as a positive safe integer.
- Validate adjustment `targetQuantity` as a non-negative safe integer and require a trimmed reason.
- Return the existing response envelope conventions: `{ data, meta?, message? }`.
- Throw `AppError` with stable codes for not-found and inventory conflicts.

### Store-product removal

Update deletion behavior:

- If the mapping has any reservation or movement history, set `isAvailable = false` and return a soft-removal result.
- If it has no history, hard deletion may remain allowed.
- Never delete inventory history.
- Ensure remapping/upsert can reactivate the existing row rather than violating the unique store/product key.

### Checklist

- [ ] Reads calculate reserved and available quantities in batched SQL.
- [ ] Status filtering is based on available quantity.
- [ ] Restock and adjustment lock the row and write a movement atomically.
- [ ] `lastRestockedAt` changes only during restock.
- [ ] Adjustment requires a reason.
- [ ] Admin routes validate IDs, pagination, and bodies.
- [ ] Historical mappings soft-remove safely.
- [ ] Backend unit tests cover stock math, validation, and admin-operation branches.

### Verification gate

```powershell
Set-Location backend
pnpm run typecheck
pnpm test
pnpm run build
```

---

## Commit 3 — Enforce stock for COD and restore it on cancellation

Suggested commit:

```text
feat(checkout): enforce inventory for cod orders
```

### Target files

- `backend/src/features/checkout/checkout.service.ts`
- `backend/src/features/order/order.service.ts`
- `backend/src/features/order/order.routes.ts`
- Inventory service and backend unit tests

### Checkout design

- After existing product/manual-availability validation, aggregate cart demand by `productId`.
- Lock all relevant store-product rows in ascending ID order.
- Verify that every requested product has a store mapping.
- Fetch active reservation totals in one query.
- For tracked products, validate `available >= demanded`.
- Return a typed allocation/stock-validation result as part of the quote so later steps do not reconstruct demand.
- The rows remain protected because `buildQuote()` and order creation use the same database transaction.
- Throw one `INSUFFICIENT_STOCK` error containing all insufficient items, not only the first item.

### COD deduction

- Create payment and order snapshot using existing behavior.
- Deduct stock after the order ID exists but before the transaction commits.
- Update each tracked store-product exactly once.
- Insert one `sale` movement per tracked product with `sale:{orderId}:{storeProductId}`.
- Use available quantity before/after for low-stock threshold crossing.
- Do not modify manual availability.
- Return threshold-crossing alerts from the service; do not emit them yet.

### Cancellation

Refactor `updateOrderStatus()` into a transaction with legal state-transition validation.

- Lock the order first.
- If cancelling an order with sale movements, lock affected store-products in ascending order, restore exactly the sold quantities, and insert `cancellation` movements.
- Use `cancellation:{orderId}:{storeProductId}` idempotency keys.
- If the order has active reservations instead, release them.
- A repeated cancellation request must be a no-op or return the existing state; it must not restore twice.
- Closed orders must not transition back into active fulfilment states.
- Preserve existing payment/coupon semantics unless explicitly updated and tested; do not introduce a hidden coupon regression.

### Required tests

- [ ] Customized cart lines for one product are aggregated.
- [ ] Sufficient and insufficient availability branches return the correct allocations/error details.
- [ ] Mixed tracked and untracked carts behave correctly.
- [ ] Mocked query assertions verify `FOR UPDATE` and ascending store-product lock order are requested.
- [ ] A thrown stock/movement dependency aborts the service flow and prevents later side effects.
- [ ] Active Razorpay reservations reduce COD availability calculations.
- [ ] Manual availability is never included in inventory update payloads.
- [ ] Cancellation restoration is idempotent.
- [ ] Invalid order transitions are rejected.
- [ ] Restock and checkout both use the shared deterministic-locking helper.

### Verification gate

Run backend typecheck, all backend unit tests, and build before committing.

---

## Commit 4 — Add Razorpay reserve, consume, release, and expiry lifecycle

Suggested commit:

```text
feat(payments): manage inventory reservations
```

### Target files

- `backend/src/features/payments/payment.service.ts`
- `backend/src/features/payments/payment.routes.ts`
- `backend/src/features/payments/payment.webhook.routes.ts`
- `backend/src/features/payments/razorpay.webhook.ts` if result propagation is needed
- `backend/src/features/inventory/inventory.service.ts`
- `backend/src/scripts/reconcile-inventory-reservations.ts` (new, or integrate carefully with the existing payment reconciliation script)
- `backend/package.json`
- Backend unit tests

### Initiation

Inside `findOrCreateLocalAttempt()` and the existing DB transaction:

- Use the quote's aggregated/locked allocations.
- Create the local payment and `awaiting_payment` order.
- Insert one reservation per tracked store-product with a common expiry policy.
- Do not decrement on-hand or write a sale movement.
- Keep the existing `clientRequestId` idempotency behavior.
- The `(orderId, storeProductId)` unique key provides a second defense.
- Calculate any downward low-stock crossing from available quantity before and after reservation.

### Capture

Inside `finalizeCapturedPayment()`:

- Retain existing order/payment validation and idempotency checks.
- Identify reservation store-product IDs.
- Lock store-products in ascending order, then lock reservations.
- Require the expected reservation set for all tracked order products.
- If reservations are already consumed and the payment is already completed with the same provider payment ID, return the existing idempotent result.
- If reservations were released/expired, do not deduct unreserved stock blindly. Return a stable conflict, record structured operational logs, and route the case into the existing reconciliation/manual-resolution path.
- Mark reservations consumed, decrement on-hand, and insert sale movements in the same transaction as local payment/order completion.
- Consumption should not emit another low-stock alert because available quantity does not change when a reservation becomes a deduction.

### Failure and cancellation

- Release only rows currently in `reserved` status.
- Add release calls to both provider-order-creation failure and provider-payment failure paths.
- Preserve `consumed` reservations.
- Make webhook, verification, and reconciliation retries no-ops after terminal processing.
- Ensure cancelling an `awaiting_payment` order makes it non-payable and releases reservations atomically.

### Expiry/reconciliation command

- Process bounded batches and expose `--limit`/age configuration similar to the existing payment reconciliation script.
- Reconcile provider status before deciding release.
- Do not hold a DB transaction open during Razorpay network calls.
- Re-lock order/payment/reservations before the final release decision.
- Skip attempts whose state changed after provider lookup.
- Add a package script such as `inventory:reconcile-reservations`.
- Produce structured totals: scanned, released, skipped, captured/finalized, conflicts, errors.

### Required tests

- [ ] Online initiation reserves but does not decrement on-hand.
- [ ] Duplicate initiation does not duplicate reservations.
- [ ] Reservations reduce availability for other checkouts.
- [ ] Capture consumes and deducts once.
- [ ] Duplicate verification/webhook does not deduct twice.
- [ ] Provider creation failure releases once.
- [ ] Payment failure releases once.
- [ ] Cancellation releases an unpaid reservation.
- [ ] Expiry reconciliation skips captured/completed payments.
- [ ] State changing between provider lookup and DB update is handled safely.
- [ ] Released reservation cannot be silently consumed by a late callback.

### Verification gate

```powershell
Set-Location backend
pnpm run typecheck
pnpm test
pnpm run build
```

This is the highest-risk commit. Do not proceed while any lifecycle or locking-behavior unit test is failing.

---

## Commit 5 — Expose stock status through catalog and cart APIs

Suggested commit:

```text
feat(catalog): expose store product stock status
```

### Target files

- `backend/src/features/products/product.service.ts`
- `backend/src/features/stores/stores.service.ts`
- `backend/src/features/cart/cart.service.ts`
- Related route/response types and tests

### Tasks

- Update both store-scoped product query paths in `product.service.ts`; there are multiple methods with existing `isAvailable` filters.
- Continue respecting manual product and store-product availability.
- Return manually available products even when derived stock status is out of stock.
- Join one grouped active-reservation subquery; avoid per-product queries.
- Add `stockStatus` to every relevant store-scoped product response.
- Return `stockCount` only for low-stock products; otherwise return `null` or omit it consistently.
- Update store-product admin responses with on-hand, reserved, and available quantities.
- Reject add-to-cart and quantity-increase operations that exceed current available quantity using `INSUFFICIENT_STOCK`.
- Keep checkout as the final authority because availability can change after cart mutation.
- Preserve existing customization availability checks.

### Required tests

- [ ] Untracked, in-stock, low-stock, and out-of-stock states derive correctly.
- [ ] Zero is out-of-stock, not low-stock.
- [ ] Exact threshold is low-stock.
- [ ] Active reservations affect returned status/count.
- [ ] Out-of-stock products remain present in product listings.
- [ ] Manually disabled products follow existing visibility behavior.
- [ ] Cart add/increment returns the standard structured stock error.
- [ ] Multiple customized lines share base-product availability.

---

## Commit 6 — Add storefront stock UX

Suggested commit:

```text
feat(frontend): show product stock availability
```

### Target areas

- `frontend/src/features/catalog/model/`
- `frontend/src/features/catalog/components/customer/product-card.tsx`
- `frontend/src/features/catalog/components/customer/customization-drawer.tsx`
- `frontend/src/features/cart/`
- Shared API error typing/notification helpers where appropriate

### Tasks

- Extend catalog schemas/types with `StockStatus` and nullable stock count.
- Show “Only X left” only for `low_stock`.
- Render out-of-stock cards visibly disabled/greyed without removing them.
- Disable both direct Add to Cart and customized-product confirmation for out-of-stock products.
- Handle server-side `INSUFFICIENT_STOCK` responses in cart and checkout without parsing message text.
- Show item-specific requested/available information when returned.
- Invalidate catalog/cart queries after a stock conflict so the screen refreshes.
- Keep accessible disabled state, contrast, and descriptive text.

### Checklist

- [ ] Untracked/in-stock UI is unchanged.
- [ ] Low-stock badge shows the server-provided count.
- [ ] Out-of-stock product remains visible and cannot be submitted.
- [ ] Customized product flow uses the same base stock state.
- [ ] Server conflict is handled gracefully.
- [ ] Frontend lint and build pass.

### Verification gate

```powershell
Set-Location frontend
pnpm run lint
pnpm run build
```

Manually verify desktop and narrow/mobile layouts.

---

## Commit 7 — Add the admin inventory page and core forms

Suggested commit:

```text
feat(admin): add inventory management page
```

### Target structure

Create a feature module consistent with existing frontend conventions:

```text
frontend/src/features/inventory/
  api/
  components/
  model/
  pages/
  index.ts
```

Modify:

- `frontend/src/app/router/routes.tsx`
- `frontend/src/features/admin-navigation/model/navigation.config.ts`

### Tasks

- Add lazy-loaded `/admin/inventory` route under `AdminLayout`.
- Add Inventory to the admin sidebar.
- Reuse the stores select API.
- Build paginated inventory table with server-side store, status, search, page, and limit state.
- Show Product, On-hand, Reserved, Available, Threshold, Status, and Last Restocked.
- Add restock modal with positive integer validation.
- Add adjustment modal with non-negative target and mandatory reason.
- Add threshold editing.
- Invalidate inventory, product/catalog, and dashboard query keys after successful mutations.
- Provide loading, empty, error, and no-store-selected states.
- Do not put bulk restock or movement drawer into this commit.

### Checklist

- [ ] Route and sidebar link work.
- [ ] Store selector and filters update server queries.
- [ ] Pagination metadata is honored.
- [ ] Restock, adjustment, and threshold forms validate correctly.
- [ ] Available and on-hand quantities are visually distinct.
- [ ] Mutations refresh all affected queries.
- [ ] Frontend lint/build pass.

---

## Commit 8 — Add bulk restock and movement history

Suggested commit:

```text
feat(inventory): add bulk restock and movement history
```

### Backend tasks

- Add/finish bulk-restock endpoint with maximum 50 distinct products.
- Reject duplicate product IDs in a batch.
- Validate every mapping before applying changes.
- Lock rows in ascending store-product ID order.
- Apply all changes and movements in one transaction.
- Roll back the entire batch on any error.
- Add product-specific movement filtering if required by the history drawer.

### Frontend tasks

- Add row selection and bulk-restock modal.
- Give each selected product its own positive quantity input and optional reason.
- Add movement-history drawer with pagination and change-type filters.
- Display signed quantity delta, resulting quantity, reason, actor, and timestamp.
- Use server pagination; do not download the entire log.

### Required backend unit tests/checks

- [ ] Invalid product aborts the bulk operation before a successful result is returned.
- [ ] Duplicate IDs are rejected.
- [ ] Bulk restock and checkout both request the shared deterministic lock order.
- [ ] Maximum batch size is enforced in backend and frontend.
- [ ] Movement history filters and pagination are correct.
- [ ] Backend and frontend verification gates pass.

---

## Commit 9 — Add low-stock events and dashboard metric

Suggested commit:

```text
feat(inventory): add low stock alerts and dashboard metric
```

### Backend tasks

- Define a typed low-stock alert payload with severity.
- Return pending alert payloads from committed business operations.
- Emit only after the transaction promise resolves.
- Emit on downward available-quantity crossing caused by COD deduction or online reservation.
- Do not emit again during reservation consumption.
- Use an authenticated admin room if socket authentication/rooms are available. If the current socket architecture only supports global emission, document that limitation and avoid pretending store isolation exists.
- Add dashboard count based on available quantity, excluding untracked/manual-disabled mappings according to documented semantics.
- Decide whether the single “Low Stock Items” metric includes out-of-stock items; recommended: include both and make the UI label/tooltip explicit.

### Frontend tasks

- Listen for `lowStock` in the admin shell/socket lifecycle.
- Show one Mantine notification per event with low/out-of-stock severity.
- Clean up listeners on unmount/reconnect to avoid duplicate notifications.
- Add dashboard card linking to the filtered inventory page.

### Required tests/checks

- [ ] Downward crossing emits once after commit.
- [ ] Rollback emits nothing.
- [ ] Reservation consumption emits no duplicate.
- [ ] Release/restock emits no low-stock warning.
- [ ] Dashboard count uses available quantity.
- [ ] Socket listener is cleaned up.

---

## Commit 10 — Finalize documentation and full regression

Suggested commit:

```text
docs(inventory): document stock lifecycle and operations
```

### Documentation tasks

Update the maintained project docs, not only the feature proposal:

- `docs/database-schema.md`
- `docs/api-reference.md`
- `docs/architecture.md`
- `docs/setup.md` for backend unit-test and reconciliation commands
- `docs/razorpay-runbook.md` for reservation/capture/failure/late-callback behavior
- Root README documentation map or feature list if appropriate

Document:

- Quantity meanings and customization scope.
- Manual availability versus stock status.
- COD and Razorpay lifecycle diagrams.
- Reservation expiry/reconciliation operations.
- Error codes and response envelope.
- Admin endpoints and pagination limits.
- Operational handling for late capture/state conflict.

### Final verification

```powershell
Set-Location backend
pnpm run typecheck
pnpm test
pnpm run build

Set-Location ..\frontend
pnpm run lint
pnpm run build

Set-Location ..
git status --short
git log --oneline --decorate -12
```

Then perform a manual end-to-end pass:

- [ ] Admin enables stock tracking for a product.
- [ ] Restock and adjustment create correct movements.
- [ ] Customized cart lines consume shared base-product stock.
- [ ] COD order deducts immediately.
- [ ] Online attempt reserves without deducting.
- [ ] Online capture consumes exactly once.
- [ ] Failure/cancellation releases or restores correctly.
- [ ] Out-of-stock product stays visible but disabled.
- [ ] Low-stock notification occurs after commit.
- [ ] Dashboard and inventory page agree.
- [ ] Existing ordering, coupons, chat, and store management still work.

Do not stage `inventory-feature.md`, `guide.md`, or other planning files in a code commit unless that commit explicitly owns their documentation changes.

---

## Master implementation checklist

### Git and safety

- [ ] Created/switched to `feat/inventory-stock-management`.
- [ ] Recorded pre-existing dirty files and preserved them.
- [ ] Used path-specific staging for every commit.
- [ ] Kept each commit focused and verified.

### Backend correctness

- [ ] Lightweight backend unit-test setup exists; no database harness is required.
- [ ] Schema/migration constraints and indexes are complete.
- [ ] Stock math uses active reservations.
- [ ] Cart demand aggregates customization variants by product.
- [ ] Locks use deterministic order.
- [ ] COD deduction is atomic.
- [ ] Razorpay reserve/consume/release is atomic and idempotent.
- [ ] Safe expiry reconciliation exists.
- [ ] Cancellation restores/releases once.
- [ ] Manual availability is untouched by inventory logic.
- [ ] Mapping deletion preserves history.
- [ ] Structured errors use the existing `AppError` envelope.

### API and UI

- [ ] Inventory admin endpoints are authenticated and validated.
- [ ] Storefront exposes all four stock statuses.
- [ ] Out-of-stock products remain visible.
- [ ] Cart and checkout reject insufficient availability.
- [ ] Admin inventory table and forms work.
- [ ] Bulk restock is atomic and capped at 50.
- [ ] Movement history is paginated.
- [ ] Alerts use available-quantity threshold crossing.
- [ ] Dashboard count matches inventory query semantics.

### Quality

- [ ] Backend-unit-testable acceptance behaviors from `inventory-feature.md` are covered.
- [ ] Additional late-capture/expiry state-transition unit tests pass.
- [ ] Backend typecheck and build pass.
- [ ] Backend unit-test suite passes.
- [ ] Frontend lint and build pass.
- [ ] Manual responsive UI pass completed.
- [ ] Maintained documentation updated.
- [ ] Final diff contains no unrelated changes or credentials.

---

## Review guide for each commit

Before accepting any commit, the reviewing agent should answer:

1. Does this commit preserve manual availability as an independent control?
2. Does every stock calculation include active reservations?
3. Can two concurrent requests produce a lost update or oversell?
4. Are locks acquired in the global order?
5. Is the operation idempotent under an HTTP retry, webhook retry, or reconciliation retry?
6. Does failure roll back every related database change?
7. Is any Socket.IO event emitted before commit?
8. Does the implementation introduce an N+1 query?
9. Are structured errors stable and machine-readable?
10. Are the relevant backend unit tests present and passing?

If any answer is uncertain, the commit is not ready to merge.

## Final branch handoff

At completion, provide the user with:

- Branch name.
- Ordered commit list and one-line purpose of each.
- Verification commands run and their results.
- Migration filename.
- Any intentionally deferred Phase 2 work.
- Any operational setup required for reservation reconciliation.
- A concise list of known limitations, especially global Socket.IO scope or late-payment manual handling.

Do not merge into `main`, push, deploy, or apply migrations to a shared database unless the user explicitly asks.
