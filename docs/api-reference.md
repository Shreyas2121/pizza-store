# API reference

Reviewed against the working tree on 10 October 2026. Routes below come from the actual Express registrations and mounts in [routes.ts](../backend/src/routes.ts) and [index.ts](../backend/src/index.ts). The base path is `/api/v1`, except protected metrics at `/metrics` and public static assets at `/uploads`.

## Request and response conventions

- Authentication uses `Authorization: Bearer <JWT>`. The server checks signature, issuer, audience, expiry, active user and token version. Store permissions are rechecked against current membership; resource services derive the store from saved records.
- Most JSON successes wrap results in `data`; legacy catalogue/cart handlers may also return `message` and pagination fields. CSV, receipt downloads, metrics and static files have their own content types. Consult the linked handler for the exact response shape.
- Application errors return `message`, a stable `code` when supplied, and optional `data`. Validation failures are 400; business validation can also use 422. Missing and forbidden cross-store resources can both return 404.
- Authoritative money is integer paise; aggregate report/analytics amounts use decimal strings. A few compatibility/presentation fields, including realtime `orderPlaced.total`, are rupee numbers. Never submit a browser-calculated total.
- UUID `Idempotency-Key` headers apply to the supported finance lifecycle commands. Online initiation instead uses a UUID `clientRequestId` in the body. Reuse the same key and meaning after an uncertain response; changed meaning can conflict.
- `X-Request-ID` is returned by request-context middleware. A valid supplied UUID is retained; otherwise one is generated.

## Core request examples

These examples use IDs discovered in your own demo environment.

### Authoritative quote

```http
POST /api/v1/checkout/quote
Content-Type: application/json
Authorization: Bearer <JWT>

{"storeId":1,"addressId":1,"couponCode":null}
```

Authenticated checkout uses the owned saved cart. Public previews may supply `items` containing `productId`, positive `quantity` and `customizationOptionIds`; public/address/coupon rules are enforced by [checkout.service.ts](../backend/src/features/checkout/checkout.service.ts). New quotes have `quoteVersion: "2026-10-10-01"` and `pricingPolicyVersion: 5`.

```text
grandTotalPaise = itemsSubtotalPaise - itemDiscountPaise
                + chargedDeliveryFeePaise + roundingAdjustmentPaise
promotionSavingsPaise = itemDiscountPaise + deliveryDiscountPaise
totalDisplayedSavingsPaise = promotionSavingsPaise + bundleMarkdownPaise
```

Tax is included and is not added again. The ordinary store free-delivery threshold is applied before offer resolution. See [promotion DTOs and examples](promotions-contract.md) for the full quote, application, allocation and bundle shapes.

### COD and online initiation

```http
POST /api/v1/order
Content-Type: application/json
Authorization: Bearer <JWT>

{"addressId":1,"paymentType":"cash","couponCode":null}
```

```http
POST /api/v1/payments/razorpay/orders
Content-Type: application/json
Authorization: Bearer <JWT>

{"addressId":1,"couponCode":null,"clientRequestId":"00000000-0000-4000-8000-000000000001"}
```

The online route name is retained for both simulator and Test Mode adapters. The response supplies saved payment/order identity and provider mode; it does not authorize fulfillment until server finalization. Retry is `POST /api/v1/payments/razorpay/orders/:localOrderId/retry` with ownership checked on the server and no new price/coupon payload.

Simulator events use `POST /api/v1/payments/simulator/orders/:localOrderId/events` with `{"scenario":"successful"}`, `failed`, `delayed`, `duplicate` or `out_of_order`. This is an authenticated demo endpoint, not a provider webhook.

Razorpay verification accepts `localOrderId`, `razorpay_order_id`, `razorpay_payment_id`, and `razorpay_signature`. The webhook uses exact raw request bytes and its own signature check before normal JSON parsing. See [payment operations](razorpay-runbook.md).

## Mounted route inventory

The validation column names explicit `validateBody` schemas or body parsers found in the handler. A dash does not mean input is unvalidated: several routes/services parse Zod schemas directly or validate query/path inputs. Router-wide middleware, spread middleware and service-level authorization must also be read in the linked source; this table is not a permission bypass list. Full role semantics are in [staff authorization](store-staff-authorization.md) and [finance API contracts](finance-api-compatibility-rollout.md).

### access

[Route implementation](../backend/src/features/access/access.routes.ts).

| Method | Path | Explicit body validation/parser |
| --- | --- | --- |
| GET | `/api/v1/access/me` | — |

### audit

[Route implementation](../backend/src/features/audit/audit.routes.ts).

| Method | Path | Explicit body validation/parser |
| --- | --- | --- |
| GET | `/api/v1/stores/:storeId/audit` | — |
| GET | `/api/v1/audit` | — |

### bundles

[Route implementation](../backend/src/features/bundles/bundle.routes.ts).

| Method | Path | Explicit body validation/parser |
| --- | --- | --- |
| POST | `/api/v1/bundles/admin/:id` | `validateBody(bundleDefinitionWriteSchema)` |
| PUT | `/api/v1/bundles/admin/:id` | `validateBody(bundleDefinitionWriteSchema)` |
| GET | `/api/v1/bundles/admin/:id` | — |
| GET | `/api/v1/bundles/:id` | — |

### cart

[Route implementation](../backend/src/features/cart/cart.routes.ts).

Router middleware: `authenticateUser`.

| Method | Path | Explicit body validation/parser |
| --- | --- | --- |
| POST | `/api/v1/cart/add` | `validateBody(addToCartSchema)` |
| GET | `/api/v1/cart/count` | — |
| GET | `/api/v1/cart` | — |
| GET | `/api/v1/cart/checkout` | — |
| PATCH | `/api/v1/cart/update` | `validateBody(updateCartItemSchema)` |
| PATCH | `/api/v1/cart/customize` | `validateBody(updateCartCustomizationSchema)` |
| DELETE | `/api/v1/cart/:id` | — |

### cash management

[Route implementation](../backend/src/features/cash-management/cash.routes.ts).

Router middleware: `cashRoutes.use(authenticateUser)`.

| Method | Path | Explicit body validation/parser |
| --- | --- | --- |
| GET | `/api/v1/finance/cash/sessions` | — |
| GET | `/api/v1/finance/cash/sessions/:sessionId` | — |
| POST | `/api/v1/finance/cash/sessions` | `validateBody(openCashSessionSchema)` |
| POST | `/api/v1/finance/cash/sessions/:sessionId/movements` | `validateBody(recordCashMovementSchema)` |
| POST | `/api/v1/finance/cash/sessions/:sessionId/close` | `validateBody(closeCashSessionSchema)` |
| POST | `/api/v1/finance/cash/sessions/:sessionId/reopen` | `validateBody(reopenCashSessionSchema)` |
| POST | `/api/v1/finance/cash/movements/:movementId/reverse` | `validateBody(reverseCashMovementSchema)` |

### category

[Route implementation](../backend/src/features/category/category.routes.ts).

| Method | Path | Explicit body validation/parser |
| --- | --- | --- |
| POST | `/api/v1/category` | `validateBody(categoryCreateSchema)` |
| GET | `/api/v1/category` | — |
| GET | `/api/v1/category/select` | — |

### chat

[Route implementation](../backend/src/features/chat/chat.routes.ts).

| Method | Path | Explicit body validation/parser |
| --- | --- | --- |
| POST | `/api/v1/chat/request` | — |
| GET | `/api/v1/chat/active` | — |
| GET | `/api/v1/chat/requests` | — |
| PATCH | `/api/v1/chat/request` | — |
| GET | `/api/v1/chat/messages` | — |
| POST | `/api/v1/chat/message` | — |

### checkout

[Route implementation](../backend/src/features/checkout/checkout.routes.ts).

| Method | Path | Explicit body validation/parser |
| --- | --- | --- |
| POST | `/api/v1/checkout/quote` | `validateBody(checkoutQuoteSchema)` |

### costs

[Route implementation](../backend/src/features/costs/cost.routes.ts).

Router middleware: `costRoutes.use(authenticateUser)`.

| Method | Path | Explicit body validation/parser |
| --- | --- | --- |
| GET | `/api/v1/finance/costs/products` | — |
| POST | `/api/v1/finance/costs/products` | `validateBody(createCostVersionSchema)` |

### customization

[Route implementation](../backend/src/features/customization/customize.routes.ts).

| Method | Path | Explicit body validation/parser |
| --- | --- | --- |
| POST | `/api/v1/customize/group` | `validateBody(customizationGroupSchema)` |
| POST | `/api/v1/customize/option` | `validateBody(customizationOptionSchema)` |
| POST | `/api/v1/customize/mapping` | `validateBody(customizationMappingSchema)` |
| GET | `/api/v1/customize/product/:id` | — |
| GET | `/api/v1/customize/admin` | — |

### dashboard

[Route implementation](../backend/src/features/dashboard/dashboard.routes.ts).

| Method | Path | Explicit body validation/parser |
| --- | --- | --- |
| GET | `/api/v1/dashboard` | — |
| GET | `/api/v1/dashboard/charts` | — |

### expenses

[Route implementation](../backend/src/features/expenses/expense.routes.ts).

Router middleware: `expenseRoutes.use(authenticateUser)`.

| Method | Path | Explicit body validation/parser |
| --- | --- | --- |
| GET | `/api/v1/finance/expenses` | — |
| GET | `/api/v1/finance/source-margin` | — |
| GET | `/api/v1/finance/expenses/:expenseId` | — |
| POST | `/api/v1/finance/expenses` | `validateBody(expenseWriteSchema)` |
| PUT | `/api/v1/finance/expenses/:expenseId` | `validateBody(updateExpenseSchema)` |
| GET | `/api/v1/finance/expenses/:expenseId/attachments` | — |
| POST | `/api/v1/finance/expenses/:expenseId/attachments` | `receiveReceipt` |
| GET | `/api/v1/finance/expenses/:expenseId/attachments/:attachmentId` | — |
| POST | `/api/v1/finance/expenses/:expenseId/submit` | `validateBody(emptyExpenseCommandSchema)` |
| POST | `/api/v1/finance/expenses/:expenseId/approve` | `validateBody(emptyExpenseCommandSchema)` |
| POST | `/api/v1/finance/expenses/:expenseId/reject` | `validateBody(rejectExpenseSchema)` |
| POST | `/api/v1/finance/expenses/:expenseId/pay` | `validateBody(payExpenseSchema)` |
| POST | `/api/v1/finance/expenses/:expenseId/post` | `validateBody(emptyExpenseCommandSchema)` |
| POST | `/api/v1/finance/expenses/:expenseId/void` | `validateBody(voidExpenseSchema)` |
| POST | `/api/v1/finance/expenses/:expenseId/reverse` | `validateBody(reverseExpenseSchema)` |

### finance reports

[Route implementation](../backend/src/features/finance-reports/finance-report.routes.ts).

Router middleware: `financeReportRoutes.use(authenticateUser)`.

| Method | Path | Explicit body validation/parser |
| --- | --- | --- |
| GET | `/api/v1/finance/overview` | — |
| GET | `/api/v1/finance/profit-and-loss` | — |
| GET | `/api/v1/finance/sales` | — |
| GET | `/api/v1/finance/margins` | — |
| GET | `/api/v1/finance/exports/:reportType` | — |

### inventory

[Route implementation](../backend/src/features/inventory/inventory.routes.ts).

Router middleware: `inventoryRoutes.use(authenticateUser)`.

| Method | Path | Explicit body validation/parser |
| --- | --- | --- |
| GET | `/api/v1/inventory/store/:storeId` | — |
| GET | `/api/v1/inventory/store/:storeId/product/:productId` | — |
| POST | `/api/v1/inventory/store/:storeId/restock/bulk` | — |
| POST | `/api/v1/inventory/store/:storeId/product/:productId/restock` | — |
| POST | `/api/v1/inventory/store/:storeId/product/:productId/adjustment` | — |
| GET | `/api/v1/inventory/store/:storeId/movements` | — |
| PATCH | `/api/v1/inventory/store/:storeId/product/:productId/threshold` | — |

### ledger

[Route implementation](../backend/src/features/ledger/ledger.routes.ts).

Router middleware: `ledgerRoutes.use(authenticateUser)`.

| Method | Path | Explicit body validation/parser |
| --- | --- | --- |
| GET | `/api/v1/finance/ledger/accounts` | — |
| GET | `/api/v1/finance/ledger/journals` | — |
| GET | `/api/v1/finance/ledger/trial-balance` | — |
| GET | `/api/v1/finance/ledger/periods` | — |
| GET | `/api/v1/finance/ledger/journals/:journalId` | — |
| POST | `/api/v1/finance/ledger/periods` | `validateBody(createFiscalPeriodSchema)` |
| POST | `/api/v1/finance/ledger/periods/:periodId/soft-close` | `validateBody(periodTransitionSchema)` |
| POST | `/api/v1/finance/ledger/periods/:periodId/close` | `validateBody(periodTransitionSchema)` |
| POST | `/api/v1/finance/ledger/periods/:periodId/reopen` | `validateBody(periodTransitionSchema)` |
| POST | `/api/v1/finance/ledger/manual-journals` | `validateBody(manualJournalSchema)` |
| POST | `/api/v1/finance/ledger/journals/:journalId/reverse` | `validateBody(reverseJournalSchema)` |

### menu

[Route implementation](../backend/src/features/menu/menu.routes.ts).

| Method | Path | Explicit body validation/parser |
| --- | --- | --- |
| POST | `/api/v1/menu` | `upload.single("image")` |
| GET | `/api/v1/menu` | — |
| POST | `/api/v1/menu/mapping` | — |

### observability

[Route implementation](../backend/src/features/observability/finance-metrics.routes.ts).

| Method | Path | Explicit body validation/parser |
| --- | --- | --- |
| GET | `/metrics/metrics` | — |

### order

[Route implementation](../backend/src/features/order/order.routes.ts).

| Method | Path | Explicit body validation/parser |
| --- | --- | --- |
| POST | `/api/v1/order` | `validateBody(createOrderSchema)` |
| GET | `/api/v1/order` | — |
| GET | `/api/v1/order/admin/all` | — |
| GET | `/api/v1/order/:orderId` | — |
| PATCH | `/api/v1/order/:orderId` | — |

### payments

[Route implementation](../backend/src/features/payments/payment.routes.ts).

| Method | Path | Explicit body validation/parser |
| --- | --- | --- |
| GET | `/api/v1/payments/methods` | — |
| POST | `/api/v1/payments/simulator/orders/:localOrderId/events` | `validateBody(runPaymentSimulatorSchema)` |
| POST | `/api/v1/payments/razorpay/reconcile` | `validateBody(reconcileRazorpayPaymentsSchema)` |
| POST | `/api/v1/payments/razorpay/verify` | `validateBody(verifyRazorpayPaymentSchema)` |
| POST | `/api/v1/payments/razorpay/orders` | `validateBody(initiateRazorpayOrderSchema)` |
| GET | `/api/v1/payments/razorpay/orders/:localOrderId` | — |
| POST | `/api/v1/payments/razorpay/orders/:localOrderId/retry` | — |

### payments

[Route implementation](../backend/src/features/payments/payment.webhook.routes.ts).

| Method | Path | Explicit body validation/parser |
| --- | --- | --- |
| POST | `/api/v1/payments/razorpay/webhook` | `raw({ type: "application/json", limit: "1mb" })` |

### payroll

[Route implementation](../backend/src/features/payroll/payroll.routes.ts).

Router middleware: `payrollRoutes.use(authenticateUser)`.

| Method | Path | Explicit body validation/parser |
| --- | --- | --- |
| GET | `/api/v1/finance/payroll/profiles` | — |
| GET | `/api/v1/finance/payroll/profiles/:profileId` | — |
| POST | `/api/v1/finance/payroll/profiles` | `validateBody(createPayrollProfileSchema)` |
| PUT | `/api/v1/finance/payroll/profiles/:profileId` | `validateBody(updatePayrollProfileSchema)` |
| GET | `/api/v1/finance/payroll/profiles/:profileId/compensation` | — |
| POST | `/api/v1/finance/payroll/profiles/:profileId/compensation` | `validateBody(createCompensationVersionSchema)` |
| GET | `/api/v1/finance/payroll/pay-runs` | — |
| GET | `/api/v1/finance/payroll/pay-runs/:payRunId` | — |
| GET | `/api/v1/finance/payroll/pay-runs/:payRunId/export` | — |
| GET | `/api/v1/finance/payroll/pay-runs/:payRunId/statements/:employeeId` | — |
| POST | `/api/v1/finance/payroll/pay-runs` | `validateBody(createPayRunSchema)` |
| POST | `/api/v1/finance/payroll/pay-runs/:payRunId/calculate` | `validateBody(emptyPayRunCommandSchema)` |
| POST | `/api/v1/finance/payroll/pay-runs/:payRunId/approve` | `validateBody(emptyPayRunCommandSchema)` |
| POST | `/api/v1/finance/payroll/pay-runs/:payRunId/pay` | `validateBody(payPayRunSchema)` |
| POST | `/api/v1/finance/payroll/pay-runs/:payRunId/post` | `validateBody(emptyPayRunCommandSchema)` |
| POST | `/api/v1/finance/payroll/pay-runs/:payRunId/void` | `validateBody(voidPayRunSchema)` |
| POST | `/api/v1/finance/payroll/pay-runs/:payRunId/reverse` | `validateBody(reversePayRunSchema)` |

### products

[Route implementation](../backend/src/features/products/product.routes.ts).

| Method | Path | Explicit body validation/parser |
| --- | --- | --- |
| POST | `/api/v1/product` | `upload.single("image")` |
| GET | `/api/v1/product/menu` | — |
| GET | `/api/v1/product/admin` | — |
| GET | `/api/v1/product/category/:id` | — |
| GET | `/api/v1/product/group/:id` | — |

### promotions

[Route implementation](../backend/src/features/promotions/promotion.routes.ts).

| Method | Path | Explicit body validation/parser |
| --- | --- | --- |
| POST | `/api/v1/promotions/validate` | — |
| GET | `/api/v1/promotions/offers` | — |
| GET | `/api/v1/promotions/featured` | — |
| POST | `/api/v1/promotions` | — |
| GET | `/api/v1/promotions` | — |
| POST | `/api/v1/promotions/:id/images` | `parseUpload` |
| DELETE | `/api/v1/promotions/:id/images` | — |
| GET | `/api/v1/promotions/:id/analytics` | — |
| GET | `/api/v1/promotions/:id` | — |
| PUT | `/api/v1/promotions/:id` | — |
| DELETE | `/api/v1/promotions/:id` | — |
| GET | `/api/v1/stores/:storeId/promotions` | — |
| PUT | `/api/v1/stores/:storeId/promotions/:promotionId/setting` | — |

### refunds

[Route implementation](../backend/src/features/refunds/refund.routes.ts).

Router middleware: `refundRoutes.use(authenticateUser)`.

| Method | Path | Explicit body validation/parser |
| --- | --- | --- |
| GET | `/api/v1/finance/refunds` | — |
| GET | `/api/v1/finance/refunds/stuck` | — |
| POST | `/api/v1/finance/refunds/reconcile` | `validateBody(reconcileRefundsSchema)` |
| POST | `/api/v1/finance/orders/:orderId/refunds` | `validateBody(requestRefundSchema)` |
| POST | `/api/v1/finance/refunds/:refundId/approve` | `validateBody(approveRefundSchema)` |
| POST | `/api/v1/finance/refunds/:refundId/reject` | `validateBody(rejectRefundSchema)` |
| POST | `/api/v1/finance/refunds/:refundId/retry` | — |

### settlements

[Route implementation](../backend/src/features/settlements/settlement.routes.ts).

Router middleware: `settlementRoutes.use(authenticateUser)`.

| Method | Path | Explicit body validation/parser |
| --- | --- | --- |
| GET | `/api/v1/finance/settlements` | — |
| GET | `/api/v1/finance/settlements/:settlementId` | — |
| POST | `/api/v1/finance/settlements/import` | `validateBody(importSettlementSchema)` |
| POST | `/api/v1/finance/settlements/:settlementId/reconcile` | — |
| GET | `/api/v1/finance/reconciliation/issues` | — |
| POST | `/api/v1/finance/reconciliation/issues/:issueId/resolve` | `validateBody(resolveReconciliationIssueSchema)` |

### staff

[Route implementation](../backend/src/features/staff/staff.routes.ts).

Router middleware: `staffRoutes.use(authenticateUser)`.

| Method | Path | Explicit body validation/parser |
| --- | --- | --- |
| GET | `/api/v1/stores/:storeId/staff` | — |
| POST | `/api/v1/stores/:storeId/staff` | — |
| PATCH | `/api/v1/stores/:storeId/staff/:membershipId` | — |
| DELETE | `/api/v1/stores/:storeId/staff/:membershipId` | — |
| GET | `/api/v1/stores/:storeId/staff/invitations` | — |
| POST | `/api/v1/stores/:storeId/staff/invitations` | — |
| DELETE | `/api/v1/stores/:storeId/staff/invitations/:invitationId` | — |
| POST | `/api/v1/staff-invitations/accept` | — |

### stores

[Route implementation](../backend/src/features/stores/stores.routes.ts).

| Method | Path | Explicit body validation/parser |
| --- | --- | --- |
| GET | `/api/v1/stores/:id/checkout-pricing` | — |
| POST | `/api/v1/stores/:id/checkout-pricing/initialize` | — |
| GET | `/api/v1/stores` | — |
| GET | `/api/v1/stores/select` | — |
| POST | `/api/v1/stores` | — |
| POST | `/api/v1/stores/resolve` | — |
| GET | `/api/v1/stores/:id/products` | — |
| GET | `/api/v1/stores/:id/products/catalog` | — |
| POST | `/api/v1/stores/:id/products` | — |
| PUT | `/api/v1/stores/:id/products/:productId` | — |
| DELETE | `/api/v1/stores/:id/products/:productId` | — |
| GET | `/api/v1/stores/:id/delivery-zones` | — |
| POST | `/api/v1/stores/:id/delivery-zones` | — |
| DELETE | `/api/v1/stores/:id/delivery-zones/:zoneId` | — |
| GET | `/api/v1/stores/slug/:slug` | — |
| GET | `/api/v1/stores/:id` | — |
| PUT | `/api/v1/stores/:id` | — |
| DELETE | `/api/v1/stores/:id` | — |

### system maintenance

[Route implementation](../backend/src/features/system-maintenance/system-maintenance.routes.ts).

Router middleware: `systemMaintenanceRoutes.use(authenticateAdmin)`.

| Method | Path | Explicit body validation/parser |
| --- | --- | --- |
| POST | `/api/v1/admin/system/clear-all` | — |

### users

[Route implementation](../backend/src/features/users/user.routes.ts).

| Method | Path | Explicit body validation/parser |
| --- | --- | --- |
| POST | `/api/v1/user/register` | `validateBody(registerSchema)` |
| PATCH | `/api/v1/user/address/:addressId` | `validateBody(createAddressSchema)` |
| DELETE | `/api/v1/user/address/:addressId` | — |
| POST | `/api/v1/user/login` | `validateBody(loginSchema)` |
| GET | `/api/v1/user/address` | — |
| POST | `/api/v1/user/address` | `validateBody(createAddressSchema)` |
| GET | `/api/v1/user` | — |

### vendors

[Route implementation](../backend/src/features/vendors/vendor.routes.ts).

Router middleware: `vendorRoutes.use(authenticateUser)`.

| Method | Path | Explicit body validation/parser |
| --- | --- | --- |
| GET | `/api/v1/finance/vendors` | — |
| POST | `/api/v1/finance/vendors` | `validateBody(createVendorSchema)` |
| PUT | `/api/v1/finance/vendors/:vendorId` | `validateBody(updateVendorSchema)` |
| GET | `/api/v1/finance/expenses/categories` | — |
| POST | `/api/v1/finance/expenses/categories` | `validateBody(createExpenseCategorySchema)` |
| PUT | `/api/v1/finance/expenses/categories/:categoryId` | `validateBody(updateExpenseCategorySchema)` |

Inventory: 183 registered handlers (the `/store` compatibility alias repeats the `/stores` store router and is not listed twice). The retired `/coupon` router is absent. Product/category/menu/customization administrative operations follow the registrations above; do not infer extra CRUD methods from screen names.
