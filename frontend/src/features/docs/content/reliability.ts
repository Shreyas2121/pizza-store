import type { EvidenceId } from "./evidence";

export const testCategories = [
  {
    category: "Pure logic",
    status: "Present",
    establishes: "Inventory arithmetic and demand, order transitions, access policy, request schemas, and seed argument parsing for supplied inputs.",
    limit: "No SQL locking, transaction rollback, HTTP middleware, browser behavior, or provider behavior is exercised.",
  },
  {
    category: "Mocked service orchestration",
    status: "Present",
    establishes: "Expected repository calls, transaction callback composition, inventory/payment flows, authorization, audit propagation, and socket-room helpers.",
    limit: "Mocks do not establish PostgreSQL isolation, applied constraints, real transport delivery, or a provider race.",
  },
  {
    category: "Disposable database integration",
    status: "Missing",
    establishes: "No dedicated suite was found. One payment test accidentally reached the configured database and failed before its intended assertions.",
    limit: "That accidental query is a test-isolation defect, not evidence of concurrency correctness or rollback behavior.",
  },
  {
    category: "Browser flows",
    status: "Missing",
    establishes: "No browser harness or completed manual session was recorded for the audited baseline or documentation routes.",
    limit: "Routing, focus, responsive behavior, provider Checkout, sockets, and hosted refresh behavior remain unverified at runtime.",
  },
] as const;

export const failureRows: readonly {
  scenario: string;
  currentBehavior: string;
  evidence: readonly EvidenceId[];
  operationalAction: string;
  limit: string;
}[] = [
  {
    scenario: "Provider order creation is interrupted",
    currentBehavior: "Local attempt exists first. The error path marks payment failed and releases holds; receipt-based reconciliation can find an unattached provider order.",
    evidence: ["PAY-01", "REC-02"],
    operationalAction: "Inspect local order/payment IDs and the deterministic receipt, then run stale-payment reconciliation against the intended environment.",
    limit: "Released inventory is not recreated by retry, and a provider success cannot be rolled back by SQL.",
  },
  {
    scenario: "Callback or webhook repeats",
    currentBehavior: "Webhook event claims suppress processed duplicates; the locked finalizer returns without another deduction for the same completed payment ID.",
    evidence: ["PAY-04", "PAY-05"],
    operationalAction: "Correlate event, provider order/payment, and local payment IDs; investigate mismatched IDs instead of forcing completion.",
    limit: "Event claim, payment commit, processed marking, and notification are separate boundaries. This is not end-to-end exactly-once delivery.",
  },
  {
    scenario: "Reservation expires while provider state is uncertain",
    currentBehavior: "Expiry reconciliation preserves the hold on missing configuration, provider fetch errors, or unsafe/ambiguous paid state.",
    evidence: ["REC-01", "REC-03"],
    operationalAction: "Restore provider access, rerun the one-shot command, and inspect both conflicts and errors in its JSON result.",
    limit: "The 30-minute deadline does not schedule execution or release a row by itself.",
  },
  {
    scenario: "Capture appears after reservation release",
    currentBehavior: "Finalization conflicts on released reservations, or rejects an order already cancelled by expiry.",
    evidence: ["INV-03", "REC-01"],
    operationalAction: "Compare provider and local state, protect fulfillment from the unresolved order, and resolve customer/refund handling operationally.",
    limit: "No automatic stock reacquisition, order revival, or provider refund exists in the reviewed path.",
  },
  {
    scenario: "A paid order is cancelled",
    currentBehavior: "Recorded tracked stock is restored once, while the completed payment and consumed coupon use remain completed/consumed.",
    evidence: ["ORDER-02"],
    operationalAction: "Review payment and coupon records and perform any refund/customer communication through a separate operations process.",
    limit: "Order cancellation is not a refund workflow.",
  },
  {
    scenario: "Process stops after commit and before realtime emit",
    currentBehavior: "The database change remains committed. Route-level Socket.IO delivery can be skipped, and CLI reconciliation emits no replacement event.",
    evidence: ["RT-02"],
    operationalAction: "Treat the database as source of truth and refresh affected order/inventory views; inspect logs for the committed operation and missing delivery.",
    limit: "No outbox, durable event log, or notification replay was found.",
  },
  {
    scenario: "Membership changes while sockets are connected",
    currentBehavior: "The current process disconnects sockets in the user's room so reconnect derives rooms from current membership.",
    evidence: ["ACCESS-04", "RT-01"],
    operationalAction: "Confirm reconnection and current room assignment on the serving instance after role or membership changes.",
    limit: "The adapter lookup is process-local; cross-process eviction is not established.",
  },
];

export const improvementPriorities = [
  {
    priority: "P0",
    title: "Finish and verify online-payment recovery",
    trigger: "Before enabling Razorpay for real customers or claiming the browser flow is complete.",
    change: "Register and test method-discovery/retry behavior, make retry inventory-aware, and define late-capture and refund operations.",
  },
  {
    priority: "P0",
    title: "Schedule reconciliation with alerts",
    trigger: "Before reservation deadlines or stale-payment recovery become an operational promise.",
    change: "Run both one-shot commands from identified infrastructure, alert on errors and reservation conflicts, and record ownership/run history.",
  },
  {
    priority: "P1",
    title: "Add disposable-database transaction tests",
    trigger: "Before strengthening concurrency claims or changing checkout, capture, cancellation, or staff lock paths.",
    change: "Coordinate independent connections without sleeps and assert final stock, reservation, movement, and order state.",
  },
  {
    priority: "P1",
    title: "Make post-commit delivery recoverable",
    trigger: "When realtime events become operationally required or a missed notification is observed.",
    change: "Evaluate an outbox or a database-backed polling/replay mechanism with idempotent consumers and measured delivery objectives.",
  },
  {
    priority: "P1",
    title: "Make socket revocation multi-instance aware",
    trigger: "Before running more than one Socket.IO application instance.",
    change: "Use a shared adapter and a distributed invalidation path, then verify membership removal across instances.",
  },
  {
    priority: "P2",
    title: "Make release builds reproducible",
    trigger: "Before the final release verification or CI publication gate.",
    change: "Synchronize installed frontend dependencies with the committed lockfile and require lint, typecheck, tests, and production build in a clean environment.",
  },
] as const;
