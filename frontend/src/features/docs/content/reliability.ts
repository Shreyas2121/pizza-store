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
    status: "Present",
    establishes: "The recruiter-seed PGlite test derives current tables and applies the real posting-kernel triggers, checking constraints, rollback, balances, attachments and repeat-run safety.",
    limit: "It does not apply the full migration chain or coordinate independent server PostgreSQL connections. Checkout/capture/cancellation races remain unverified.",
  },
  {
    category: "Browser flows",
    status: "Missing",
    establishes: "This audit did not run a browser or provider session for the current working tree.",
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
    limit: "Retry restores saved inventory and promotion capacity transactionally when available. SQL cannot roll back an external provider success.",
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
    currentBehavior: "Verified capture can restore released inventory and promotion applications under saved prices. A cancelled order or unavailable stock requires operational resolution.",
    evidence: ["INV-03", "REC-01"],
    operationalAction: "Compare provider and local state, protect fulfillment from the unresolved order, and resolve customer/refund handling operationally.",
    limit: "Only verified captured money can bypass current promotion capacity. Inventory availability remains enforced; a cancelled order is not revived automatically.",
  },
  {
    scenario: "A paid order is cancelled",
    currentBehavior: "Recorded tracked stock is restored once, while completed payment and consumed promotion applications remain completed/consumed.",
    evidence: ["ORDER-02"],
    operationalAction: "Review saved payment/promotion records and use the separate authorized refund workflow when needed.",
    limit: "Order cancellation is not a refund workflow.",
  },
  {
    scenario: "Process stops after commit and before realtime emit",
    currentBehavior: "The database change remains committed. Route-level Socket.IO delivery can be skipped, and CLI reconciliation emits no replacement event.",
    evidence: ["RT-02"],
    operationalAction: "Treat the database as source of truth and refresh affected order/inventory views; inspect logs for the committed operation and missing delivery.",
    limit: "A financial outbox exists for durable ledger posting; it does not guarantee replay of every route-level realtime notification.",
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
    title: "Verify online-payment recovery in the target environment",
    trigger: "Before publishing a validated external Test Mode walkthrough or claiming the browser flow is complete.",
    change: "Execute the implemented method discovery, inventory/promotion retry, late capture and refund paths against an isolated database and provider/browser setup, recording results.",
  },
  {
    priority: "P0",
    title: "Schedule reconciliation with alerts",
    trigger: "Before reservation deadlines or stale-payment recovery become an operational promise.",
    change: "Run both one-shot commands from identified infrastructure, alert on errors and reservation conflicts, and record ownership/run history.",
  },
  {
    priority: "P1",
    title: "Add coordinated PostgreSQL transaction tests",
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
    title: "Repeat checks on a clean release checkout",
    trigger: "Before the final release verification or CI publication gate.",
    change: "The current workspace checks pass. Reinstall with the frozen lockfile and rerun lint, typecheck, tests and build on a clean release checkout.",
  },
] as const;
