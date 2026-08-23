# Razorpay Operations Runbook

This runbook covers Test Mode validation, production rollout, monitoring, and
rollback. Cash on Delivery (COD) is always the customer fallback.

## Release controls

Razorpay requires `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and
`RAZORPAY_WEBHOOK_SECRET`. New and retried online checkouts are additionally
controlled by the backend-only `RAZORPAY_ENABLED` flag.

- `false` (default): the frontend offers COD only and the backend rejects new
  initiation/retry requests.
- `true`: Razorpay appears in checkout and initiation/retry is accepted.
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
5. Run `pnpm payments:reconcile` from `backend/` every five minutes. The command
   exits non-zero when any candidate fails and should page the on-call operator.

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
