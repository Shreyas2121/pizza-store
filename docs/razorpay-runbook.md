# Razorpay Operations Runbook

This runbook covers optional Test Mode validation, monitoring, and rollback.
Live payment processing is unsupported; the deterministic simulator is the
default and Cash on Delivery (COD) remains available.

## Audit status (reviewed after branch integration on 2026-09-08)

This runbook includes rollout requirements, not proof of a deployed release.
The historical `15362b5` audit found missing method-discovery and retry routes.
After integrating the financial-overhaul branch, both routes are registered in
`payment.routes.ts`. The retry service still does not recreate inventory
reservations that an earlier terminal failure released, so that recovery gap and
the checklist's deployment-dependent steps must not be claimed complete. See
[case-study evidence](case-study-evidence.md) for the dated baseline,
cancellation matrix, and known limitations.

## Release controls

Payment-attempt persistence uses the caller's transaction and propagates database
constraint failures. It never substitutes a fabricated attempt or writes through
the global database when a supplied transaction is invalid. Unit orchestration
tests stub payment repository boundaries explicitly; they do not contact the
configured database.

Razorpay requires `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and
`RAZORPAY_WEBHOOK_SECRET`. New and retried online checkouts are additionally
controlled by the backend-only `RAZORPAY_ENABLED` flag.

Select the adapter with `PAYMENT_PROVIDER_MODE=simulator` (default) or
`PAYMENT_PROVIDER_MODE=razorpay_test`. The application rejects
`razorpay_live` and `rzp_live_...` key IDs during startup.

- In simulator mode, `RAZORPAY_ENABLED` is ignored and online demo checkout is
  available by default.
- In Razorpay Test Mode, `false` blocks new initiation/retry requests and
  `true` enables them.
- Verification, webhooks, and reconciliation intentionally ignore this flag so
  payments already in flight can settle after a rollback.

Never remove credentials as the first rollback action. Disable the flag and
retain credentials until no unresolved Razorpay payments remain.

## Test Mode release checklist

Use the [Test Mode credentials guide](./razorpay-test-credentials.md) to create
the API key pair and the separate webhook secret before starting this checklist.

1. Apply the database migration and deploy the backend with Test Mode
   credentials and `RAZORPAY_ENABLED=false`.
2. Configure automatic capture and the public HTTPS webhook URL
   `/api/v1/payments/razorpay/webhook`. Subscribe to `payment.captured`,
   `payment.failed`, and `order.paid`.
3. Confirm `GET /api/v1/payments/methods` reports Razorpay disabled and COD
   checkout still succeeds.
4. Set `RAZORPAY_ENABLED=true`, restart the backend, and confirm the endpoint
   reports Razorpay enabled.
5. Exercise success, user-dismissal, provider failure, retry from order details,
   duplicate verification, duplicate webhook delivery, and reconciliation after
   an interrupted callback.
6. Confirm unpaid online orders stay `awaiting_payment`, paid orders move once to
   `pending`, coupons are consumed once, and only finalized orders reach the
   kitchen/admin fulfillment queue.
7. Set the flag back to false and confirm new/retried attempts are blocked while
   a previously completed Checkout callback can still verify.

## Live mode

Do not configure or process live payments. Startup validation rejects both the
`razorpay_live` mode and live Razorpay key IDs. This portfolio intentionally
demonstrates provider boundaries and reconciliation without moving real funds.

## Inventory reservation lifecycle under Razorpay

Online payments separate reservation from consumption. This is application
workflow terminology, not a distributed two-phase commit protocol. Source paths
and test limitations are recorded in the evidence document.

1. **Initiation (`POST /payments/razorpay/orders`)**:
   - Creates `inventory_reservations` rows for tracked stock in `reserved` status with a default 30-minute deadline.
   - Does **not** decrement `on_hand_quantity`.
   - Decreases displayed tracked availability, `max(0, on_hand_quantity - active_reserved_quantity)`; untracked availability is `null`.
   - Emits `"lowStock"` alert only if `available_quantity` drops past threshold.

2. **Capture (`POST /payments/razorpay/verify` or Webhook `payment.captured`)**:
   - Acquires deterministic row locks on store products (ascending ID) and then reservations.
   - Marks reservations `consumed`.
   - Decrements `on_hand_quantity` and appends `sale` movements with idempotent key `sale:{orderId}:{storeProductId}`.
   - No duplicate low-stock alerts are emitted (available quantity remains constant).

3. **Provider failure / authorized order cancellation**:
   - Releases active reservations, making their stock available again.
   - Closing the browser payment modal alone does not release reservations.
   - Status cancellation does not issue a provider refund or reverse consumed
     promotion applications. Paid-order cancellation restores recorded tracked stock
     while leaving the completed payment unchanged.

4. **Expiry Reconciliation (`pnpm run inventory:reconcile-reservations`)**:
   - Scans expired active reservations (`status = 'reserved' AND expires_at < now()`).
   - Verifies the provider payment status with Razorpay outside database transactions.
   - Preserves reservations on provider/configuration errors, ambiguous paid or
     authorized states, and processing payments without an attached provider order.
   - When provider state permits expiry and the local order is still awaiting
     payment, cancels that order and releases stock/coupon reservations.
   - Confirmed captured/paid state follows normal finalization and exact amount
     checks. A deadline alone does not prevent consumption of still-reserved rows.
   - Capture after release/cancellation conflicts; it does not automatically
     reallocate stock or refund payment. Escalate for operational resolution.

`pnpm run payments:reconcile` is a different one-shot command: it scans stale
processing/failed payments and can recover unattached provider orders by receipt.
It does not run the inventory expiry scan. Neither command is scheduled by
`backend/src/index.ts`, and no hosting scheduler was established by this audit.

CLI reconciliation does not emit realtime notifications. Some HTTP/webhook
finalization responses also lack store/user context needed by audience selection;
verify delivery separately rather than assuming a successful reconciliation
means the store received an event.

## Monitoring and alerts

Aggregate the structured payment logs and alert on these starting thresholds;
tune them after observing normal production traffic.

| Signal | Starting alert | Response |
| --- | --- | --- |
| `Razorpay order creation failed` | 5 in 5 minutes or >5% of attempts | Disable new Checkout, check provider/API health |
| `Razorpay webhook processing failed` | Any sustained for 5 minutes | Inspect signature/config and provider delivery logs |
| Reconciliation command non-zero | Any run | Inspect returned per-payment errors and rerun safely |
| `awaiting_payment` older than 15 minutes | More than 5 or rising for 10 minutes | Reconcile, then compare local/provider state |
| Failed webhook event | Any older than 5 minutes | Fix the cause; provider retry or a later event can reclaim it |
| Amount/order/currency mismatch log | Any | Treat as high severity; stop new Checkout and investigate |

Useful read-only PostgreSQL checks:

```sql
SELECT p.id, o.id AS order_id, p.status, p.provider_status,
       p.provider_order_id, p.failure_code, p.updated_at
FROM payments p
JOIN orders o ON o.payment_id = p.id
WHERE p.provider = 'razorpay'
  AND o.status = 'awaiting_payment'
  AND p.updated_at < now() - interval '15 minutes'
ORDER BY p.updated_at;
```

```sql
SELECT event_id, event_type, status, attempts, last_error, updated_at
FROM payment_webhook_events
WHERE status <> 'processed'
ORDER BY updated_at;
```

Do not manually mark a payment completed or an order pending. Use reconciliation,
which re-fetches Razorpay and validates association, currency, and exact amount.

### Diagnostic correlation

Start with the local order and payment IDs. The deterministic receipt connects
those records to provider-order recovery; provider order/payment IDs connect the
local attempt to Razorpay; webhook event ID/type connect delivery attempts to
`payment_webhook_events`. Persisted provider status and failure code/description
add the last recorded observation.

Payment and webhook logs include the applicable identifiers as structured
metadata. Winston writes console output and dated local `error.log` and
`combined.log` files. Reconciliation commands print count and per-item JSON, so
retain their complete output and inspect reservation `conflicts` as well as
`errors`.

The reviewed source has no generated request correlation ID, centralized log
sink, retention policy, or trace spanning browser, API, Razorpay, and Socket.IO.
Local log-file durability and aggregation depend on the hosting arrangement,
which is not included in this repository.

## Incident rollback

1. Set `RAZORPAY_ENABLED=false` and restart/redeploy the backend. Confirm
   `GET /api/v1/payments/methods` returns `razorpay: false`.
2. Keep COD operating and keep Razorpay credentials/webhook delivery active.
3. Run reconciliation until all captured in-flight payments finalize and review
   every remaining stale attempt against the Razorpay Dashboard.
4. Resolve refunds/customer communication through the normal operations process;
   do not mutate payment rows directly.
5. Re-enable only after the root cause is fixed and the Test Mode checklist passes.

## Key rotation

Disable new Checkout, rotate the API key pair and webhook secret in the backend
and Razorpay Dashboard as one coordinated change, then restart. Expect events
signed with a mismatched webhook secret to fail; monitor delivery and retain the
old secret only for the shortest supported overlap. Re-run the Test Mode checklist
before restoring the flag.
