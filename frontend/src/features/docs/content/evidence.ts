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
