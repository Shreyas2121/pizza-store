# Razorpay payment integration plan

## 1. Goal and scope

Add Razorpay Standard Checkout as an online-payment option while keeping Cash on Delivery (COD). This document is an implementation plan, not an implementation. It is written from the current repository state on 2026-08-23.

Phase 1 should support:

- a checkout choice between `cash` and `razorpay`;
- server-created Razorpay Orders in INR;
- Razorpay Standard Checkout in the React application;
- mandatory server-side checkout-signature verification;
- webhook-based reconciliation for captured and failed payments;
- exactly-once local order/payment finalization even when callbacks or webhooks are duplicated or arrive out of order;
- continued support for existing COD orders;
- test-mode verification and a controlled live-mode rollout.

Refund initiation, partial payments, subscriptions, saved cards, and marketplace/Route settlement are not part of phase 1. The schema may record a refunded provider state, but an admin refund workflow should be a separate feature.

## 2. Current codebase findings

### Stack and structure

- `frontend/`: React 19, Vite, TypeScript, Mantine, TanStack Query, Axios and Zustand.
- `backend/`: Express 5, TypeScript, Drizzle ORM and PostgreSQL.
- Authentication is a JWT added by the shared Axios client. The API is mounted below `/api/v1`.
- Currency is already configured as INR in `backend/src/constants.ts`; catalogue/order money is currently stored as `doublePrecision` rupee values.
- There is no automated backend test setup at present (`backend/package.json` has a placeholder test command).

### Current checkout and COD path

1. `frontend/src/features/checkout/pages/checkout-page.tsx` loads user, addresses and cart, calculates a coupon discount in the browser, and calls `POST /order` with `addressId`, `totalPrice`, `discountAmount`, `couponId`, and `paymentType: "cash"`.
2. `frontend/src/features/checkout/components/payment-step.tsx` renders COD as the only, non-interactive choice.
3. `backend/src/features/order/order.routes.ts` accepts those client-supplied monetary fields and passes them into `OrderService.createOrder`.
4. `backend/src/features/order/order.service.ts` validates the store, address, delivery zone, and availability, snapshots cart items into order items, deletes the cart, and returns the local order ID in one database transaction.
5. Coupon redemption is a second frontend-triggered request after order creation, so it is neither atomic nor authoritative.
6. `backend/src/features/payments/payment.routes.ts` exposes `POST /payments/process-cod`, but the live checkout never calls it. The endpoint only inserts an unlinked `payments` row with `pending` status.
7. Consequently, normal COD orders have `orders.payment_id = null`, even though order-detail queries and relations expect a payment.

### Data model relevant to the change

- `orders`: has fulfillment `status`, `payment_type` defaulting to `cash`, and nullable `payment_id`.
- `payments`: only has local ID, generic status, `payment_date` (currently set at row creation), and timestamps. It has no amount, currency, provider, provider order/payment identifiers, error information, or idempotency key.
- `PaymentType` is only `"cash"` in backend and frontend types and in `createOrderSchema`.
- The payment-to-order Drizzle relation is inferred through `orders.paymentId`; there is no database uniqueness constraint proving it is one-to-one.

### Correctness and security gaps that must be fixed before online payments

- The browser controls the stored `totalPrice` and `discountAmount`. A caller can tamper with both. Razorpay amounts must always come from a fresh server-side calculation.
- Coupon validation currently trusts a client-supplied total, and redemption occurs in a separate request. Validation, discount calculation, redemption, and order creation need server ownership and transactional concurrency protection.
- Floating-point rupee values cannot be sent directly to Razorpay. Razorpay expects an integer amount in currency subunits; introduce a single tested rupees-to-paise conversion and store the charged paise on the payment row.
- Creating an order currently clears the cart immediately. An online flow needs a durable pending-payment order, safe retries, and a defined recovery path if the user closes Checkout or an external/API step fails.
- Current order fulfillment status has no `awaiting_payment` state. Unpaid online orders must not appear to admins as actionable kitchen orders or count as revenue.
- The current global `express.json()` runs before all routes. A Razorpay webhook signature must be computed from the exact raw request body, so the webhook route needs special middleware ordering.
- Coupon redemption can currently be requested for an order the caller does not own and can be repeated/concurrently incremented. This endpoint should be removed from the client flow and made an internal transaction step.

## 3. Target domain model

Keep fulfillment state and payment state separate:

- `orders.status`: add `awaiting_payment` for an online order that is not yet paid. Only transition it to existing `pending` after a captured payment is confirmed. COD orders can start at `pending` as today.
- `orders.paymentType`: `cash | razorpay`.
- `payments.status`: keep application-level values such as `pending | processing | completed | failed | refunded`. Treat only `completed` as paid. Do not equate a client callback or Razorpay `authorized` state with `completed`.
- Store the exact Razorpay state separately in `providerStatus` (`created`, `authorized`, `captured`, `failed`, `refunded`, and so on) so reconciliation does not lose provider detail.

Extend `payments` with at least:

| Column | Purpose |
| --- | --- |
| `provider` | `cod` or `razorpay` |
| `amount_paise` | Integer amount the server asked Razorpay to collect |
| `currency` | `INR` in phase 1 |
| `provider_order_id` | Razorpay `order_...`; unique when non-null |
| `provider_payment_id` | Razorpay `pay_...`; unique when non-null |
| `provider_status` | Last provider status seen |
| `client_request_id` | Client-generated UUID/idempotency key; unique per user checkout attempt |
| `failure_code`, `failure_description` | Sanitized diagnostics for support |
| `paid_at`, `failed_at` | Correct lifecycle timestamps; replace the misleading create-time `payment_date` semantics |

Also:

- Add a unique constraint to `orders.payment_id` if retaining the current one-payment-per-order shape.
- Add `payment_webhook_events(event_id unique, event_type, processed_at, created_at)` for duplicate webhook detection. Storing full webhook payloads is optional and should be avoided unless retention, PII access, and cleanup policy are defined.
- Add a `coupon_redemptions` (or `coupon_reservations`) table keyed uniquely by local order, with coupon/user IDs and `reserved | consumed | released` state. During initiation, lock the coupon row and count both reserved and consumed uses before accepting the last available slot. On capture, change the reservation to consumed and increment/derive the public redemption count exactly once; on failed/cancelled/expired checkout, release it. This makes the "reserve coupon capacity" steps below implementable without decrement/re-increment races.
- Add indexes on `provider_order_id`, `provider_payment_id`, and payment status.
- Generate a Drizzle migration (the next numbered migration) and update schema snapshots through the normal generator; do not hand-edit only the TypeScript schema.

One Razorpay Order can contain multiple payment attempts, so reuse the same `provider_order_id` when the customer retries that local order. The single payment row can record the successful/latest provider payment ID. If the product later needs detailed attempt history, split this into `payments` and `payment_attempts`; that is not required for the first delivery.

## 4. Server-authoritative quote and order creation

Extract the shared checkout validation/calculation from `OrderService.createOrder` into a transaction-aware service (for example, `CheckoutService`). It should:

1. Load the authenticated user's cart and items.
2. Validate active/open store, store/product availability, selected address ownership, and delivery-zone coverage using the existing rules.
3. Recalculate the subtotal from the cart item price snapshots, customization price snapshots, quantities, and any delivery fee. Do not accept a total or discount from the browser.
4. If a coupon code is supplied, load and lock the coupon row, validate dates/activity/minimum order/redemption capacity against the server subtotal, and calculate the discount on the server.
5. Round through a central money helper and produce `subtotalRupees`, `discountRupees`, `totalRupees`, and integer `amountPaise`. Reject a charge below Razorpay's/account's permitted minimum instead of opening Checkout with zero. A 100% discount order should follow a deliberate free-order path without Razorpay.
6. Snapshot those values and the items into the local order.

Change public request bodies to carry intent, not money. For example:

```json
{
  "addressId": 12,
  "paymentType": "razorpay",
  "couponCode": "SAVE20",
  "clientRequestId": "uuid-generated-once-per-checkout-attempt"
}
```

COD should use the same server calculation. Remove `totalPrice`, `discountAmount`, and `couponId` from the accepted checkout schema once the frontend is migrated.

## 5. Online-payment lifecycle (saga)

An external Razorpay call cannot be atomic with PostgreSQL. Implement the flow as an idempotent saga with durable local state.

### Initiation: `POST /api/v1/payments/razorpay/orders` (authenticated)

1. Validate the request and `clientRequestId`.
2. In a database transaction, run the server quote, create a local order with `awaiting_payment`, snapshot order items, create/link a Razorpay payment row with `processing`, and reserve the coupon redemption capacity. Persist before calling Razorpay. A unique `(user, clientRequestId)` or equivalent constraint must make retries return the existing attempt instead of creating another order.
3. Do not expose this order to the kitchen/admin actionable queue and do not emit `orderPlaced` yet.
4. Create a Razorpay Order server-side using the SDK/API with:
   - exact `amountPaise`;
   - `currency: "INR"`;
   - `receipt` containing a compact unique local reference (respect Razorpay length limits);
   - `notes` containing non-sensitive local `orderId`, `paymentId`, and environment/store reference;
   - `partial_payment: false`.
5. Persist the returned `order_...` ID and provider status. Return only checkout-safe data: local order/payment IDs, public key ID, Razorpay order ID, integer amount, currency, display name/description, and prefill values.
6. If the Razorpay API call fails, mark the payment failed/retryable and release the coupon reservation. Never leave it looking paid. A retry endpoint may reuse the local order snapshot or create a new idempotent attempt according to the failure type.

The implementation must explicitly handle the narrow failure between the Razorpay API success and the local update. Because the local payment/order already exists and its IDs are in Razorpay notes/receipt, a reconciliation job or support command can find and attach the orphaned provider order. Log this case at error level with correlation IDs.

For cart behavior, choose one consistent policy and test it. Recommended: once the provider order has been persisted, clear the cart in the same local transaction that marks the attempt ready, because the items are safely snapshotted on the pending local order. Provide `Retry payment` and `Cancel pending order` actions on that order so closing the Razorpay modal never destroys the user's recoverable basket. If product requirements demand keeping the cart, block cart mutation during an active attempt and clear only an unchanged cart at finalization; do not silently delete newly added items.

### Browser success verification: `POST /api/v1/payments/razorpay/verify` (authenticated)

Request:

```json
{
  "localOrderId": 42,
  "razorpay_order_id": "order_...",
  "razorpay_payment_id": "pay_...",
  "razorpay_signature": "..."
}
```

Server behavior:

1. Load the local order/payment by authenticated user and lock the payment row.
2. Compare the submitted Razorpay order ID to the one stored locally.
3. Generate HMAC-SHA256 over `stored_provider_order_id + "|" + razorpay_payment_id` using `RAZORPAY_KEY_SECRET` and use a timing-safe comparison. The stored order ID, not a browser-trusted value, is the source for the signature calculation.
4. Fetch the Razorpay payment/order server-to-server (or rely on a verified captured webhook before finalization) and verify provider order association, currency, exact amount, and `captured`/paid state. Signature-valid but merely `authorized` is not fulfillment-ready.
5. Call one shared, idempotent `finalizeCapturedPayment` transaction. It sets the payment to completed, moves the order from `awaiting_payment` to `pending`, consumes the reserved coupon exactly once, and records timestamps/provider IDs. A repeated verify request must return the already-completed result.
6. Emit `orderPlaced` only after that transaction commits. Navigate the customer to the order page and invalidate cart/order queries.

Never log the key secret or full signature. A signature mismatch is a 400/401-style validation failure and must never update the order to paid.

### Webhook: `POST /api/v1/payments/razorpay/webhook` (public URL, signature protected)

- Mount `express.raw({ type: "application/json" })` for this route before global `express.json()`, or use an Express JSON `verify` hook that preserves the exact bytes. Do not recreate the signature from parsed JSON.
- Validate `X-Razorpay-Signature` with HMAC-SHA256 over the raw body and `RAZORPAY_WEBHOOK_SECRET` (this is separate from the API key secret).
- Deduplicate on `x-razorpay-event-id` using the unique webhook-event table.
- Handle at minimum `payment.captured`, `payment.failed`, and `order.paid` as recommended by Razorpay. Optionally record refund events if the schema supports them.
- Look up local state by stored provider order ID/payment ID; verify exact amount, currency, and association before transitioning.
- Use the same `finalizeCapturedPayment` transaction as the browser verification path. Processing must be monotonic and tolerate out-of-order events: a late `authorized` or `failed` event must not downgrade an already completed payment.
- Return 2xx only after the event is durably recorded/handled; return an error for a transient processing failure so Razorpay can retry. Invalid signatures should be rejected.

The browser callback gives fast UX; the webhook is the recovery/source-of-truth path when the browser closes or loses network. Neither path alone is sufficient.

### COD path

Retain `POST /order` as the COD order endpoint or rename it deliberately, but make it use the same quote service. In its database transaction, create/link a `provider: cod`, `status: pending` payment row, snapshot items, consume the coupon once, create the order at fulfillment `pending`, and clear the cart. Emit `orderPlaced` after commit. Deprecate/remove the standalone `/payments/process-cod` endpoint after callers are migrated.

Define how COD becomes paid: preferably an authenticated admin `mark cash collected` operation (often alongside delivery) that changes the payment to `completed`. Do not automatically mark COD paid at creation.

## 6. Frontend changes

### Types and API layer

- Expand `PaymentType` to `"cash" | "razorpay"` in checkout/order models.
- Add provider identifiers/statuses and nullable lifecycle fields to `Payment`.
- Replace the unused COD mutation with typed mutations for initiate, verify, retry/status, and cancel (if implemented).
- Add a `Window.Razorpay` TypeScript declaration and a small loader utility that injects `https://checkout.razorpay.com/v1/checkout.js` once, resolves only after load, and reports load failure. Do not place secrets in Vite variables; the Razorpay key ID is public and can be returned by initiation.

### Checkout UI and orchestration

- Make `PaymentStep` a controlled selector with COD and `Pay online with Razorpay` options; keep accessible radio semantics, focus states, and mobile layout.
- Hold selected payment type in `CheckoutPage` and update button text (`Place COD order` versus `Pay securely`).
- For COD, call the revised server-owned COD creation flow.
- For Razorpay:
  1. generate and retain one `clientRequestId` for the click/retry attempt;
  2. call the initiation endpoint;
  3. load/open Standard Checkout with only the server response values;
  4. prefill name/email/contact from the loaded user and selected address;
  5. in Checkout's handler, send the three returned Razorpay fields to `/verify`;
  6. show a verifying state until the backend confirms; only then show success/navigate;
  7. on `payment.failed`, modal dismissal, script failure, or API error, show a specific recoverable message and retain a route to retry the pending order. Dismissal is not proof of payment failure.
- Prevent double-clicks while initiation/verification is running, but rely on backend idempotency for correctness.
- In order details/admin details, display payment method and application/provider status. For `awaiting_payment`, show customer retry/cancel actions and do not show kitchen progress as if paid.
- On verification success, invalidate cart count/cart checkout/order detail/order lists. Socket updates should arrive only for finalized paid/COD orders.

Razorpay Checkout's displayed amount, currency, and order ID must all come from the initiation response. Browser calculations remain display-only previews.

## 7. Backend file-level work plan

Expected files to change or add:

1. `backend/package.json` / lockfile: add the official `razorpay` Node package and a real test runner if one is introduced.
2. `backend/src/utils/zodSchema.ts`: validate `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET`; add strict initiation/verification schemas and revise COD order input. Do not make live secrets available to frontend code.
3. `backend/src/utils/types.ts`: expand payment/order types and statuses.
4. `backend/src/db/schema/payment.schema.ts`: add provider, money, external IDs, idempotency, state, errors, and lifecycle timestamps.
5. `backend/src/db/schema/order.schema.ts`: expand payment type/order state and add one-to-one uniqueness as chosen.
6. `backend/src/db/schema/_relations.ts`: keep order/payment relations consistent with the chosen FK direction.
7. `backend/src/db/schema/`: add webhook-event and coupon-redemption/reservation schemas and export them from `index.ts`.
8. `backend/migrations/`: generate and inspect the migration. Backfill existing payment rows as `provider = cod`; existing orders with `payment_type = cash` and null payment IDs need an explicit compatibility decision (backfill linked COD payment rows or allow legacy nulls).
9. `backend/src/features/payments/payment.service.ts`: replace the placeholder with initiation, signature verification, provider fetch/reconciliation, monotonic transitions, and shared finalization.
10. `backend/src/features/payments/payment.routes.ts`: add initiate/verify/webhook/status-or-retry endpoints with correct authentication and validation.
11. `backend/src/features/order/order.service.ts`: extract/reuse checkout quote/snapshot logic and make totals server-owned.
12. `backend/src/features/order/order.routes.ts`: revise COD request/response and emit only after a committed actionable order.
13. `backend/src/features/coupon/*`: internalize validation/redemption in the order transaction; remove the frontend's separate redemption responsibility and fix ownership/replay exposure.
14. `backend/src/index.ts` and/or `backend/src/routes.ts`: mount raw webhook parsing before JSON parsing.
15. `backend/src/constants.ts`: retain the INR constant and add tested money conversion helpers in an appropriate utility module.
16. `docs/setup.md`, `docs/api-reference.md`, and `.env.example` if present/added: document configuration, dashboard webhook URL/events, endpoint contracts, test/live separation, and operations.

## 8. Frontend file-level work plan

1. `frontend/src/features/checkout/pages/checkout-page.tsx`: controlled method selection and COD/Razorpay orchestration; stop sending authoritative money and stop separately redeeming coupons.
2. `frontend/src/features/checkout/components/payment-step.tsx`: accessible two-method selector.
3. `frontend/src/features/checkout/components/checkout-summary.tsx`: dynamic CTA and pending/verifying/error UX.
4. `frontend/src/features/checkout/api/payment.mutations.ts`: typed initiate/verify/retry/status calls.
5. `frontend/src/features/checkout/model/checkout.types.ts`: new payment types, provider fields, and endpoint contracts.
6. `frontend/src/features/checkout/`: add the Razorpay script loader and global declaration.
7. `frontend/src/features/orders/model/order.types.ts` and order detail pages: represent `awaiting_payment`, online method/state, and retry/cancel actions.
8. Query keys/invalidation in cart/order APIs: ensure successful finalization refreshes all affected UI.

## 9. API response and error conventions

Keep the existing `{ data, message }` envelope. Define stable, machine-readable error codes in addition to human messages, for example:

- `CHECKOUT_CHANGED` (cart/price/availability changed; refresh quote);
- `STORE_CLOSED` / `ADDRESS_OUTSIDE_ZONE`;
- `COUPON_INVALID` / `COUPON_EXHAUSTED`;
- `PAYMENT_INIT_FAILED`;
- `PAYMENT_SIGNATURE_INVALID`;
- `PAYMENT_NOT_CAPTURED` (verification is pending; poll or await webhook);
- `PAYMENT_AMOUNT_MISMATCH`;
- `PAYMENT_ALREADY_COMPLETED` (normally return the same success resource idempotently).

Include correlation/local payment IDs in logs and support-facing responses, never secrets.

## 10. Testing plan

### Unit tests

- subtotal/discount calculation and rupee-to-paise conversion, including rounding and zero-total behavior;
- coupon percentage/fixed limits, minimum order, expiration, and concurrent last-redemption behavior;
- checkout signature generation/verification with valid, invalid, and mismatched stored order IDs;
- webhook raw-body signature verification;
- monotonic payment-state transitions and amount/currency checks.

### Backend integration tests (mock Razorpay client)

- COD creates and links one payment, uses server totals, consumes a coupon once, and clears the cart atomically.
- A tampered client total is ignored/rejected because it is no longer part of the contract.
- Initiation creates one local order/payment and one provider order; duplicate `clientRequestId` returns the same resources.
- Provider creation failure leaves a recoverable failed local state and no actionable admin order.
- Valid captured verification finalizes once; duplicate verification is harmless.
- Valid signature plus wrong amount/currency/order association does not finalize.
- Invalid signature does not update payment/order/coupon.
- Duplicate and out-of-order webhooks do not duplicate coupon redemption, order emission, or state changes.
- A webhook finalizes successfully when the browser callback never arrives.
- Users cannot verify/read/retry another user's payment.
- Concurrent verify and webhook requests converge on one completed result.

### Frontend tests

- payment selector and dynamic CTA;
- script loader success/failure and no duplicate script tags;
- COD branch, Razorpay initiation branch, success handler, modal dismissal, payment failure, and verify-pending states;
- double-click prevention and stable idempotency key;
- correct query invalidation/navigation only after server confirmation.

### Test-mode end-to-end scenarios

- successful card/UPI payment in Razorpay Test Mode;
- failed payment and retry on the same pending order;
- close modal before paying, then retry from order details;
- browser loses network after provider success, followed by webhook recovery;
- duplicate webhook delivery;
- store/product/coupon changes immediately before initiation;
- restart the backend between initiation and callback, then reconcile;
- confirm paid online orders enter the admin queue once and unpaid ones do not;
- confirm COD still works end to end.

Run backend typecheck/tests plus frontend lint/build before merge. Since there is currently no meaningful backend test command, adding a runner and test database strategy is part of this work, not an optional follow-up.

## 11. Configuration, deployment, and operations

Backend environment variables:

```env
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
```

- Use separate test and live keys/webhook secrets; store production values in the deployment secret manager, not Git.
- Configure the Razorpay dashboard for automatic capture (the proposed phase-1 flow assumes it) and subscribe the public HTTPS webhook URL to `payment.captured`, `payment.failed`, and `order.paid`.
- Ensure the webhook URL bypasses JWT authentication but not signature validation; rate-limit public endpoints without preventing Razorpay retries.
- Add structured metrics/alerts for initiation failures, invalid signatures, amount mismatches, webhook processing failures, stuck `processing/awaiting_payment` rows, and captured provider payments not completed locally.
- Add a scheduled reconciliation job or admin command that queries Razorpay for stale pending payments and repairs state idempotently. This is necessary for saga crash recovery, not merely a nice-to-have.
- Define expiration/cancellation for abandoned `awaiting_payment` orders and release coupon reservations. Razorpay provider orders cannot simply be treated as paid after local expiration; a late capture must enter reconciliation/manual review rather than being ignored.
- Dashboard revenue must include completed online payments and the chosen definition of collected COD, not merely every order row. Review `backend/src/features/dashboard/dashboard.service.ts`, which currently sums order totals by order state/date without payment completion semantics.

Roll out in this order:

1. Deploy additive schema changes and legacy backfill/compatibility code.
2. Deploy backend endpoints with Razorpay Test Mode and webhook disabled from customer UI.
3. Exercise automated and test-mode E2E scenarios, including reconciliation.
4. Deploy the frontend behind a server-side/config feature flag while retaining COD.
5. Enable for internal/staging users, then a small production cohort with live keys.
6. Monitor mismatches/failures/stuck payments, then expand rollout. COD remains an immediate fallback.

## 12. Recommended implementation sequence for AI agents

Each step should leave the repository buildable and should include tests for its new behavior.

1. **Foundation:** add env validation, Razorpay client wrapper/interface, money helper, shared types, and test runner. Keep the provider wrapper injectable so tests never call the real API.
2. **Schema migration:** expand payment/order state, add uniqueness/indexes and webhook idempotency table, update relations, generate migration, and implement legacy-data handling.
3. **Server quote:** extract server-authoritative validation/calculation/coupon logic; migrate COD to it and link a COD payment. Verify COD regression tests before online work.
4. **Initiation saga:** create idempotent pending local order/payment, provider Order call, persistence, cart policy, failures, and retry/status handling.
5. **Verification/finalization:** implement timing-safe checkout signature verification, provider fetch/amount checks, the locked idempotent finalization transaction, and post-commit socket emission.
6. **Webhook/reconciliation:** raw-body route, signature validation, event deduplication/out-of-order behavior, stale-payment reconciliation, and related observability.
7. **Frontend:** types/API hooks, script loader, payment selector, Checkout orchestration, recoverable errors, pending-order retry/cancel, and detail/admin presentation.
8. **Documentation and release:** update setup/API docs, test-mode checklist, live dashboard setup, alerts, feature flag, and rollout/runbook.

Agents should not start by merely adding the Razorpay script and calling Checkout from the browser. The server quote, durable provider order, signature validation, captured-state check, idempotency, and webhook recovery are the security boundary.

## 13. Definition of done

- A user can choose COD or Razorpay and complete either flow.
- No API accepts a browser-authored authoritative amount/discount for order creation.
- Every new order has a linked payment record with clear provider/application state.
- Online orders reach fulfillment `pending` only after an exact-amount INR payment is verified as captured.
- Invalid/tampered/duplicate/out-of-order callbacks and webhooks cannot create duplicate orders, redeem coupons twice, or mark unpaid orders paid.
- Closing the browser/modal or losing network after payment has a documented, tested recovery route.
- Existing COD remains functional and is covered by regression tests.
- Secrets remain server-only, raw webhook signatures are validated, and production has reconciliation/alerting.
- Backend tests/typecheck and frontend lint/build pass, and setup/API/runbook documentation matches the delivered contracts.

## 14. Primary references

- [Razorpay Standard Checkout integration steps](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/): server-created Orders, checkout response fields, mandatory server-side signature verification, and captured-status checks.
- [Razorpay Standard Checkout best practices](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/best-practices/): Orders API, automatic capture, status verification, and recommended webhooks.
- [Razorpay webhook validation and testing](https://razorpay.com/docs/webhooks/validate-test/): raw-body HMAC validation, `x-razorpay-event-id` deduplication, retries, and out-of-order events.
- [Razorpay Node.js server integration](https://razorpay.com/docs/payments/server-integration/nodejs/integration-steps/): official Node integration and verification guidance.
