# PizzaStore Authorization and Access-Control Audit

> **Audit date:** 2026-09-09  
> **Scope:** Static review of backend authentication/authorization, store-scoped RBAC, sensitive finance/payroll workflows, realtime authorization, and frontend access controls  
> **Revision reviewed:** Current workspace snapshot  
> **Limitations:** No deployed ingress, reverse-proxy, browser security headers, production secrets, live database, or dynamic penetration test was available. Deployment-dependent conclusions are identified below.

---

## 1. Executive summary

The current implementation has a strong authorization core. Store permissions are centralized, backend decisions are based on current database state rather than JWT permission claims, resource-scoped checks conceal cross-store denials as `404`, and sensitive financial workflows add contextual controls beyond basic RBAC.

No confirmed critical or high-severity authorization bypass was found in the reviewed code. The earlier version of this report overstated several issues: expense receipts are not stored in the public upload directory, fiscal-period transitions are platform-admin-only, and self-approval controls already exist for expenses, refunds, and pay runs.

### Verified findings and implementation status

| ID | Severity | Finding | Status |
| --- | --- | --- | --- |
| F-01 | **Medium, deployment-dependent** | `/metrics` lacked application-layer authentication | **Resolved in code:** dedicated bearer authentication is required; production configuration fails closed when its secret is absent |
| F-02 | **Medium** | Bearer access tokens are persisted in `localStorage` for 4–8 hours | **Open:** any successful frontend XSS can steal a reusable token |
| F-03 | **Medium (functional/access-contract)** | Store-management UI did not accurately implement backend permissions | **Resolved in code:** URL-store guards, action-level gating, staff catalog access, and field-minimal product updates now align with backend policy |
| F-04 | **Low** | HTTP-level authorization integration coverage is still missing | **Partially improved:** metrics middleware and product-update permission behavior now have focused tests; real-router authorization tests remain open |
| F-05 | **Low** | Frontend access state could remain fresh for five minutes after revocation | **Resolved in code:** the freshness window is one minute and socket connect/disconnect/error events invalidate access state |
| F-06 | **Low** | `finance.period.close` and several platform capability names are registry/documentation drift | **Open:** the current checks are secure, but the permission vocabulary does not consistently describe enforcement |
| F-07 | **Low, deployment-dependent** | Membership-change socket eviction is process-local | **Open before horizontal scaling:** another process could continue delivering events to an already-connected revoked user |
| F-08 | **Informational** | Authorization is split between route middleware and service methods | **Accepted design:** document and test the authoritative enforcement location |

### Priority

1. Configure a strong `METRICS_BEARER_TOKEN` in every production environment and keep the ingress allowlist as defense in depth.
2. Add HTTP authorization integration tests for cross-store and negative-role cases.
3. Decide whether to keep `localStorage` tokens with strong XSS defenses or move to hardened cookies with CSRF protection.
4. Clean up unused or inconsistently applied permission/capability names.

---

## 2. Authorization design as implemented

### 2.1 Authentication

[`auth.service.ts`](backend/src/features/auth/auth.service.ts) issues an HS256 access token with `sub`, `tokenVersion`, `jti`, issuer, audience, issue time, and expiry. It does not embed email, platform role, memberships, or permissions.

For each authenticated HTTP request, [`authenticateUser`](backend/src/middleware/authenticateUser.ts) verifies the bearer token and reloads the user. The request is rejected when the user is inactive or the database `tokenVersion` differs from the token. Configured token lifetimes are `4h`, `6h`, or `8h`, with `6h` as the default.

This design gives the following behavior:

| Change | Enforcement latency |
| --- | --- |
| Store membership suspended or revoked | Next store-authorized HTTP request |
| Store role changed | Next store-authorized HTTP request |
| User deactivated | Next authenticated HTTP request |
| `tokenVersion` incremented | Next authenticated HTTP request |
| Token expires normally | At token expiry |

### 2.2 Platform and store authority

The identity model correctly separates:

- `users.role`: global `admin | user`
- `store_memberships.role`: `manager | finance_manager | payroll_manager | operator | inventory_staff`
- `store_memberships.status`: `active | suspended | revoked`

[`access.permissions.ts`](backend/src/features/access/access.permissions.ts) is the canonical fixed-role permission registry. [`access.service.ts`](backend/src/features/access/access.service.ts) fails closed for unknown roles and permission strings, checks that both the membership and store are active, and lets platform admins intentionally bypass store membership.

[`requireResourceStorePermission`](backend/src/features/access/access.service.ts) converts store-permission denials into `404`, reducing cross-store resource enumeration.

### 2.3 Backend is the security boundary

The frontend guards and hidden controls are usability features only. Backend routes and services remain authoritative. This is the correct trust model, but it does not remove the need for the UI to represent the permission model accurately.

---

## 3. Role matrix

The table below summarizes the implemented role mapping plus contextual service policies. Exact permission strings remain authoritative in [`access.permissions.ts`](backend/src/features/access/access.permissions.ts).

| Role | Scope | Effective access and important limits |
| --- | --- | --- |
| **Platform admin** | Global | All platform operations and all store permissions; fiscal-period control additionally requires authentication within the last 15 minutes |
| **Manager** | Assigned stores | Operations/orders, inventory, store profile/products/zones, limited staff management, audit, finance overview/sales, expenses, refunds, cash, settlement read, and costs; expense/refund approval thresholds apply; cannot manage privileged staff roles |
| **Finance manager** | Assigned stores | Finance, reconciliation, ledger read/post, expenses pay/post, read-only orders/inventory/products; cannot control fiscal periods |
| **Payroll manager** | Assigned stores | Payroll profiles, compensation, calculation, approval, payment, posting, void, and reversal; recent authentication and multi-person segregation rules apply to the pay-run workflow |
| **Operator** | Assigned stores | Operations dashboard, order read/status updates, inventory/product read, refund request, and ordinary cash movements; cannot open/close/reopen cash sessions, reverse movements, or make material adjustments |
| **Inventory staff** | Assigned stores | Operations dashboard, inventory management, product read/availability, and cost read; no order, general finance, staff, or payroll access |
| **Customer** | Own resources | Profile, addresses, cart, checkout, and own orders/payments; no staff workspace authority |

### Important contextual controls

- Managers may assign or manage only `operator` and `inventory_staff`; only platform admins can manage manager, finance-manager, or payroll-manager memberships.
- A user cannot elevate their own membership, and an active store cannot lose its last active manager.
- Expense creators cannot approve or reject their own expense. A creator or approver cannot pay it unless a platform admin supplies an audited override reason.
- Refund requesters cannot approve or reject their own request. Manager approval is amount-limited.
- A pay-run approver cannot be its creator or calculator, and its payer must be independent from the creator, calculator, and approver.
- Fiscal-period open, soft-close, close, and reopen require a platform admin authenticated within the previous 15 minutes.
- Cash-session open/close/reopen, movement reversal, and material adjustment require a manager, finance manager, or platform admin even though operators have `finance.cash.manage` for ordinary movements.

---

## 4. Detailed findings

### F-01 — Resolved: dedicated authentication for finance metrics

**Original evidence:** [`index.ts`](backend/src/index.ts) registers `financeMetricsRoutes` outside the human-user API authentication flow. Previously, [`finance-metrics.routes.ts`](backend/src/features/observability/finance-metrics.routes.ts) exposed `GET /metrics` without its own application authentication.

The endpoint publishes aggregate values including unsettled captured amounts, settlement variances, cash variance, open cash sessions, failed/pending refunds, and outbox health. It intentionally excludes store IDs, user identifiers, payment references, and payroll-sensitive fields.

**Implemented fix:** `/metrics` now requires a dedicated bearer secret from `METRICS_BEARER_TOKEN`. Invalid or missing credentials receive `401`; an unconfigured non-production instance receives `503`; and production configuration validation refuses to start without a token of at least 32 characters. Comparisons use fixed-length SHA-256 digests with `timingSafeEqual`. Focused middleware tests cover missing configuration, missing/incorrect credentials, and successful authentication.

**Remaining deployment action:** Set the secret in production and configure the metrics scraper to send `Authorization: Bearer <token>`. Retain an ingress allowlist or mTLS as defense in depth.

### F-02 — Medium: bearer token persisted in `localStorage`

**Evidence:** [`auth.store.ts`](frontend/src/features/auth/model/auth.store.ts) persists the authentication state in `localStorage`, and [`api-client.ts`](frontend/src/shared/api/api-client.ts) copies the token into the `Authorization` header.

This avoids cookie-based CSRF, so the earlier report's generic “missing CSRF protection” finding was not valid for the current bearer-header design. The tradeoff is that JavaScript can read the token. A successful XSS can therefore exfiltrate a token that remains usable until expiry, account deactivation, or a token-version increment. Store membership revocation still removes store authority on the next request.

**Recommendation:** Choose and document one of these models:

- Keep bearer tokens in browser storage and enforce strong XSS controls at the frontend host: strict CSP, dependency review, output encoding, and avoidance of unsafe HTML execution.
- Prefer an `HttpOnly`, `Secure`, appropriately `SameSite` cookie. If cookies are adopted, add explicit CSRF protection and review CORS/credential behavior at the same time.

### F-03 — Resolved: store-management UI aligned with backend permissions

**Original evidence:** [`routes.tsx`](frontend/src/app/router/routes.tsx) protected the `/admin` parent as staff-only, but its store list, product-mapping, and delivery-zone child routes did not check the permission appropriate to the store in the URL.

There are several concrete mismatches:

1. [`admin-stores-page.tsx`](frontend/src/features/store/pages/admin-stores-page.tsx) displays create, edit, activate/deactivate, product, and delivery-zone controls without checking the relevant permission. Some are platform-admin-only and others are manager-only.
2. [`admin-store-products-page.tsx`](frontend/src/features/store/pages/admin-store-products-page.tsx) calls `useGetProductsA`, which requests the platform-admin-only `GET /product/admin` endpoint. A manager is allowed to map store products by backend policy but cannot load this page successfully.
3. [`store-product-row.tsx`](frontend/src/features/store/components/admin/store-product-row.tsx) always submits both `pricePaise` and `isAvailable`. Inventory staff have only `store.products.availability.update`, so an availability-only edit also triggers the backend price-permission check and is denied.
4. Mutation controls are not hidden or disabled according to the active user's exact permissions, leaving expected `403`/`404` failures as normal UI behavior.

The backend remained secure; this was an availability and access-contract defect, not privilege escalation.

**Implemented fix:** Store product and delivery-zone routes now evaluate their required permission against the `:id` URL store. Store-list actions are gated individually. A store-scoped catalog endpoint allows staff with `store.products.mapping.manage` to load mapping data without calling the platform-admin catalog. Product updates include only changed fields the actor may update, so inventory staff can change availability without implicitly requesting price authority. Focused unit tests cover availability-only, combined authorized, and unauthorized-field omission behavior.

**Remaining test work:** Add component/router coverage for manager, operator, inventory-staff, payroll-manager, and platform-admin views as part of F-04.

### F-04 — Low: authorization integration-test gap

The backend has substantial unit and policy coverage, including the role matrix, access service, staff constraints, finance segregation, period control, and realtime rooms. However, no HTTP-level authorization tests were found (and the backend has no HTTP test client dependency). Frontend coverage contains no access-guard or permission-visibility tests.

Unit tests can prove service policy while missing route wiring, request parsing, middleware order, or a frontend/backend contract mismatch such as F-03.

**Recommendation:** Add a small, high-value HTTP suite covering:

- unauthenticated, inactive-user, and token-version failures;
- every role's representative allow and deny cases;
- cross-store resource access returning `404`;
- store product price-only, availability-only, and mixed updates;
- period control denial for finance managers and stale admin authentication;
- expense, refund, and payroll segregation-of-duties cases;
- private receipt upload/download authorization;
- platform-only routes and `/metrics` deployment behavior.

Add frontend tests for route guards and permission-specific action visibility.

### F-05 — Resolved: frontend access refresh latency reduced

**Original evidence:** [`access.queries.ts`](frontend/src/features/access/api/access.queries.ts) set `staleTime` to five minutes.

After a membership change, the backend always uses current database state and remains immediately authoritative. The UI could previously continue showing controls based on old access data, and local-process socket eviction did not directly invalidate the React Query access record.

**Implemented fix:** The access-query freshness window is now one minute. [`business-runtime.tsx`](frontend/src/app/business-runtime.tsx) invalidates `accessKeys.me()` on socket connect, disconnect, and connection error, causing prompt refetch when a membership-change eviction affects the current process. Backend enforcement remains independent of this usability refresh.

### F-06 — Low: permission vocabulary drift

`finance.period.close` exists as a store permission, is assigned to no store role, and is not used by fiscal-period service methods. This is not a bypass: [`ledger-admin.service.ts`](backend/src/features/ledger/ledger-admin.service.ts) calls `requireRecentOwner`, which requires a platform admin and recent authentication for all period transitions.

Similarly, several names in `PLATFORM_CAPABILITIES` are not supplied to enforcement calls because many routes use the monolithic `authenticateAdmin` check. With only `admin | user` platform roles, passing a capability does not currently create finer-grained authority; all valid platform capabilities resolve to the same admin role.

**Recommendation:** Make the model unambiguous:

- Remove `finance.period.close` from store permissions and represent period control as a platform capability, or explicitly document it as a reserved/non-delegable permission and enforce it consistently.
- Either use each platform capability at its corresponding boundary for auditability and future evolution, or remove unused capability names until multiple platform roles are actually designed.
- Add a contract test that reports permissions/capabilities with no enforcement site.

### F-07 — Low, deployment-dependent: process-local socket eviction

[`staff.realtime.ts`](backend/src/features/staff/staff.realtime.ts) disconnects sockets through the local Socket.IO server after a membership change. The current memory adapter cannot evict a connection owned by another process.

This is acceptable for a single-process deployment. In a multi-process deployment, an already-connected revoked user could continue receiving events on the other process until disconnection/reconnection. HTTP requests remain protected because membership is rechecked.

**Recommendation:** Before scaling Socket.IO horizontally, use a shared adapter and cross-process eviction signal. Treat rooms as delivery audiences, not authorization. Re-authorize any future client-to-server mutation event independently.

### F-08 — Informational: mixed route- and service-layer enforcement

Inventory, delivery-zone, and audit routes commonly use `requireStorePermission` middleware. Finance, payroll, settlements, ledger, refunds, and some store operations authorize inside services. Both patterns can be secure, and the reviewed service methods do enforce access.

The store-product update route is intentionally payload-sensitive: price and availability require different permissions, and mixed payloads require both. [`stores.service.ts`](backend/src/features/stores/stores.service.ts) performs those checks, with tests in [`stores.service.test.ts`](backend/src/features/stores/stores.service.test.ts). Adding only `store.products.price.update` middleware, as the previous report proposed, would incorrectly block availability-only staff; adding only the availability permission would understate price authorization.

**Recommendation:** Declare service-layer authorization authoritative for payload- and resource-dependent decisions. Use route middleware for simple fixed store/permission pairs, avoid duplicating complex policy in two places, and rely on HTTP integration tests to prove that every route reaches an authorized service path.

---

## 5. Confirmed controls and corrected prior claims

| Earlier claim | Review result |
| --- | --- |
| Public `/uploads` exposes expense receipts (**Critical**) | **Incorrect.** `/uploads` contains public catalog/menu images. Expense receipts use generated keys under `.private/expense-receipts`, restrictive file mode where supported, traversal-resistant key validation, authorized metadata/download routes, `Content-Disposition: attachment`, `Cache-Control: private, no-store`, and `nosniff`. Public image serving is intentional. |
| Store product update lacks authorization (**High**) | **Incorrect severity.** It lacks fixed route middleware but the service checks price and availability permissions separately and requires both for a mixed payload. This is the correct location for payload-dependent policy. |
| Finance managers can close fiscal periods (**High**) | **Incorrect.** `requireRecentOwner` requires `platformRole === "admin"` plus authentication within 15 minutes before open/soft-close/close/reopen. |
| Expense/refund/payroll self-approval is allowed (**Medium/High**) | **Incorrect.** All three workflows implement segregation controls. Expenses and refunds also enforce manager approval thresholds; expense payment and payroll payment have additional independence rules. |
| Missing CSRF protection is a current gap | **Not applicable as stated.** Authentication currently uses an explicitly supplied bearer header rather than an ambient browser cookie. The principal browser threat is token theft through XSS. CSRF protection becomes necessary if authentication moves to cookies. |
| `/admin/stores` routes are an authorization bypass | **Incorrect.** The parent route requires staff access and the backend denies unauthorized operations. The verified problem is inaccurate UI gating and blocked legitimate staff workflows, documented as F-03. |

---

## 6. Capability coverage summary

| Domain | Backend enforcement | Notable contextual policy | Assessment |
| --- | --- | --- | --- |
| Orders | Owner, platform admin, or store `orders.*` permission | Resource store is checked for staff | Sound |
| Inventory | Route middleware plus service authorization on sensitive writes | Transactional membership locking on writes | Sound |
| Store profile/products/zones | Mixed route and service checks | Safe profile fields for managers; dynamic product-field permissions | Sound; frontend contract aligned |
| Staff/invitations | Service authorization | Restricted role delegation, self-elevation prevention, last-manager rule, hashed single-use invitation tokens | Sound |
| Expenses | Service authorization | Self-approval denial, approval ceiling, payment segregation/override, transaction locks | Strong |
| Refunds | Service authorization | Requester/approver separation and manager ceiling | Strong |
| Cash | Service authorization | Reviewer role required for high-risk session actions | Strong |
| Settlements/reconciliation | Service authorization | Store/resource scope and platform-only consolidated operations | Sound |
| Ledger | Service authorization | Store-scoped read/post; platform admin plus recent auth for period control | Strong; vocabulary drift |
| Payroll | Service authorization | Recent auth, independent approver/payer, sensitive-data separation | Strong |
| Expense receipts | Private storage plus service authorization | Generated keys, validation, forced download, no-store response | Strong |
| Realtime | Token authentication and DB-derived rooms | Local eviction on membership changes | Sound for one process |
| Operational metrics | Dedicated service bearer authentication | Production secret required; ingress restriction remains defense in depth | Sound after secret configuration |

---

## 7. Recommended roadmap

### Phase 1 — Exposed boundaries

| Action | Status / acceptance criterion |
| --- | --- |
| Add application authentication to `/metrics` | **Done in code.** Configure the production secret and verify scraper authentication plus network restriction during deployment |
| Review frontend token exposure | **Open.** The chosen bearer-storage or cookie model is documented with its XSS/CSRF controls |

### Phase 2 — Frontend permission behavior

| Action | Status / acceptance criterion |
| --- | --- |
| Add URL-store-aware guards | **Done.** Product and delivery-zone routes use the store ID in the URL |
| Gate store actions individually | **Done.** Platform-only and store-permission actions are shown only to eligible users |
| Fix catalog access for store managers | **Done.** Mapping-authorized staff use a store-scoped catalog endpoint |
| Send field-minimal product updates | **Done.** Inventory staff can change availability without implicitly requesting price authority |

### Phase 3 — Add drift-resistant tests

| Action | Acceptance criterion |
| --- | --- |
| HTTP authorization matrix | Representative allow/deny and cross-store cases pass through the real router/middleware stack |
| Frontend permission tests | Routes and controls match the backend permission contract for every fixed role |
| Registry usage test | Unused permissions/capabilities fail or explicitly require an allowlisted explanation |

### Phase 4 — Deployment scaling safeguards

| Action | Trigger |
| --- | --- |
| Shared Socket.IO adapter and eviction signal | Before running more than one realtime process |
| Shared invitation rate limiter | Before running more than one API process or exposing invitations at significant scale |
| Authorization caching | Only after measurement shows per-request membership reads are a bottleneck; invalidation must be immediate and versioned |

---

## 8. Custom-role decision

Keep the current fixed roles. The code already has a typed, auditable permission registry and meaningful contextual policies. Custom roles would increase configuration risk, cache-invalidation complexity, delegation rules, and test combinations without a demonstrated requirement.

Reconsider custom roles only when multiple stores have genuinely different staffing models that cannot be expressed safely with the five existing roles. If introduced, require store-scoped roles, immutable system roles, no wildcard/negative permissions, “cannot grant what you do not have,” non-delegable platform/period capabilities, role versioning, last-manager protection, safe reassignment on deletion, and full audit history.

---

## 9. Final assessment

The backend authorization model is materially stronger than the earlier report indicated. Its most important properties—database-backed revocation, strict store scoping, fail-closed permissions, resource concealment, transaction-aware checks, financial segregation of duties, private receipt storage, and recent-authentication gates—are implemented and covered by focused unit tests.

The highest-value application fixes from this audit are implemented: `/metrics` now fails closed behind dedicated service authentication, store-management UI behavior matches backend permissions, product mutations are field-minimal, and access data refreshes promptly around realtime connection changes.

The remaining work is primarily deployment configuration and drift prevention: provision the metrics secret and retain network restriction, reduce browser token exposure, add HTTP/router-level authorization tests, clean up unused capability vocabulary, and add cross-process socket eviction before horizontal scaling. These changes can proceed without redesigning the fixed-role RBAC model.
