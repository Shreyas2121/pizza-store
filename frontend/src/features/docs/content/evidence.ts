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
    source: "backend/src/features/checkout/checkout.service.ts",
    symbol: "createOrderSnapshot / releaseCouponReservation",
    scope: "Source review: item/customization prices are copied; product identities and address remain references. Only reserved coupon uses are released.",
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
  "RT-02": {
    title: "Post-commit delivery limits",
    source: "backend/src/features/payments/payment.routes.ts",
    symbol: "Verification/reconciliation event audiences",
    scope: "Source tracing: some finalization results omit audience context; webhook/admin reconciliation can fall back to platform admins. CLI reconciliation emits no socket events.",
  },
  "INV-02": {
    title: "Ordered stock allocation",
    source: "backend/src/features/inventory/inventory.service.ts",
    symbol: "lockStoreProducts / validateAndLockStock",
    test: "backend/src/features/inventory/inventory.service.test.ts",
    scope: "Tests inspect query orchestration; database lock contention is not verified.",
  },
  "ACCESS-02": {
    title: "Store-scoped permissions",
    source: "backend/src/features/access/access.permissions.ts",
    symbol: "STORE_ROLE_PERMISSIONS",
    test: "backend/src/features/access/access.logic.test.ts",
    scope: "Policy tests establish allowed roles; live two-store isolation remains unverified.",
  },
} as const;

export type EvidenceId = keyof typeof evidence;

// Optional public configuration. Never manufacture a repository URL.
const configuredRepository = import.meta.env.VITE_DOCS_REPOSITORY_URL?.trim();
export const repositoryUrl = configuredRepository &&
  /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/.test(configuredRepository)
  ? configuredRepository.replace(/\/$/, "").replace(/\.git$/, "")
  : null;

export const sourceUrl = (path: string) => repositoryUrl
  ? `${repositoryUrl}/blob/${reviewedRevision}/${path}`
  : null;
