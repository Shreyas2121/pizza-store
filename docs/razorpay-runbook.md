# Razorpay Operations Runbook

This runbook covers Test Mode validation, production rollout, monitoring, and
rollback. Cash on Delivery (COD) is always the customer fallback.

## Audit status (2026-09-05)

This runbook includes rollout requirements, not proof of a deployed release.
At reviewed revision `15362b5`, the frontend calls `GET /payments/methods` and
`POST /payments/razorpay/orders/:localOrderId/retry`, but those routes are not
registered in `payment.routes.ts`. The retry service exists but does not recreate
released inventory reservations. Checklist steps involving these endpoints are
release requirements that cannot be claimed complete from current route wiring.

Financial changes are being developed on another branch; recheck the route and
recovery behavior after integration. See [case-study evidence](case-study-evidence.md)
for the current baseline, cancellation matrix, and known limitations.

## Release controls

Razorpay requires `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and
`RAZORPAY_WEBHOOK_SECRET`. New and retried online checkouts are additionally
controlled by the backend-only `RAZORPAY_ENABLED` flag.

- `false` (default): the initiation/retry service rejects new attempts.
- `true`: initiation/retry is allowed by the service when credentials are present.
- Frontend method discovery and HTTP retry wiring must be verified separately;
  their missing routes at the audited revision are noted above.
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

## Live rollout

1. Create separate Live Mode keys and webhook secret; never reuse Test Mode
   values. Verify the account uses automatic capture.
2. Deploy credentials with `RAZORPAY_ENABLED=false`, register the live webhook,
   and verify webhook delivery from the Razorpay Dashboard.
3. Enable the flag for a staffed, low-traffic window. Confirm a small real
   transaction end to end, including the order, payment, webhook event, and
   kitchen notification.
4. Keep COD visible throughout rollout. Expand traffic only after the monitoring
   signals below remain healthy.
5. Configure external scheduling for `pnpm run payments:reconcile` and
   `pnpm run inventory:reconcile-reservations` from `backend/`. A five-minute
   cadence is a proposed starting point, not a scheduler included in this repo.
   Commands exit non-zero on reported errors; a failed payment outcome alone
   does not necessarily cause a non-zero exit. Reservation conflicts also need
   inspection because they are not included in that command's error exit test.

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
     coupon redemptions. Paid-order cancellation restores recorded tracked stock
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
