# Backend API Endpoints — Frontend Usage Audit Report

> **Generated:** October 7, 2026  
> **Source:** [`backend/src/routes.ts`](file:///f:/Shreyas/food/backend/src/routes.ts) & [`backend/src/index.ts`](file:///f:/Shreyas/food/backend/src/index.ts)  
> **Target Scanned:** [`frontend/src`](file:///f:/Shreyas/food/frontend/src)

---

## 1. Executive Summary

> **Implementation follow-up (October 7, 2026):** Categories and Bundles from the unused-feature list are now integrated. `/admin/categories` lists and creates categories, refreshing product-form dropdowns. Product creation supports `single` and `bundle`; bundle products link to `/admin/bundles/:id` to create or update components and store prices. The editor also calls the public bundle lookup for a saved, store-specific availability preview. All six endpoints in these two feature groups now have frontend callers. The counts and tables below describe the original audit before this follow-up.

> **Customizations and Payments follow-up:** `/admin/customization` now creates groups and options, with rupee entry converted to paise. Assignments update the customer-facing customization flag and exclude bundles; cart selections enforce required/single groups and product-specific available options. `/admin/payments` provides a platform-admin payment reconciliation form and batch results. Pending customer orders poll the private payment status endpoint, expose manual refresh, and check status before retrying. All four endpoints listed under features 3 and 4 now have frontend callers.

| Category | Count | Description |
|---|:---:|---|
| **Total Backend Endpoints** | **175** | 173 registered in `mainRoutes` + 2 server-level routes (`index.ts`) |
| **Used in Frontend** | **148** | Fully integrated in React Query hooks, mutations, and views |
| **Not Used in Frontend** | **23** | Declared in backend but have zero frontend callers |
| **Mismatched / Broken FE Contracts** | **4** | Endpoints where Frontend attempts to call a different non-existent path |

---

## 2. Unused Endpoints by Feature

The following 23 endpoints are implemented in the backend but are **not called** anywhere in the frontend:

### 1. Categories ([`backend/src/features/category/category.routes.ts`](file:///f:/Shreyas/food/backend/src/features/category/category.routes.ts))
| Method | Endpoint | File Location | Reason Unused |
|---|---|---|---|
| `POST` | `/api/v1/category/` | [`category.routes.ts:10`](file:///f:/Shreyas/food/backend/src/features/category/category.routes.ts#L10) | Admin category creation. Categories are seeded; frontend has no UI form/modal for adding categories. |
| `GET` | `/api/v1/category/` | [`category.routes.ts:22`](file:///f:/Shreyas/food/backend/src/features/category/category.routes.ts#L22) | Full category entity listing. Frontend only consumes [`GET /category/select`](file:///f:/Shreyas/food/backend/src/features/category/category.routes.ts#L33) for dropdown selection. |

### 2. Bundles ([`backend/src/features/bundles/bundle.routes.ts`](file:///f:/Shreyas/food/backend/src/features/bundles/bundle.routes.ts))
*Note: All 4 dedicated bundle routes are completely uncalled by frontend.*
| Method | Endpoint | File Location | Reason Unused |
|---|---|---|---|
| `POST` | `/api/v1/bundles/admin/:id` | [`bundle.routes.ts:11`](file:///f:/Shreyas/food/backend/src/features/bundles/bundle.routes.ts#L11) | Admin bundle definition creation. No bundle authoring UI exists in frontend. |
| `PUT` | `/api/v1/bundles/admin/:id` | [`bundle.routes.ts:24`](file:///f:/Shreyas/food/backend/src/features/bundles/bundle.routes.ts#L24) | Admin bundle definition replacement. |
| `GET` | `/api/v1/bundles/admin/:id` | [`bundle.routes.ts:37`](file:///f:/Shreyas/food/backend/src/features/bundles/bundle.routes.ts#L37) | Admin bundle definition lookup. |
| `GET` | `/api/v1/bundles/:id` | [`bundle.routes.ts:48`](file:///f:/Shreyas/food/backend/src/features/bundles/bundle.routes.ts#L48) | Public bundle lookup. Bundle data is already hydrated inside product entities (`productType === "bundle"`) returned by [`GET /product/menu`](file:///f:/Shreyas/food/backend/src/features/products/product.routes.ts#L46). |

### 3. Customizations ([`backend/src/features/customization/customize.routes.ts`](file:///f:/Shreyas/food/backend/src/features/customization/customize.routes.ts))
| Method | Endpoint | File Location | Reason Unused |
|---|---|---|---|
| `POST` | `/api/v1/customize/group` | [`customize.routes.ts:12`](file:///f:/Shreyas/food/backend/src/features/customization/customize.routes.ts#L12) | Create customization group. Frontend only updates mappings via `/customize/mapping`, no group creation mutation exists. |
| `POST` | `/api/v1/customize/option` | [`customize.routes.ts:24`](file:///f:/Shreyas/food/backend/src/features/customization/customize.routes.ts#L24) | Create customization option. No frontend creation mutation exists. |

### 4. Payments ([`backend/src/features/payments/payment.routes.ts`](file:///f:/Shreyas/food/backend/src/features/payments/payment.routes.ts))
| Method | Endpoint | File Location | Reason Unused |
|---|---|---|---|
| `POST` | `/api/v1/payments/razorpay/reconcile` | [`payment.routes.ts:72`](file:///f:/Shreyas/food/backend/src/features/payments/payment.routes.ts#L72) | Reconcile stale payments. Background maintenance job; no frontend trigger. |
| `GET` | `/api/v1/payments/razorpay/orders/:localOrderId` | [`payment.routes.ts:182`](file:///f:/Shreyas/food/backend/src/features/payments/payment.routes.ts#L182) | Status polling for an online payment. Frontend uses Socket.IO and the verify callback rather than polling this endpoint. |

### 5. Refunds ([`backend/src/features/refunds/refund.routes.ts`](file:///f:/Shreyas/food/backend/src/features/refunds/refund.routes.ts))
| Method | Endpoint | File Location | Reason Unused |
|---|---|---|---|
| `GET` | `/api/v1/finance/refunds/stuck` | [`refund.routes.ts:31`](file:///f:/Shreyas/food/backend/src/features/refunds/refund.routes.ts#L31) | Queue for stuck/investigation refunds. The frontend refunds panel filters directly via `GET /finance/refunds`. |
| `POST` | `/api/v1/finance/refunds/reconcile` | [`refund.routes.ts:40`](file:///f:/Shreyas/food/backend/src/features/refunds/refund.routes.ts#L40) | Reconcile stale refunds against Razorpay. Backend operational task with no UI trigger. |

### 6. Expenses ([`backend/src/features/expenses/expense.routes.ts`](file:///f:/Shreyas/food/backend/src/features/expenses/expense.routes.ts))
| Method | Endpoint | File Location | Reason Unused |
|---|---|---|---|
| `PUT` | `/api/v1/finance/expenses/:expenseId` | [`expense.routes.ts:29`](file:///f:/Shreyas/food/backend/src/features/expenses/expense.routes.ts#L29) | Update draft expense. Frontend allows creating and actioning expenses (`submit`, `approve`, etc.), but does not implement an update mutation for draft expenses. |

### 7. Payroll ([`backend/src/features/payroll/payroll.routes.ts`](file:///f:/Shreyas/food/backend/src/features/payroll/payroll.routes.ts))
| Method | Endpoint | File Location | Reason Unused |
|---|---|---|---|
| `GET` | `/api/v1/finance/payroll/profiles/:profileId` | [`payroll.routes.ts:35`](file:///f:/Shreyas/food/backend/src/features/payroll/payroll.routes.ts#L35) | Single employee payroll profile detail. Frontend fetches list via `/finance/payroll/profiles` with `limit=100`. |
| `POST` | `/api/v1/finance/payroll/profiles` | [`payroll.routes.ts:39`](file:///f:/Shreyas/food/backend/src/features/payroll/payroll.routes.ts#L39) | Create employee payroll profile. No frontend creation form exists. |
| `PUT` | `/api/v1/finance/payroll/profiles/:profileId` | [`payroll.routes.ts:43`](file:///f:/Shreyas/food/backend/src/features/payroll/payroll.routes.ts#L43) | Update employee payroll profile. |
| `POST` | `/api/v1/finance/payroll/profiles/:profileId/compensation` | [`payroll.routes.ts:55`](file:///f:/Shreyas/food/backend/src/features/payroll/payroll.routes.ts#L55) | Add compensation version. Frontend explicitly notes: *"Add an effective compensation version through the restricted API."* |

### 8. Stores ([`backend/src/features/stores/stores.routes.ts`](file:///f:/Shreyas/food/backend/src/features/stores/stores.routes.ts))
| Method | Endpoint | File Location | Reason Unused |
|---|---|---|---|
| `GET` | `/api/v1/stores/select` | [`stores.routes.ts:56`](file:///f:/Shreyas/food/backend/src/features/stores/stores.routes.ts#L56) | Dropdown store select. Frontend fetches full list via [`GET /stores?limit=100`](file:///f:/Shreyas/food/frontend/src/features/store/api/store.queries.ts#L17). |
| `GET` | `/api/v1/stores/slug/:slug` | [`stores.routes.ts:266`](file:///f:/Shreyas/food/backend/src/features/stores/stores.routes.ts#L266) | Store lookup by slug. Customer frontend resolves stores by pincode via [`POST /stores/resolve`](file:///f:/Shreyas/food/frontend/src/features/store/model/store.store.ts#L39). |
| `*` | `/api/v1/store/*` | [`routes.ts:63`](file:///f:/Shreyas/food/backend/src/routes.ts#L63) | Singular alias mount (`mainRoutes.use("/store", storeRoutes)`). Frontend universally calls `/stores/...` (plural). |

### 9. Inventory ([`backend/src/features/inventory/inventory.routes.ts`](file:///f:/Shreyas/food/backend/src/features/inventory/inventory.routes.ts))
| Method | Endpoint | File Location | Reason Unused |
|---|---|---|---|
| `GET` | `/api/v1/inventory/store/:storeId/product/:productId` | [`inventory.routes.ts:37`](file:///f:/Shreyas/food/backend/src/features/inventory/inventory.routes.ts#L37) | Single product inventory fetch. Frontend loads inventory as a whole list via `GET /inventory/store/:storeId`. |

### 10. Webhooks & Infrastructure ([`backend/src/index.ts`](file:///f:/Shreyas/food/backend/src/index.ts))
| Method | Endpoint | File Location | Reason Unused |
|---|---|---|---|
| `POST` | `/api/v1/payments/razorpay/webhook` | [`payment.webhook.routes.ts:13`](file:///f:/Shreyas/food/backend/src/features/payments/payment.webhook.routes.ts#L13) | Razorpay server-to-server webhook callback (external to browser). |
| `GET` | `/metrics` | [`finance-metrics.routes.ts:34`](file:///f:/Shreyas/food/backend/src/features/observability/finance-metrics.routes.ts#L34) | Prometheus scraper endpoint requiring `METRICS_BEARER_TOKEN`. |

---

## 3. Contract Mismatches & Broken Frontend Routes

In [`backend/src/features/chat/chat.routes.ts`](file:///f:/Shreyas/food/backend/src/features/chat/chat.routes.ts), **4 backend endpoints are unused because the frontend calls non-existent paths**:

| Backend Route Declared | Frontend Attempt in [`chat.queries.ts`](file:///f:/Shreyas/food/frontend/src/features/support/api/chat.queries.ts) | Resulting Defect |
|---|---|---|
| `GET /api/v1/chat/requests` ([L73](file:///f:/Shreyas/food/backend/src/features/chat/chat.routes.ts#L73)) | `GET /chat/all` ([L81](file:///f:/Shreyas/food/frontend/src/features/support/api/chat.queries.ts#L81)) | Frontend receives **404 Not Found** when loading support requests in `AdminSupportPage`. |
| `PATCH /api/v1/chat/request` ([L88](file:///f:/Shreyas/food/backend/src/features/chat/chat.routes.ts#L88)) | `PATCH /chat/status/:id` ([L109](file:///f:/Shreyas/food/frontend/src/features/support/api/chat.queries.ts#L109)) | Updating chat status in `support-actions.tsx` returns **404 Not Found**. |
| `POST /api/v1/chat/message` ([L158](file:///f:/Shreyas/food/backend/src/features/chat/chat.routes.ts#L158)) | `POST /chat/send` ([L73](file:///f:/Shreyas/food/frontend/src/features/support/api/chat.queries.ts#L73)) | Sending chat messages in `Chat` component returns **404 Not Found**. |
| `GET /api/v1/chat/messages` ([L121](file:///f:/Shreyas/food/backend/src/features/chat/chat.routes.ts#L121)) | `GET /chat/messages/:id` ([L56](file:///f:/Shreyas/food/frontend/src/features/support/api/chat.queries.ts#L56)) / `/chat/messages/user/:id` ([L66](file:///f:/Shreyas/food/frontend/src/features/support/api/chat.queries.ts#L66)) | Backend expects query parameters (`?userId=...`), but frontend passes subpaths, triggering **404 Not Found**. |

---

## 4. Full Route Inventory Matrix

| Feature | Mount Path | Total Routes | Used in FE | Unused in FE | Status Summary |
|---|---|:---:|:---:|:---:|---|
| **Users** | `/user` | 7 | 7 | 0 | 100% used (Auth + Address CRUD) |
| **Access** | `/access` | 1 | 1 | 0 | 100% used (`/access/me`) |
| **Category** | `/category` | 3 | 1 | **2** | Only `/category/select` used |
| **Products** | `/product` | 5 | 5 | 0 | 100% used (Menu, Admin, Cat, Group) |
| **Bundles** | `/bundles` | 4 | 0 | **4** | 0% used (Handled via Product cards) |
| **Promotions** | `/promotions` & `/stores` | 13 | 13 | 0 | 100% used (Admin, Stores, Images, Validation) |
| **Customization** | `/customize` | 5 | 3 | **2** | Group & Option creation unused |
| **Menu** | `/menu` | 3 | 3 | 0 | 100% used (Menu items + Mapping) |
| **Cart** | `/cart` | 7 | 7 | 0 | 100% used (Add, Update, Remove, Clear) |
| **Checkout** | `/checkout` | 1 | 1 | 0 | 100% used (`/checkout/quote`) |
| **Orders** | `/order` | 5 | 5 | 0 | 100% used (Customer + Admin + Transitions) |
| **Payments** | `/payments` | 7 | 5 | **2** | Reconcile & Order-poll unused |
| **Refunds** | `/finance` | 7 | 5 | **2** | `/stuck` and `/reconcile` unused |
| **Settlements** | `/finance` | 6 | 6 | 0 | 100% used (Batches, Issues, Imports) |
| **Product Costs** | `/finance` | 2 | 2 | 0 | 100% used (List + Add versions) |
| **Cash Management** | `/finance` | 7 | 7 | 0 | 100% used (Sessions, Movements, Close, Reopen) |
| **Vendors & Categories** | `/finance` | 6 | 6 | 0 | 100% used (Vendors + Expense Categories) |
| **Expenses** | `/finance` | 15 | 14 | **1** | `PUT /expenses/:id` unused |
| **General Ledger** | `/finance` | 11 | 11 | 0 | 100% used (Accounts, Journals, Trial Balance, Periods) |
| **Finance Reports** | `/finance` | 5 | 5 | 0 | 100% used (Overview, PnL, Sales, Margins, Exports) |
| **Payroll** | `/finance` | 17 | 13 | **4** | Profile & Compensation create/update unused |
| **Dashboard** | `/dashboard` | 2 | 2 | 0 | 100% used (Cards + Charts) |
| **Support Chat** | `/chat` | 6 | 2 | **4** | 4 endpoints broken due to FE path mismatches |
| **Staff & Invites** | `/stores` & `/staff-invitations` | 8 | 8 | 0 | 100% used (Memberships + Invites) |
| **Audit** | `/stores` & `/audit` | 2 | 2 | 0 | 100% used (Store + Global Audit logs) |
| **Store Management** | `/stores` & `/store` | 16 | 14 | **2** | `/stores/select` & `/stores/slug/:slug` unused |
| **Inventory** | `/inventory` | 7 | 6 | **1** | Single-product inventory fetch unused |
| **System Maintenance** | `/admin/system` | 1 | 1 | 0 | 100% used (`/admin/system/clear-all`) |
| **Static Uploads** | `/uploads` | 1 | 1 | 0 | 100% used (Media assets) |
| **Webhooks & Infra** | Root / `/payments` | 2 | 0 | **2** | Razorpay webhook & Prometheus `/metrics` |
| **TOTAL** | | **175** | **148** | **27** | |
