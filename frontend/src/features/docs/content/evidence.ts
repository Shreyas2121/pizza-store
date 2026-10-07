export const reviewedRevision = "15362b5a3500d4ea596e66bd2e9e519a418ed650";
export const reviewedDate = "2026-09-05";

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
    scope: "Reviewed source organization, not browser or bundle verification. Docs routes were added after this evidence revision.",
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
    scope: "Transition rules and mocked status/cancellation tests. Stock restoration, coupon release, and payment changes remain separate service operations.",
  },
  "ORDER-03": {
    title: "Price snapshot boundaries",
    source: "backend/src/features/order/order.mapper.ts",
    symbol: "toOrderResponse / ORDER_SNAPSHOT_RELATIONS",
    test: "backend/src/features/order/order.mapper.test.ts",
    revision: "245e748",
    scope: "C10 source and database-free regression tests: historical product, customization, promotion and bundle names/prices come from saved snapshots. Allocations and released applications remain visible. Product images and the delivery address remain references. No live database or browser evidence is claimed.",
  },
  "PAY-01": {
    title: "Online initiation boundaries",
    source: "backend/src/features/payments/payment.service.ts",
    symbol: "findOrCreateLocalAttempt / claimProviderOrderCreation / ensureProviderOrder",
    test: "backend/src/features/payments/payment.service.inventory.test.ts",
    scope: "Source evidence for separate local/provider steps. The initiation test failed before assertions in C01 due to an unmocked database lookup.",
  },
  "PAY-02": {
    title: "Local request and provider identity",
    source: "backend/src/db/schema/payment.schema.ts",
    symbol: "paymentsTable: clientRequestId / providerOrderId / providerPaymentId",
    scope: "Schema and service review, not an executed constraint or provider-side exactly-once test.",
  },
  "PAY-03": {
    title: "Verification before finalization",
    source: "backend/src/features/payments/payment-reconciliation.service.ts",
    symbol: "verifyRazorpayPayment / reconcileProviderPayment / assertProviderStateMatches",
    scope: "Source review of ownership, checkout signature, and provider identity/amount/state checks. No end-to-end provider test established.",
  },
  "PAY-04": {
    title: "Capture and repeated completion",
    source: "backend/src/features/payments/payment-reconciliation.service.ts",
    symbol: "finalizeCapturedPayment",
    test: "backend/src/features/payments/payment.service.inventory.test.ts",
    scope: "Mocked transaction tests inspect capture, same-payment replay, and released-reservation rejection; not a live callback/webhook race test.",
  },
  "PAY-05": {
    title: "Webhook claims and duplicate events",
    source: "backend/src/features/payments/razorpay.webhook.ts",
    symbol: "handle / claimEvent / isValidSignature",
    scope: "Source review: raw-body signature, unique event claims, stale processing window, and separate processed marking. No webhook lifecycle integration test established.",
  },
  "PAY-06": {
    title: "Retry and route limitations",
    source: "backend/src/features/payments/payment.service.ts",
    symbol: "retryRazorpayOrder / reactivateProviderOrder",
    scope: "Service retry does not recreate released stock reservations. Method-discovery and retry routes are absent in the audited router; financial rework requires re-review.",
  },
  "REC-01": {
    title: "Reservation expiry policy",
    source: "backend/src/features/payments/payment-reconciliation.service.ts",
    symbol: "reconcileExpiredReservations",
    test: "backend/src/features/payments/payment.service.inventory.test.ts",
    scope: "Mocked tests cover release and preservation on provider/configuration uncertainty. No deployed schedule or live expiry/capture race test established.",
  },
  "REC-02": {
    title: "Stale payment recovery",
    source: "backend/src/features/payments/payment-reconciliation.service.ts",
    symbol: "reconcileStalePayments / attachRecoveredProviderOrder",
    scope: "Source review of receipt-based recovery and provider re-fetch; not proof that stock was re-reserved or every provider failure recovers automatically.",
  },
  "REC-03": {
    title: "Reconciliation execution and scheduling",
    source: "backend/package.json",
    symbol: "payments:reconcile / inventory:reconcile-reservations scripts",
    scope: "Two bounded one-shot commands exist and exit non-zero only on reported errors. No scheduler/hosting manifest or startup scheduling was found; neither command was executed by the audit.",
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
    test: "backend/src/features/payments/payment.service.inventory.test.ts",
    scope: "Source and mocked service tests cover reservation creation, consumption, release, and repeated completion. A deadline does not itself change reservation status, and no live race is established.",
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
    scope: "Schema and mocked service review; constraints were not applied to a disposable database in this audit. Maintenance clearing can truncate the movement history.",
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
    source: "docs/case-study-evidence.md",
    revision: "fe1f273d62e86da08490d71e8bb8365282c2b176",
    symbol: "Test baseline / Test classification and missing proof",
    scope: "Dated C01 execution: frontend lint and backend typecheck/build passed; frontend build and one backend test failed for recorded environment/isolation reasons. C07 did not rerun these checks.",
  },
  "OPS-01": {
    title: "Operational diagnostic identifiers",
    source: "backend/src/utils/logger.ts",
    symbol: "Winston transports; payment/webhook structured metadata; reconciliation JSON",
    scope: "Source review finds local/provider/payment/event identifiers and dated local log files. No generated request correlation ID, centralized sink, retention policy, or end-to-end trace was established.",
  },
} as const;

export type EvidenceId = keyof typeof evidence;

// Optional public configuration. Never manufacture a repository URL.
const configuredRepository = import.meta.env.VITE_DOCS_REPOSITORY_URL?.trim();
export const repositoryUrl = configuredRepository &&
  /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/.test(configuredRepository)
  ? configuredRepository.replace(/\/$/, "").replace(/\.git$/, "")
  : null;

export const sourceUrl = (path: string, revision = reviewedRevision) => repositoryUrl
  ? `${repositoryUrl}/blob/${revision}/${path}`
  : null;
