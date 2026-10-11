export const reviewedRevision = "379ae802767eb8507407bb5c999855de361a59f6";
export const reviewedDate = "2026-10-10";

// The review includes working-tree changes; published source links resolve repository HEAD.
// Public subset of docs/case-study-evidence.md. Update both when behavior changes.
export const evidence = {
  "ARCH-01": {
    title: "Application boundaries",
    source: "backend/src/index.ts",
    symbol: "Express / HTTP server / Socket.IO initialization",
    scope: "Source review of logical application boundaries; no deployed topology or load measurements established.",
  },
  "ARCH-02": {
    title: "Frontend routing and state",
    source: "frontend/src/app/router/routes.tsx",
    symbol: "AppRoutes; feature lazy imports",
    scope: "Current routing and source organization; frontend tests and build pass. Direct browser and hosted refresh behavior were not checked in this audit.",
  },
  "ORDER-01": {
    title: "Transactional COD checkout",
    source: "backend/src/features/order/order.service.ts",
    symbol: "OrderService.createOrder",
    test: "backend/src/features/order/order.service.test.ts",
    scope: "Source review and mocked service tests; not a live concurrency test.",
  },
  "ORDER-02": {
    title: "Order transitions and cancellation",
    source: "backend/src/features/order/order.logic.ts",
    symbol: "VALID_ORDER_TRANSITIONS; OrderService.updateOrderStatus applies this map",
    test: "backend/src/features/order/order.service.test.ts",
    scope: "Transition rules and mocked status/cancellation tests. Inventory and promotion release share the caller transaction; cancellation and refund remain separate operations. No PostgreSQL race evidence is claimed.",
  },
  "ORDER-03": {
    title: "Price snapshot boundaries",
    source: "backend/src/features/order/order.mapper.ts",
    symbol: "toOrderResponse / ORDER_SNAPSHOT_RELATIONS",
    test: "backend/src/features/order/order.mapper.test.ts",

    scope: "Source and regression tests: saved product, customization, promotion and bundle names/prices preserve history. Images and the delivery address remain references. No live browser/database race is claimed.",
  },
  "PAY-01": {
    title: "Online initiation boundaries",
    source: "backend/src/features/payments/payment.service.ts",
    symbol: "findOrCreateLocalAttempt / claimProviderOrderCreation / ensureProviderOrder",
    test: "backend/src/features/payments/payment.service.inventory.test.ts",
    scope: "Source and passing mocked initiation tests establish separate local/provider steps. They do not exercise an external provider or coordinated SQL race.",
  },
  "PAY-02": {
    title: "Local request and provider identity",
    source: "backend/src/db/schema/payment.schema.ts",
    symbol: "paymentsTable: clientRequestId / providerOrderId / providerPaymentId",
    scope: "Schema and service review, not an executed constraint or provider-side exactly-once test.",
  },
  "PAY-03": {
    title: "Verification before finalization",
    source: "backend/src/features/payments/payment-verification.service.ts",
    symbol: "verifyRazorpayPayment / reconcileProviderPayment; provider/local state validation",
    scope: "Source review of ownership, checkout signature, and provider identity/amount/state checks. No end-to-end provider test established.",
  },
  "PAY-04": {
    title: "Capture and repeated completion",
    source: "backend/src/features/payments/payment-finalization.service.ts",
    symbol: "finalizeCapturedPayment",
    test: "backend/src/features/payments/payment.service.inventory.test.ts",
    scope: "Passing mocked finalization tests inspect capture and same-payment replay. Saved stock and promotion holds restore before consumption; shortages/cancelled orders conflict. No live callback/webhook race test.",
  },
  "PAY-05": {
    title: "Webhook claims and duplicate events",
    source: "backend/src/features/payments/razorpay.webhook.ts",
    symbol: "handle / claimEvent / isValidSignature",
    scope: "Source review: raw-body signature, unique event claims, stale processing window, and separate processed marking. No webhook lifecycle integration test established.",
  },
  "PAY-06": {
    title: "Mounted retry and saved-price recovery",
    source: "backend/src/features/payments/payment.service.ts",
    symbol: "retryRazorpayOrder / reactivateProviderOrder",
    scope: "Method discovery and owned retry routes are mounted. Retry restores saved inventory demand and promotion capacity together without repricing; stock/capacity shortages reject recovery. No current browser/provider retry session.",
      test: "backend/src/features/payments/payment-promotions.service.test.ts",
  },
  "REC-01": {
    title: "Reservation expiry policy",
    source: "backend/src/features/payments/payment-reconciliation.service.ts",
    symbol: "reconcileExpiredReservations",
    test: "backend/src/features/payments/payment.service.inventory.test.ts",
    scope: "Passing mocked tests cover release and preservation on uncertainty. Expiry includes payment-attempt deadlines for orders without tracked stock. No deployed schedule or live expiry/capture race.",
  },
  "REC-02": {
    title: "Stale payment recovery",
    source: "backend/src/features/payments/payment-stale-recovery.service.ts",
    symbol: "reconcileStalePayments; provider-order receipt recovery",
    scope: "Receipt recovery verifies saved identity/amount and preserves payment state. Retry/capture restoration is separate; provider-side exactly-once creation is not established.",
  },
  "REC-03": {
    title: "Reconciliation execution and scheduling",
    source: "backend/package.json",
    symbol: "payments:reconcile / inventory:reconcile-reservations scripts",
    scope: "Bounded one-shot payment/reservation commands exit non-zero on reported errors; inspect conflicts separately. Optional maintenance timers run while the backend is awake; this audit did not invoke operational commands against the configured database.",
  },
  "RT-02": {
    title: "Post-commit delivery limits",
    source: "backend/src/features/payments/payment.routes.ts",
    symbol: "Verification/reconciliation event audiences",
    scope: "Source tracing: some finalization results omit audience context; webhook/admin reconciliation can fall back to platform admins. CLI reconciliation emits no socket events.",
  },
  "INV-01": {
    title: "Inventory meaning and arithmetic",
    source: "backend/src/features/inventory/inventory.logic.ts",
    symbol: "aggregateCartDemand / getAvailableQuantity / validateStockDemand",
    test: "backend/src/features/inventory/inventory.logic.test.ts",
    scope: "Pure tests cover base-product demand aggregation, tracked/untracked availability, clamping, and insufficient-stock results. They do not prove stored database consistency.",
  },
  "INV-02": {
    title: "Ordered stock allocation",
    source: "backend/src/features/inventory/inventory.service.ts",
    symbol: "lockStoreProducts / validateAndLockStock",
    test: "backend/src/features/inventory/inventory.service.test.ts",
    scope: "Tests inspect query orchestration; database lock contention is not verified.",
  },
  "INV-03": {
    title: "Reservation lifecycle",
    source: "backend/src/features/inventory/inventory.service.ts",
    symbol: "reserveStockForOrder / consumeReservationsForOrder / releaseReservations",
    test: "backend/src/features/inventory/inventory-retry.service.test.ts",
    scope: "Passing pure/mocked tests cover saved-demand reservation restoration, consumption and released holds. Verified late capture can restore a still-payable order when stock remains available; cancelled orders cannot revive. No live race.",
  },
  "INV-04": {
    title: "Cross-path lock-order limits",
    source: "backend/src/features/inventory/inventory.service.ts",
    symbol: "validateAndLockStock / consumeReservationsForOrder / restoreStockForOrder",
    scope: "Source review finds several ascending stock-lock helpers but different owning-row and reservation sequences across paths. This is not evidence of global deadlock freedom.",
  },
  "INV-05": {
    title: "Inventory movement invariant",
    source: "backend/src/db/schema/inventory.schema.ts",
    symbol: "inventoryMovementsTable checks and unique idempotency key",
    test: "backend/src/features/inventory/inventory.service.test.ts",
    scope: "Schema and mocked service tests verify movement policy; the isolated recruiter seed also checks inventory history totals. Maintenance clearing can truncate history. No coordinated stock-write race test.",
  },
  "INV-06": {
    title: "Staff restock and adjustment",
    source: "backend/src/features/inventory/inventory.service.ts",
    symbol: "restockProduct / bulkRestockProducts / adjustProduct",
    test: "backend/src/features/inventory/inventory.service.test.ts",
    scope: "Mocked tests cover transactional authorization, audit rollback, and bulk preparation; pure adjustment guards are covered separately. No live admin-versus-checkout race test was run.",
  },
  "ACCESS-02": {
    title: "Store-scoped permissions",
    source: "backend/src/features/access/access.permissions.ts",
    symbol: "STORE_ROLE_PERMISSIONS",
    test: "backend/src/features/access/access.logic.test.ts",
    scope: "Policy tests establish allowed roles; live two-store isolation remains unverified.",
  },
  "ACCESS-03": {
    title: "Staff lifecycle safeguards",
    source: "backend/src/features/staff/staff.service.ts",
    symbol: "Membership mutations / final-manager guard / invitation lifecycle",
    test: "backend/src/features/staff/staff.service.test.ts",
    scope: "Injected repository, audit, delivery, clock, and notifier tests; no live transaction or database-constraint test.",
  },
  "ACCESS-04": {
    title: "Invitation delivery and socket revocation limits",
    source: "backend/src/features/staff/staff.realtime.ts",
    symbol: "SocketIoStaffAccessNotifier / evictUserSockets",
    scope: "Membership changes can disconnect sockets visible to the local Socket.IO adapter. Production invitation delivery and cross-process revocation are not established.",
  },
  "RT-01": {
    title: "Authenticated realtime rooms",
    source: "backend/src/features/realtime/realtime-rooms.ts",
    symbol: "deriveRoomsForPrincipal / syncSocketRooms",
    test: "backend/src/features/realtime/realtime-rooms.test.ts",
    scope: "Pure room mapping and mocked socket/auth tests; not actual transport, delivery, reconnect, or multi-process evidence.",
  },
  "TEST-01": {
    title: "Audited check baseline and test categories",
    source: "docs/case-study-verification.md",

    symbol: "Executed checks / Evidence limits",
    scope: "2026-10-10 working-tree audit: 951 backend and 245 frontend tests passed; both typechecks and production builds passed. Lint has zero errors and existing warnings. Isolated PGlite evidence does not establish full migration-chain or concurrency behavior.",
  },
  "OPS-01": {
    title: "Operational diagnostic identifiers",
    source: "backend/src/utils/request-context.ts",
    symbol: "requestContextMiddleware / currentRequestId; safe audits, local Winston logs and protected metrics",
    scope: "A valid caller UUID is retained or X-Request-ID is generated. Safe mutation/attempt audits and protected finance metrics are implemented; centralized log/trace/retention infrastructure is not supplied.",
  },
} as const;

export type EvidenceId = keyof typeof evidence;

// Optional public configuration. Never manufacture a repository URL.
const configuredRepository = import.meta.env.VITE_DOCS_REPOSITORY_URL?.trim();
export const repositoryUrl = configuredRepository &&
  /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/.test(configuredRepository)
  ? configuredRepository.replace(/\/$/, "").replace(/\.git$/, "")
  : null;

export const sourceUrl = (path: string, revision = "HEAD") => repositoryUrl
  ? `${repositoryUrl}/blob/${revision}/${path}`
  : null;
