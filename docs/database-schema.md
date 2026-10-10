# Database schema

Reviewed on 10 October 2026 against [schema exports](../backend/src/db/schema/index.ts), domain table declarations, [relations](../backend/src/db/schema/_relations.ts), shared column helpers and the migration journal. The current model contains **64 tables**. The inventory below includes every declared column; it is a source reference, not evidence that a particular database has applied the schema.

## Model boundaries

- Global catalogue: categories, products, customization groups/options and menus. Stores map products to their own prices, availability and tracked stock; delivery zones resolve serviceability.
- Customer state: users, addresses and carts. Orders save prices/names, tax, discounts and bundle components; images and addresses can remain referenced current records.
- Payments: one local payment plus normalized attempts and webhook claims. Refunds and settlements have their own aggregates and allocation/matching evidence.
- Promotions: global definitions/rules, per-store participation, immutable applications and allocations. Usage and budget derive from reserved/consumed applications. Legacy coupon tables are removed at migration 0030.
- Finance: cash sessions/movements, effective-dated costs, vendors, expenses/allocations/receipts, restricted payroll snapshots, financial outbox, chart, fiscal periods and journal lines.
- Authorization/audit: store memberships, hashed invitations and safe lifecycle/attempt audit records.

## Persistence rules

Authoritative money is bounded integer paise; aggregate DTOs serialize large amounts as decimal strings. UTC instants use timezone-aware timestamps; financial business dates and relevant timezones/rule versions are saved separately. Nullable tracked quantity means untracked stock. JSONB snapshots preserve historical financial inputs and are not invitations to recompute from current configuration.

Each table links to its exact Drizzle declaration. `Required` denotes `NOT NULL` or a primary key. Defaults are database builder defaults; the shared `updatedAt` helper also has a Drizzle update callback, not a database update trigger. TypeScript unions on text columns do not by themselves enforce SQL values; inspect each table's checks.

Named indexes, composite uniqueness and checks are listed per table. Full expressions and composite foreign keys remain in the linked declarations. Some additional custom constraints/functions/triggers exist only in SQL migrations.

## Tables

| Table | Columns | Declaration |
| --- | ---: | --- |
| [`store_memberships`](#store-memberships) | 12 | [access.schema.ts](../backend/src/db/schema/access.schema.ts) |
| [`store_staff_invitations`](#store-staff-invitations) | 12 | [access.schema.ts](../backend/src/db/schema/access.schema.ts) |
| [`audit_logs`](#audit-logs) | 14 | [audit.schema.ts](../backend/src/db/schema/audit.schema.ts) |
| [`bundle_components`](#bundle-components) | 6 | [bundle-component.schema.ts](../backend/src/db/schema/bundle-component.schema.ts) |
| [`cart`](#cart) | 6 | [cart.schema.ts](../backend/src/db/schema/cart.schema.ts) |
| [`cart_items`](#cart-items) | 7 | [cart.schema.ts](../backend/src/db/schema/cart.schema.ts) |
| [`cart_item_customizations`](#cart-item-customizations) | 6 | [cart.schema.ts](../backend/src/db/schema/cart.schema.ts) |
| [`cash_sessions`](#cash-sessions) | 17 | [cash.schema.ts](../backend/src/db/schema/cash.schema.ts) |
| [`cash_movements`](#cash-movements) | 12 | [cash.schema.ts](../backend/src/db/schema/cash.schema.ts) |
| [`cash_session_closures`](#cash-session-closures) | 14 | [cash.schema.ts](../backend/src/db/schema/cash.schema.ts) |
| [`categories`](#categories) | 6 | [catalog.schema.ts](../backend/src/db/schema/catalog.schema.ts) |
| [`products`](#products) | 13 | [catalog.schema.ts](../backend/src/db/schema/catalog.schema.ts) |
| [`chat_sessions`](#chat-sessions) | 6 | [chat.schema.ts](../backend/src/db/schema/chat.schema.ts) |
| [`chat_messages`](#chat-messages) | 5 | [chat.schema.ts](../backend/src/db/schema/chat.schema.ts) |
| [`customization_groups`](#customization-groups) | 6 | [customization.schema.ts](../backend/src/db/schema/customization.schema.ts) |
| [`customization_options`](#customization-options) | 7 | [customization.schema.ts](../backend/src/db/schema/customization.schema.ts) |
| [`product_customization_group_mapping`](#product-customization-group-mapping) | 2 | [customization.schema.ts](../backend/src/db/schema/customization.schema.ts) |
| [`expenses`](#expenses) | 37 | [expense.schema.ts](../backend/src/db/schema/expense.schema.ts) |
| [`expense_allocations`](#expense-allocations) | 11 | [expense.schema.ts](../backend/src/db/schema/expense.schema.ts) |
| [`expense_commands`](#expense-commands) | 8 | [expense.schema.ts](../backend/src/db/schema/expense.schema.ts) |
| [`expense_attachments`](#expense-attachments) | 10 | [expense.schema.ts](../backend/src/db/schema/expense.schema.ts) |
| [`financial_outbox`](#financial-outbox) | 26 | [financial-outbox.schema.ts](../backend/src/db/schema/financial-outbox.schema.ts) |
| [`inventory_reservations`](#inventory-reservations) | 10 | [inventory.schema.ts](../backend/src/db/schema/inventory.schema.ts) |
| [`inventory_movements`](#inventory-movements) | 11 | [inventory.schema.ts](../backend/src/db/schema/inventory.schema.ts) |
| [`ledger_accounts`](#ledger-accounts) | 11 | [ledger.schema.ts](../backend/src/db/schema/ledger.schema.ts) |
| [`journal_entries`](#journal-entries) | 19 | [ledger.schema.ts](../backend/src/db/schema/ledger.schema.ts) |
| [`journal_lines`](#journal-lines) | 14 | [ledger.schema.ts](../backend/src/db/schema/ledger.schema.ts) |
| [`fiscal_periods`](#fiscal-periods) | 12 | [ledger.schema.ts](../backend/src/db/schema/ledger.schema.ts) |
| [`menu_items`](#menu-items) | 8 | [menu.schema.ts](../backend/src/db/schema/menu.schema.ts) |
| [`menu_items_mapping`](#menu-items-mapping) | 2 | [menu.schema.ts](../backend/src/db/schema/menu.schema.ts) |
| [`orders`](#orders) | 38 | [order.schema.ts](../backend/src/db/schema/order.schema.ts) |
| [`order_items`](#order-items) | 23 | [order.schema.ts](../backend/src/db/schema/order.schema.ts) |
| [`order_item_customizations`](#order-item-customizations) | 7 | [order.schema.ts](../backend/src/db/schema/order.schema.ts) |
| [`order_item_bundle_components`](#order-item-bundle-components) | 8 | [order.schema.ts](../backend/src/db/schema/order.schema.ts) |
| [`payment_attempts`](#payment-attempts) | 20 | [payment-attempt.schema.ts](../backend/src/db/schema/payment-attempt.schema.ts) |
| [`payment_webhook_events`](#payment-webhook-events) | 9 | [payment-event.schema.ts](../backend/src/db/schema/payment-event.schema.ts) |
| [`payments`](#payments) | 16 | [payment.schema.ts](../backend/src/db/schema/payment.schema.ts) |
| [`employee_finance_profiles`](#employee-finance-profiles) | 17 | [payroll.schema.ts](../backend/src/db/schema/payroll.schema.ts) |
| [`compensation_versions`](#compensation-versions) | 10 | [payroll.schema.ts](../backend/src/db/schema/payroll.schema.ts) |
| [`compensation_components`](#compensation-components) | 7 | [payroll.schema.ts](../backend/src/db/schema/payroll.schema.ts) |
| [`pay_runs`](#pay-runs) | 34 | [payroll.schema.ts](../backend/src/db/schema/payroll.schema.ts) |
| [`pay_run_employees`](#pay-run-employees) | 13 | [payroll.schema.ts](../backend/src/db/schema/payroll.schema.ts) |
| [`pay_run_lines`](#pay-run-lines) | 8 | [payroll.schema.ts](../backend/src/db/schema/payroll.schema.ts) |
| [`pay_run_commands`](#pay-run-commands) | 8 | [payroll.schema.ts](../backend/src/db/schema/payroll.schema.ts) |
| [`product_cost_versions`](#product-cost-versions) | 9 | [product-cost.schema.ts](../backend/src/db/schema/product-cost.schema.ts) |
| [`promotion_applications`](#promotion-applications) | 21 | [promotion-application.schema.ts](../backend/src/db/schema/promotion-application.schema.ts) |
| [`promotion_discount_allocations`](#promotion-discount-allocations) | 7 | [promotion-discount-allocation.schema.ts](../backend/src/db/schema/promotion-discount-allocation.schema.ts) |
| [`promotion_rules`](#promotion-rules) | 12 | [promotion-rule.schema.ts](../backend/src/db/schema/promotion-rule.schema.ts) |
| [`promotions`](#promotions) | 31 | [promotion.schema.ts](../backend/src/db/schema/promotion.schema.ts) |
| [`refunds`](#refunds) | 30 | [refund.schema.ts](../backend/src/db/schema/refund.schema.ts) |
| [`refund_allocations`](#refund-allocations) | 11 | [refund.schema.ts](../backend/src/db/schema/refund.schema.ts) |
| [`settlement_batches`](#settlement-batches) | 24 | [settlement.schema.ts](../backend/src/db/schema/settlement.schema.ts) |
| [`settlement_lines`](#settlement-lines) | 19 | [settlement.schema.ts](../backend/src/db/schema/settlement.schema.ts) |
| [`reconciliation_issues`](#reconciliation-issues) | 16 | [settlement.schema.ts](../backend/src/db/schema/settlement.schema.ts) |
| [`store_promotion_settings`](#store-promotion-settings) | 8 | [store-promotion-setting.schema.ts](../backend/src/db/schema/store-promotion-setting.schema.ts) |
| [`stores`](#stores) | 17 | [store.schema.ts](../backend/src/db/schema/store.schema.ts) |
| [`store_products`](#store-products) | 11 | [store.schema.ts](../backend/src/db/schema/store.schema.ts) |
| [`delivery_zones`](#delivery-zones) | 5 | [store.schema.ts](../backend/src/db/schema/store.schema.ts) |
| [`delivery_pricing_rules`](#delivery-pricing-rules) | 9 | [store.schema.ts](../backend/src/db/schema/store.schema.ts) |
| [`tax_rules`](#tax-rules) | 12 | [tax.schema.ts](../backend/src/db/schema/tax.schema.ts) |
| [`users`](#users) | 10 | [user.schema.ts](../backend/src/db/schema/user.schema.ts) |
| [`addresses`](#addresses) | 10 | [user.schema.ts](../backend/src/db/schema/user.schema.ts) |
| [`vendors`](#vendors) | 15 | [vendor.schema.ts](../backend/src/db/schema/vendor.schema.ts) |
| [`expense_categories`](#expense-categories) | 12 | [vendor.schema.ts](../backend/src/db/schema/vendor.schema.ts) |

### store-memberships

SQL table: `store_memberships`. Model: `storeMembershipsTable` in [access.schema.ts](../backend/src/db/schema/access.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `user_id` | `userId` | integer | Yes | FK users.id; delete cascade |
| `store_id` | `storeId` | integer | Yes | FK stores.id; delete cascade |
| `role` | `role` | text | Yes | — |
| `status` | `status` | text | Yes | default "active" |
| `created_by` | `createdBy` | integer | No | FK users.id; delete set null |
| `updated_by` | `updatedBy` | integer | No | FK users.id; delete set null |
| `activated_at` | `activatedAt` | timestamptz | Yes | default now() |
| `suspended_at` | `suspendedAt` | timestamptz | No | — |
| `revoked_at` | `revokedAt` | timestamptz | No | — |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |
| `updated_at` | `updatedAt` | timestamptz | Yes | default now() |

Table constraints/indexes: unique: `store_memberships_user_id_store_id_unique`; index: `store_memberships_user_status_store_idx`; index: `store_memberships_store_status_role_idx`; check: `store_memberships_role_valid`; check: `store_memberships_status_valid`.

### store-staff-invitations

SQL table: `store_staff_invitations`. Model: `storeStaffInvitationsTable` in [access.schema.ts](../backend/src/db/schema/access.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `store_id` | `storeId` | integer | Yes | FK stores.id; delete cascade |
| `email` | `email` | text | Yes | — |
| `normalized_email` | `normalizedEmail` | text | Yes | — |
| `role` | `role` | text | Yes | — |
| `token_hash` | `tokenHash` | text | Yes | — |
| `invited_by` | `invitedBy` | integer | No | FK users.id; delete set null |
| `expires_at` | `expiresAt` | timestamptz | Yes | — |
| `accepted_at` | `acceptedAt` | timestamptz | No | — |
| `revoked_at` | `revokedAt` | timestamptz | No | — |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |
| `updated_at` | `updatedAt` | timestamptz | Yes | default now() |

Table constraints/indexes: unique: `store_staff_invitations_token_hash_unique`; uniqueIndex: `store_staff_invitations_active_store_email_unique`; check: `store_staff_invitations_role_valid`; check: `store_staff_invitations_token_hash_format`.

### audit-logs

SQL table: `audit_logs`. Model: `auditLogsTable` in [audit.schema.ts](../backend/src/db/schema/audit.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | bigint | Yes | default identity; primary key |
| `actor_user_id` | `actorUserId` | integer | No | FK users.id; delete set null |
| `actor_email_snapshot` | `actorEmailSnapshot` | text | No | — |
| `platform_role` | `platformRole` | text | No | — |
| `store_id` | `storeId` | integer | No | FK stores.id; delete set null |
| `action` | `action` | text | Yes | — |
| `resource_type` | `resourceType` | text | Yes | — |
| `resource_id` | `resourceId` | text | No | — |
| `outcome` | `outcome` | text | Yes | default "success" |
| `request_id` | `requestId` | text | No | — |
| `metadata` | `metadata` | jsonb | Yes | default {} |
| `ip_address` | `ipAddress` | text | No | — |
| `user_agent` | `userAgent` | text | No | — |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |

Table constraints/indexes: index: `audit_logs_store_created_at_idx`; index: `audit_logs_actor_created_at_idx`; index: `audit_logs_action_created_at_idx`; check: `audit_logs_outcome_valid`.

### bundle-components

SQL table: `bundle_components`. Model: `bundleComponentsTable` in [bundle-component.schema.ts](../backend/src/db/schema/bundle-component.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `bundle_product_id` | `bundleProductId` | integer | Yes | FK products.id; delete cascade |
| `component_product_id` | `componentProductId` | integer | Yes | FK products.id |
| `quantity` | `quantity` | integer | Yes | — |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |
| `updated_at` | `updatedAt` | timestamptz | Yes | default now() |

Table constraints/indexes: unique: `bundle_components_bundle_product_unique`; index: `bundle_components_component_product_idx`; check: `bundle_components_quantity_positive`; check: `bundle_components_distinct_products`.

### cart

SQL table: `cart`. Model: `cartTable` in [cart.schema.ts](../backend/src/db/schema/cart.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `user_id` | `userId` | integer | Yes | FK users.id |
| `total_paise` | `totalPaise` | integer | Yes | default 0 |
| `store_id` | `storeId` | integer | No | FK stores.id |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |
| `updated_at` | `updatedAt` | timestamptz | Yes | default now() |

Table constraints/indexes: check: `cart_total_paise_nonnegative`.

### cart-items

SQL table: `cart_items`. Model: `cartItemsTable` in [cart.schema.ts](../backend/src/db/schema/cart.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `cart_id` | `cartId` | integer | Yes | FK cart.id; delete cascade |
| `product_id` | `productId` | integer | Yes | FK products.id |
| `quantity` | `quantity` | integer | Yes | default 1 |
| `price_paise` | `pricePaise` | integer | Yes | default 0 |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |
| `updated_at` | `updatedAt` | timestamptz | Yes | default now() |

Table constraints/indexes: check: `cart_items_price_paise_nonnegative`.

### cart-item-customizations

SQL table: `cart_item_customizations`. Model: `cartItemCustomizationsTable` in [cart.schema.ts](../backend/src/db/schema/cart.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `cart_item_id` | `cartItemId` | integer | Yes | FK cart_items.id; delete cascade |
| `customization_option_id` | `customizationOptionId` | integer | Yes | FK customization_options.id |
| `price_paise` | `pricePaise` | integer | Yes | — |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |
| `updated_at` | `updatedAt` | timestamptz | Yes | default now() |

Table constraints/indexes: check: `cart_item_customizations_price_paise_nonnegative`.

### cash-sessions

SQL table: `cash_sessions`. Model: `cashSessionsTable` in [cash.schema.ts](../backend/src/db/schema/cash.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `store_id` | `storeId` | integer | Yes | FK stores.id |
| `business_date` | `businessDate` | date | Yes | — |
| `status` | `status` | text | Yes | default "open" |
| `currency` | `currency` | text | Yes | default "INR" |
| `opening_float_paise` | `openingFloatPaise` | integer | Yes | — |
| `expected_cash_paise` | `expectedCashPaise` | integer | Yes | — |
| `counted_cash_paise` | `countedCashPaise` | integer | No | — |
| `variance_paise` | `variancePaise` | integer | No | — |
| `material_variance_acknowledged` | `materialVarianceAcknowledged` | boolean | Yes | default false |
| `version` | `version` | integer | Yes | default 1 |
| `opened_by` | `openedBy` | integer | Yes | FK users.id |
| `opened_at` | `openedAt` | timestamptz | Yes | — |
| `closed_by` | `closedBy` | integer | No | FK users.id |
| `closed_at` | `closedAt` | timestamptz | No | — |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |
| `updated_at` | `updatedAt` | timestamptz | Yes | default now() |

Table constraints/indexes: unique: `cash_sessions_store_business_date_unique`; unique: `cash_sessions_id_store_unique`; index: `cash_sessions_store_status_date_idx`; check: `cash_sessions_status_valid`; check: `cash_sessions_currency_inr`; check: `cash_sessions_amounts_valid`; check: `cash_sessions_version_positive`; check: `cash_sessions_close_evidence`.

### cash-movements

SQL table: `cash_movements`. Model: `cashMovementsTable` in [cash.schema.ts](../backend/src/db/schema/cash.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `session_id` | `sessionId` | integer | Yes | — |
| `store_id` | `storeId` | integer | Yes | — |
| `type` | `type` | text | Yes | — |
| `amount_paise` | `amountPaise` | integer | Yes | — |
| `order_id` | `orderId` | integer | No | FK orders.id |
| `refund_id` | `refundId` | integer | No | FK refunds.id |
| `reverses_movement_id` | `reversesMovementId` | integer | No | — |
| `reason` | `reason` | text | No | — |
| `recorded_by` | `recordedBy` | integer | No | FK users.id |
| `occurred_at` | `occurredAt` | timestamptz | Yes | — |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |

Table constraints/indexes: unique: `cash_movements_order_unique`; unique: `cash_movements_refund_unique`; unique: `cash_movements_reversal_unique`; index: `cash_movements_session_occurred_idx`; check: `cash_movements_type_valid`; check: `cash_movements_amount_nonzero`; check: `cash_movements_source_valid`; check: `cash_movements_manual_reason`; check: `cash_movements_manual_direction`.

Also declares a composite foreign key; see the source for column order and delete behavior.

### cash-session-closures

SQL table: `cash_session_closures`. Model: `cashSessionClosuresTable` in [cash.schema.ts](../backend/src/db/schema/cash.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `session_id` | `sessionId` | integer | Yes | — |
| `store_id` | `storeId` | integer | Yes | — |
| `session_version` | `sessionVersion` | integer | Yes | — |
| `expected_cash_paise` | `expectedCashPaise` | integer | Yes | — |
| `counted_cash_paise` | `countedCashPaise` | integer | Yes | — |
| `variance_paise` | `variancePaise` | integer | Yes | — |
| `material_variance_acknowledged` | `materialVarianceAcknowledged` | boolean | Yes | default false |
| `closed_by` | `closedBy` | integer | Yes | FK users.id |
| `closed_at` | `closedAt` | timestamptz | Yes | — |
| `reversed_by` | `reversedBy` | integer | No | FK users.id |
| `reversed_at` | `reversedAt` | timestamptz | No | — |
| `reversal_reason` | `reversalReason` | text | No | — |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |

Table constraints/indexes: unique: `cash_session_closures_session_version_unique`; index: `cash_session_closures_session_idx`; check: `cash_session_closures_version_positive`; check: `cash_session_closures_amounts_valid`; check: `cash_session_closures_reversal_evidence`.

Also declares a composite foreign key; see the source for column order and delete behavior.

### categories

SQL table: `categories`. Model: `categoriesTable` in [catalog.schema.ts](../backend/src/db/schema/catalog.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `name` | `name` | text | Yes | unique |
| `featured` | `featured` | boolean | No | default false |
| `is_active` | `isActive` | boolean | Yes | default true |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |
| `updated_at` | `updatedAt` | timestamptz | Yes | default now() |

### products

SQL table: `products`. Model: `productsTable` in [catalog.schema.ts](../backend/src/db/schema/catalog.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `name` | `name` | text | Yes | — |
| `description` | `description` | text | No | — |
| `slug` | `slug` | text | Yes | unique |
| `veg` | `veg` | boolean | No | default false |
| `has_customization` | `hasCustomization` | boolean | Yes | default false |
| `price_paise` | `pricePaise` | integer | Yes | — |
| `image` | `image` | text | Yes | — |
| `product_type` | `productType` | text | Yes | default "single" |
| `is_available` | `isAvailable` | boolean | Yes | default true |
| `category_id` | `categoryId` | integer | Yes | FK categories.id |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |
| `updated_at` | `updatedAt` | timestamptz | Yes | default now() |

Table constraints/indexes: check: `products_price_paise_nonnegative`; check: `products_product_type_valid`.

### chat-sessions

SQL table: `chat_sessions`. Model: `chatSessionsTable` in [chat.schema.ts](../backend/src/db/schema/chat.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `user_id` | `userId` | integer | Yes | FK users.id |
| `subject` | `subject` | text | No | — |
| `status` | `status` | text | Yes | default "open" |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |
| `updated_at` | `updatedAt` | timestamptz | Yes | default now() |

### chat-messages

SQL table: `chat_messages`. Model: `chatMessagesTable` in [chat.schema.ts](../backend/src/db/schema/chat.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `session_id` | `sessionId` | integer | Yes | FK chat_sessions.id |
| `sender_id` | `senderId` | integer | Yes | FK users.id |
| `message` | `message` | text | Yes | — |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |

### customization-groups

SQL table: `customization_groups`. Model: `customizationGroupsTable` in [customization.schema.ts](../backend/src/db/schema/customization.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `name` | `name` | text | Yes | — |
| `type` | `type` | text | Yes | — |
| `required` | `required` | boolean | Yes | default false |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |
| `updated_at` | `updatedAt` | timestamptz | Yes | default now() |

### customization-options

SQL table: `customization_options`. Model: `customizationOptionsTable` in [customization.schema.ts](../backend/src/db/schema/customization.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `group_id` | `groupId` | integer | Yes | FK customization_groups.id |
| `name` | `name` | text | Yes | — |
| `price_paise` | `pricePaise` | integer | Yes | default 0 |
| `is_available` | `isAvailable` | boolean | Yes | default true |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |
| `updated_at` | `updatedAt` | timestamptz | Yes | default now() |

Table constraints/indexes: check: `customization_options_price_paise_nonnegative`.

### product-customization-group-mapping

SQL table: `product_customization_group_mapping`. Model: `productCustomizationGroupMappingTable` in [customization.schema.ts](../backend/src/db/schema/customization.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `product_id` | `productId` | integer | Yes | FK products.id |
| `group_id` | `groupId` | integer | Yes | FK customization_groups.id |

### expenses

SQL table: `expenses`. Model: `expensesTable` in [expense.schema.ts](../backend/src/db/schema/expense.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `store_id` | `storeId` | integer | Yes | FK stores.id |
| `vendor_id` | `vendorId` | integer | No | FK vendors.id |
| `vendor_name` | `vendorName` | text | No | — |
| `expense_date` | `expenseDate` | date | Yes | — |
| `description` | `description` | text | Yes | — |
| `subtotal_paise` | `subtotalPaise` | integer | Yes | — |
| `tax_paise` | `taxPaise` | integer | Yes | default 0 |
| `total_paise` | `totalPaise` | integer | Yes | — |
| `currency` | `currency` | text | Yes | default "INR" |
| `status` | `status` | text | Yes | default "draft" |
| `payment_method` | `paymentMethod` | text | No | — |
| `payment_reference` | `paymentReference` | text | No | — |
| `client_request_id` | `clientRequestId` | text | Yes | unique |
| `payload_hash` | `payloadHash` | text | Yes | — |
| `version` | `version` | integer | Yes | default 1 |
| `created_by` | `createdBy` | integer | Yes | FK users.id |
| `updated_by` | `updatedBy` | integer | Yes | FK users.id |
| `submitted_by` | `submittedBy` | integer | No | FK users.id |
| `submitted_at` | `submittedAt` | timestamptz | No | — |
| `approved_by` | `approvedBy` | integer | No | FK users.id |
| `approved_at` | `approvedAt` | timestamptz | No | — |
| `rejected_by` | `rejectedBy` | integer | No | FK users.id |
| `rejected_at` | `rejectedAt` | timestamptz | No | — |
| `rejection_reason` | `rejectionReason` | text | No | — |
| `paid_by` | `paidBy` | integer | No | FK users.id |
| `paid_at` | `paidAt` | timestamptz | No | — |
| `posted_by` | `postedBy` | integer | No | FK users.id |
| `posted_at` | `postedAt` | timestamptz | No | — |
| `voided_by` | `voidedBy` | integer | No | FK users.id |
| `voided_at` | `voidedAt` | timestamptz | No | — |
| `void_reason` | `voidReason` | text | No | — |
| `reversed_by` | `reversedBy` | integer | No | FK users.id |
| `reversed_at` | `reversedAt` | timestamptz | No | — |
| `reversal_reason` | `reversalReason` | text | No | — |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |
| `updated_at` | `updatedAt` | timestamptz | Yes | default now() |

Table constraints/indexes: unique: `expenses_id_store_unique`; index: `expenses_store_date_idx`; index: `expenses_store_status_idx`; check: `expenses_status_valid`; check: `expenses_currency_inr`; check: `expenses_amounts_valid`; check: `expenses_description_present`; check: `expenses_payload_hash_valid`; check: `expenses_version_positive`; check: `expenses_payment_method_valid`; check: `expenses_submission_evidence`; check: `expenses_payment_evidence`; check: `expenses_approval_evidence`; check: `expenses_rejection_evidence`; check: `expenses_posting_evidence`; check: `expenses_void_evidence`; check: `expenses_reversal_evidence`.

### expense-allocations

SQL table: `expense_allocations`. Model: `expenseAllocationsTable` in [expense.schema.ts](../backend/src/db/schema/expense.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `expense_id` | `expenseId` | integer | Yes | — |
| `expense_store_id` | `expenseStoreId` | integer | Yes | — |
| `store_id` | `storeId` | integer | Yes | FK stores.id |
| `category_id` | `categoryId` | integer | Yes | FK expense_categories.id |
| `category_name` | `categoryName` | text | Yes | — |
| `category_classification` | `categoryClassification` | text | Yes | — |
| `ledger_account_id` | `ledgerAccountId` | integer | No | FK ledger_accounts.id |
| `cost_center` | `costCenter` | text | No | — |
| `amount_paise` | `amountPaise` | integer | Yes | — |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |

Table constraints/indexes: index: `expense_allocations_store_category_idx`; check: `expense_allocations_amount_positive`; check: `expense_allocations_category_snapshot_valid`; check: `expense_allocations_cost_center_valid`; check: `expense_allocations_ledger_account_positive`.

Also declares a composite foreign key; see the source for column order and delete behavior.

### expense-commands

SQL table: `expense_commands`. Model: `expenseCommandsTable` in [expense.schema.ts](../backend/src/db/schema/expense.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `expense_id` | `expenseId` | integer | Yes | FK expenses.id |
| `action` | `action` | text | Yes | — |
| `idempotency_key` | `idempotencyKey` | text | Yes | unique |
| `payload_hash` | `payloadHash` | text | Yes | — |
| `result_version` | `resultVersion` | integer | Yes | — |
| `actor_id` | `actorId` | integer | Yes | FK users.id |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |

Table constraints/indexes: index: `expense_commands_expense_idx`; check: `expense_commands_action_valid`; check: `expense_commands_payload_hash_valid`; check: `expense_commands_result_version_positive`.

### expense-attachments

SQL table: `expense_attachments`. Model: `expenseAttachmentsTable` in [expense.schema.ts](../backend/src/db/schema/expense.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `expense_id` | `expenseId` | integer | Yes | — |
| `expense_store_id` | `expenseStoreId` | integer | Yes | — |
| `storage_key` | `storageKey` | text | Yes | unique |
| `original_name` | `originalName` | text | Yes | — |
| `media_type` | `mediaType` | text | Yes | — |
| `size_bytes` | `sizeBytes` | integer | Yes | — |
| `sha256` | `sha256` | text | Yes | — |
| `uploaded_by` | `uploadedBy` | integer | Yes | FK users.id |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |

Table constraints/indexes: unique: `expense_attachments_expense_sha_unique`; index: `expense_attachments_expense_idx`; check: `expense_attachments_storage_key_safe`; check: `expense_attachments_original_name_valid`; check: `expense_attachments_media_type_valid`; check: `expense_attachments_size_valid`; check: `expense_attachments_sha256_valid`.

Also declares a composite foreign key; see the source for column order and delete behavior.

### financial-outbox

SQL table: `financial_outbox`. Model: `financialOutboxTable` in [financial-outbox.schema.ts](../backend/src/db/schema/financial-outbox.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `event_id` | `eventId` | text | Yes | unique |
| `event_type` | `eventType` | text | Yes | — |
| `schema_version` | `schemaVersion` | integer | Yes | — |
| `source_type` | `sourceType` | text | Yes | — |
| `source_id` | `sourceId` | text | Yes | — |
| `source_version` | `sourceVersion` | integer | Yes | — |
| `store_id` | `storeId` | integer | Yes | FK stores.id |
| `currency` | `currency` | text | Yes | default "INR" |
| `occurred_at` | `occurredAt` | timestamptz | Yes | — |
| `business_date` | `businessDate` | text | Yes | — |
| `timezone` | `timezone` | text | Yes | — |
| `actor_id` | `actorId` | integer | No | FK users.id |
| `correlation_id` | `correlationId` | text | No | — |
| `causation_id` | `causationId` | text | No | — |
| `payload` | `payload` | jsonb | Yes | — |
| `payload_hash` | `payloadHash` | text | Yes | — |
| `status` | `status` | text | Yes | default "pending" |
| `attempt_count` | `attemptCount` | integer | Yes | default 0 |
| `available_at` | `availableAt` | timestamptz | Yes | default now() |
| `claimed_at` | `claimedAt` | timestamptz | No | — |
| `claimed_by` | `claimedBy` | text | No | — |
| `processed_at` | `processedAt` | timestamptz | No | — |
| `last_error` | `lastError` | text | No | — |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |
| `updated_at` | `updatedAt` | timestamptz | Yes | default now() |

Table constraints/indexes: unique: `financial_outbox_source_event_version_unique`; index: `financial_outbox_claim_idx`; index: `financial_outbox_store_occurred_idx`; check: `financial_outbox_event_id_present`; check: `financial_outbox_event_type_present`; check: `financial_outbox_source_present`; check: `financial_outbox_versions_positive`; check: `financial_outbox_currency_inr`; check: `financial_outbox_business_date_valid`; check: `financial_outbox_timezone_present`; check: `financial_outbox_payload_hash_valid`; check: `financial_outbox_status_valid`; check: `financial_outbox_attempts_nonnegative`; check: `financial_outbox_claim_evidence`; check: `financial_outbox_processed_evidence`.

### inventory-reservations

SQL table: `inventory_reservations`. Model: `inventoryReservationsTable` in [inventory.schema.ts](../backend/src/db/schema/inventory.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `order_id` | `orderId` | integer | Yes | FK orders.id |
| `store_product_id` | `storeProductId` | integer | Yes | FK store_products.id |
| `quantity` | `quantity` | integer | Yes | — |
| `status` | `status` | text | Yes | default "reserved" |
| `expires_at` | `expiresAt` | timestamptz | Yes | — |
| `consumed_at` | `consumedAt` | timestamptz | No | — |
| `released_at` | `releasedAt` | timestamptz | No | — |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |
| `updated_at` | `updatedAt` | timestamptz | Yes | default now() |

Table constraints/indexes: unique: `inventory_reservations_order_store_product_unique`; index: `inventory_reservations_store_product_status_idx`; index: `inventory_reservations_status_expires_at_idx`; check: `inventory_reservations_quantity_positive`; check: `inventory_reservations_status_valid`.

### inventory-movements

SQL table: `inventory_movements`. Model: `inventoryMovementsTable` in [inventory.schema.ts](../backend/src/db/schema/inventory.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `store_product_id` | `storeProductId` | integer | Yes | FK store_products.id |
| `change_type` | `changeType` | text | Yes | — |
| `quantity_change` | `quantityChange` | integer | Yes | — |
| `previous_quantity` | `previousQuantity` | integer | Yes | — |
| `new_quantity` | `newQuantity` | integer | Yes | — |
| `reason` | `reason` | text | No | — |
| `order_id` | `orderId` | integer | No | FK orders.id |
| `idempotency_key` | `idempotencyKey` | text | No | — |
| `created_by` | `createdBy` | integer | No | FK users.id; delete set null |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |

Table constraints/indexes: unique: `inventory_movements_idempotency_key_unique`; index: `inventory_movements_store_product_created_at_idx`; index: `inventory_movements_order_change_type_idx`; check: `inventory_movements_change_type_valid`; check: `inventory_movements_quantity_equation_valid`; check: `inventory_movements_quantities_nonnegative`; check: `inventory_movements_adjustment_reason_required`.

### ledger-accounts

SQL table: `ledger_accounts`. Model: `ledgerAccountsTable` in [ledger.schema.ts](../backend/src/db/schema/ledger.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `code` | `code` | text | Yes | — |
| `name` | `name` | text | Yes | — |
| `type` | `type` | text | Yes | — |
| `normal_side` | `normalSide` | text | Yes | — |
| `parent_id` | `parentId` | integer | No | — |
| `currency` | `currency` | text | Yes | default "INR" |
| `is_system` | `isSystem` | boolean | Yes | default false |
| `is_active` | `isActive` | boolean | Yes | default true |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |
| `updated_at` | `updatedAt` | timestamptz | Yes | default now() |

Table constraints/indexes: unique: `ledger_accounts_code_unique`; index: `ledger_accounts_parent_idx`; index: `ledger_accounts_active_code_idx`; check: `ledger_accounts_code_valid`; check: `ledger_accounts_name_present`; check: `ledger_accounts_type_valid`; check: `ledger_accounts_normal_side_valid`; check: `ledger_accounts_type_side_valid`; check: `ledger_accounts_currency_inr`; check: `ledger_accounts_parent_not_self`.

Also declares a composite foreign key; see the source for column order and delete behavior.

### journal-entries

SQL table: `journal_entries`. Model: `journalEntriesTable` in [ledger.schema.ts](../backend/src/db/schema/ledger.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `store_id` | `storeId` | integer | Yes | FK stores.id |
| `journal_number` | `journalNumber` | text | Yes | — |
| `business_date` | `businessDate` | date | Yes | — |
| `occurred_at` | `occurredAt` | timestamptz | Yes | — |
| `description` | `description` | text | Yes | — |
| `currency` | `currency` | text | Yes | default "INR" |
| `source_type` | `sourceType` | text | Yes | — |
| `source_id` | `sourceId` | text | Yes | — |
| `event_type` | `eventType` | text | Yes | — |
| `source_version` | `sourceVersion` | integer | Yes | — |
| `command_hash` | `commandHash` | text | Yes | — |
| `status` | `status` | text | Yes | default "draft" |
| `posted_by` | `postedBy` | integer | No | FK users.id |
| `posted_at` | `postedAt` | timestamptz | No | — |
| `reversal_of_journal_entry_id` | `reversalOfJournalEntryId` | integer | No | — |
| `reversal_reason` | `reversalReason` | text | No | — |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |
| `updated_at` | `updatedAt` | timestamptz | Yes | default now() |

Table constraints/indexes: unique: `journal_entries_store_number_unique`; unique: `journal_entries_source_identity_unique`; unique: `journal_entries_reversal_unique`; unique: `journal_entries_id_store_unique`; index: `journal_entries_store_date_idx`; index: `journal_entries_store_status_idx`; index: `journal_entries_finance_report_idx`; check: `journal_entries_number_present`; check: `journal_entries_description_present`; check: `journal_entries_source_present`; check: `journal_entries_source_version_positive`; check: `journal_entries_command_hash_valid`; check: `journal_entries_currency_inr`; check: `journal_entries_status_valid`; check: `journal_entries_posting_evidence`; check: `journal_entries_reversal_evidence`.

Also declares a composite foreign key; see the source for column order and delete behavior.

### journal-lines

SQL table: `journal_lines`. Model: `journalLinesTable` in [ledger.schema.ts](../backend/src/db/schema/ledger.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `journal_entry_id` | `journalEntryId` | integer | Yes | FK journal_entries.id; delete cascade |
| `line_number` | `lineNumber` | integer | Yes | — |
| `account_id` | `accountId` | integer | Yes | FK ledger_accounts.id |
| `debit_paise` | `debitPaise` | integer | Yes | default 0 |
| `credit_paise` | `creditPaise` | integer | Yes | default 0 |
| `description` | `description` | text | No | — |
| `order_id` | `orderId` | integer | No | — |
| `payment_attempt_id` | `paymentAttemptId` | integer | No | — |
| `refund_id` | `refundId` | integer | No | — |
| `expense_id` | `expenseId` | integer | No | — |
| `pay_run_id` | `payRunId` | integer | No | — |
| `dimensions` | `dimensions` | jsonb | Yes | default {} |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |

Table constraints/indexes: unique: `journal_lines_entry_line_unique`; index: `journal_lines_account_entry_idx`; index: `journal_lines_order_idx`; index: `journal_lines_payment_attempt_idx`; index: `journal_lines_refund_idx`; index: `journal_lines_expense_idx`; check: `journal_lines_line_number_positive`; check: `journal_lines_exactly_one_side`; check: `journal_lines_description_valid`.

### fiscal-periods

SQL table: `fiscal_periods`. Model: `fiscalPeriodsTable` in [ledger.schema.ts](../backend/src/db/schema/ledger.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `store_id` | `storeId` | integer | Yes | FK stores.id |
| `name` | `name` | text | Yes | — |
| `start_date` | `startDate` | date | Yes | — |
| `end_date` | `endDate` | date | Yes | — |
| `status` | `status` | text | Yes | default "open" |
| `soft_closed_by` | `softClosedBy` | integer | No | FK users.id |
| `soft_closed_at` | `softClosedAt` | timestamptz | No | — |
| `closed_by` | `closedBy` | integer | No | FK users.id |
| `closed_at` | `closedAt` | timestamptz | No | — |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |
| `updated_at` | `updatedAt` | timestamptz | Yes | default now() |

Table constraints/indexes: unique: `fiscal_periods_store_range_unique`; index: `fiscal_periods_store_dates_idx`; index: `fiscal_periods_store_status_idx`; check: `fiscal_periods_name_present`; check: `fiscal_periods_range_valid`; check: `fiscal_periods_status_valid`; check: `fiscal_periods_soft_close_evidence`; check: `fiscal_periods_close_evidence`.

### menu-items

SQL table: `menu_items`. Model: `menuItemsTable` in [menu.schema.ts](../backend/src/db/schema/menu.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `name` | `name` | text | Yes | — |
| `position` | `position` | integer | Yes | unique |
| `image` | `image` | text | Yes | — |
| `slug` | `slug` | text | Yes | unique |
| `is_active` | `isActive` | boolean | Yes | default true |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |
| `updated_at` | `updatedAt` | timestamptz | Yes | default now() |

### menu-items-mapping

SQL table: `menu_items_mapping`. Model: `menuItemsMappingTable` in [menu.schema.ts](../backend/src/db/schema/menu.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `menu_item_id` | `menuItemId` | integer | Yes | FK menu_items.id |
| `product_id` | `productId` | integer | Yes | FK products.id |

### orders

SQL table: `orders`. Model: `ordersTable` in [order.schema.ts](../backend/src/db/schema/order.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `user_id` | `userId` | integer | Yes | FK users.id |
| `order_date` | `orderDate` | timestamptz | No | default now() |
| `discount_mode` | `discountMode` | text | Yes | default "none" |
| `items_subtotal_paise` | `itemsSubtotalPaise` | integer | Yes | — |
| `discount_paise` | `discountPaise` | integer | Yes | — |
| `delivery_fee_paise` | `deliveryFeePaise` | integer | Yes | — |
| `taxable_amount_paise` | `taxableAmountPaise` | integer | Yes | — |
| `tax_paise` | `taxPaise` | integer | Yes | — |
| `rounding_adjustment_paise` | `roundingAdjustmentPaise` | integer | Yes | — |
| `grand_total_paise` | `grandTotalPaise` | integer | Yes | — |
| `currency` | `currency` | text | Yes | — |
| `quote_version` | `quoteVersion` | text | Yes | — |
| `pricing_policy_version` | `pricingPolicyVersion` | integer | Yes | — |
| `delivery_pricing_rule_id` | `deliveryPricingRuleId` | integer | Yes | FK delivery_pricing_rules.id |
| `delivery_pricing_rule_version` | `deliveryPricingRuleVersion` | integer | Yes | — |
| `pricing_business_date` | `pricingBusinessDate` | text | Yes | — |
| `pricing_timezone` | `pricingTimezone` | text | Yes | — |
| `tax_calculation_policy_version` | `taxCalculationPolicyVersion` | integer | Yes | — |
| `tax_disclaimer` | `taxDisclaimer` | text | Yes | — |
| `tax_is_demo` | `taxIsDemo` | boolean | Yes | — |
| `place_of_supply_state` | `placeOfSupplyState` | text | Yes | — |
| `delivery_tax_rule_id` | `deliveryTaxRuleId` | integer | Yes | FK tax_rules.id |
| `delivery_tax_rule_version` | `deliveryTaxRuleVersion` | integer | Yes | — |
| `delivery_tax_rate_bps` | `deliveryTaxRateBps` | integer | Yes | — |
| `delivery_taxable_amount_paise` | `deliveryTaxableAmountPaise` | integer | Yes | — |
| `delivery_tax_paise` | `deliveryTaxPaise` | integer | Yes | — |
| `delivery_hsn_sac_code` | `deliveryHsnSacCode` | text | Yes | — |
| `recognized_at` | `recognizedAt` | timestamptz | No | — |
| `cancelled_at` | `cancelledAt` | timestamptz | No | — |
| `delivered_at` | `deliveredAt` | timestamptz | No | — |
| `status` | `status` | text | Yes | default "pending" |
| `payment_type` | `paymentType` | text | Yes | default "cash" |
| `payment_id` | `paymentId` | integer | No | unique; FK payments.id |
| `address_id` | `addressId` | integer | No | FK addresses.id |
| `store_id` | `storeId` | integer | Yes | FK stores.id |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |
| `updated_at` | `updatedAt` | timestamptz | Yes | default now() |

Table constraints/indexes: check: `orders_exact_amounts_nonnegative`; check: `orders_discount_within_subtotal`; check: `orders_grand_total_reconciles`; check: `orders_inclusive_tax_reconciles`; check: `orders_currency_inr`; check: `orders_quote_version_present`; check: `orders_pricing_policy_version_positive`; check: `orders_delivery_pricing_rule_version_positive`; check: `orders_pricing_business_date_valid`; check: `orders_pricing_timezone_present`; check: `orders_tax_metadata_valid`; check: `orders_delivery_tax_snapshot_valid`; check: `orders_status_valid`; check: `orders_discount_mode_valid`.

### order-items

SQL table: `order_items`. Model: `orderItemsTable` in [order.schema.ts](../backend/src/db/schema/order.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `order_id` | `orderId` | integer | Yes | FK orders.id |
| `product_id` | `productId` | integer | Yes | FK products.id |
| `quantity` | `quantity` | integer | Yes | default 1 |
| `product_name` | `productName` | text | Yes | — |
| `product_type` | `productType` | text | Yes | default "single" |
| `unit_price_paise` | `unitPricePaise` | integer | Yes | — |
| `compare_at_unit_price_paise` | `compareAtUnitPricePaise` | integer | No | — |
| `bundle_markdown_paise` | `bundleMarkdownPaise` | integer | Yes | default 0 |
| `line_subtotal_paise` | `lineSubtotalPaise` | integer | Yes | — |
| `discount_allocation_paise` | `discountAllocationPaise` | integer | Yes | — |
| `tax_rule_id` | `taxRuleId` | integer | Yes | FK tax_rules.id |
| `tax_rule_version` | `taxRuleVersion` | integer | Yes | — |
| `tax_rate_bps` | `taxRateBps` | integer | Yes | — |
| `taxable_amount_paise` | `taxableAmountPaise` | integer | Yes | — |
| `tax_paise` | `taxPaise` | integer | Yes | — |
| `line_total_paise` | `lineTotalPaise` | integer | Yes | — |
| `unit_cost_paise` | `unitCostPaise` | integer | No | — |
| `line_cost_paise` | `lineCostPaise` | integer | No | — |
| `cost_version_id` | `costVersionId` | integer | No | FK product_cost_versions.id |
| `hsn_sac_code` | `hsnSacCode` | text | Yes | — |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |
| `updated_at` | `updatedAt` | timestamptz | Yes | default now() |

Table constraints/indexes: unique: `order_items_refund_scope_unique`; check: `order_items_quantity_positive`; check: `order_items_snapshot_name_present`; check: `order_items_price_amounts_nonnegative`; check: `order_items_product_type_valid`; check: `order_items_bundle_snapshot_valid`; check: `order_items_tax_rate_valid`; check: `order_items_subtotal_reconciles`; check: `order_items_discount_within_subtotal`; check: `order_items_line_total_reconciles`; check: `order_items_inclusive_tax_reconciles`; check: `order_items_cost_snapshot_complete`; check: `order_items_cost_amounts_valid`; check: `order_items_hsn_sac_code_present`.

### order-item-customizations

SQL table: `order_item_customizations`. Model: `orderItemCustomizationsTable` in [order.schema.ts](../backend/src/db/schema/order.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `order_item_id` | `orderItemId` | integer | Yes | FK order_items.id |
| `customization_option_id` | `customizationOptionId` | integer | Yes | FK customization_options.id |
| `customization_name` | `customizationName` | text | Yes | — |
| `price_paise` | `pricePaise` | integer | Yes | — |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |
| `updated_at` | `updatedAt` | timestamptz | Yes | default now() |

Table constraints/indexes: check: `order_item_customizations_name_present`; check: `order_item_customizations_price_nonnegative`.

### order-item-bundle-components

SQL table: `order_item_bundle_components`. Model: `orderItemBundleComponentsTable` in [order.schema.ts](../backend/src/db/schema/order.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `order_item_id` | `orderItemId` | integer | Yes | FK order_items.id; delete cascade |
| `component_product_id` | `componentProductId` | integer | Yes | FK products.id |
| `component_name` | `componentName` | text | Yes | — |
| `quantity_per_bundle` | `quantityPerBundle` | integer | Yes | — |
| `total_quantity` | `totalQuantity` | integer | Yes | — |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |
| `updated_at` | `updatedAt` | timestamptz | Yes | default now() |

Table constraints/indexes: unique: `order_item_bundle_components_item_product_unique`; check: `order_item_bundle_components_name_present`; check: `order_item_bundle_components_quantities_positive`.

### payment-attempts

SQL table: `payment_attempts`. Model: `paymentAttemptsTable` in [payment-attempt.schema.ts](../backend/src/db/schema/payment-attempt.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `order_id` | `orderId` | integer | Yes | FK orders.id |
| `store_id` | `storeId` | integer | Yes | FK stores.id |
| `provider` | `provider` | text | Yes | default "cod" |
| `method` | `method` | text | No | — |
| `status` | `status` | text | Yes | default "pending" |
| `provider_status` | `providerStatus` | text | No | — |
| `amount_paise` | `amountPaise` | integer | Yes | default 0 |
| `currency` | `currency` | text | Yes | default "INR" |
| `provider_order_id` | `providerOrderId` | text | No | unique |
| `provider_payment_id` | `providerPaymentId` | text | No | unique |
| `client_request_id` | `clientRequestId` | text | No | unique |
| `failure_code` | `failureCode` | text | No | — |
| `failure_description` | `failureDescription` | text | No | — |
| `authorized_at` | `authorizedAt` | timestamptz | No | — |
| `captured_at` | `capturedAt` | timestamptz | No | — |
| `failed_at` | `failedAt` | timestamptz | No | — |
| `expires_at` | `expiresAt` | timestamptz | No | — |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |
| `updated_at` | `updatedAt` | timestamptz | Yes | default now() |

Table constraints/indexes: index: `payment_attempts_order_id_idx`; index: `payment_attempts_store_id_idx`; index: `payment_attempts_status_idx`; unique: `payment_attempts_refund_scope_unique`; check: `payment_attempts_amount_paise_nonnegative`; check: `payment_attempts_provider_valid`; check: `payment_attempts_status_valid`; check: `payment_attempts_currency_inr`; check: `payment_attempts_method_valid`.

### payment-webhook-events

SQL table: `payment_webhook_events`. Model: `paymentWebhookEventsTable` in [payment-event.schema.ts](../backend/src/db/schema/payment-event.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `event_id` | `eventId` | text | Yes | unique |
| `event_type` | `eventType` | text | Yes | — |
| `status` | `status` | text | Yes | default "processing" |
| `attempts` | `attempts` | integer | Yes | default 1 |
| `last_error` | `lastError` | text | No | — |
| `processed_at` | `processedAt` | timestamptz | No | — |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |
| `updated_at` | `updatedAt` | timestamptz | Yes | default now() |

Table constraints/indexes: index: `payment_webhook_events_status_idx`; check: `payment_webhook_events_status_valid`; check: `payment_webhook_events_attempts_positive`.

### payments

SQL table: `payments`. Model: `paymentsTable` in [payment.schema.ts](../backend/src/db/schema/payment.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `provider` | `provider` | text | Yes | default "cod" |
| `status` | `status` | text | Yes | default "pending" |
| `provider_status` | `providerStatus` | text | No | — |
| `amount_paise` | `amountPaise` | integer | Yes | default 0 |
| `currency` | `currency` | text | Yes | default "INR" |
| `provider_order_id` | `providerOrderId` | text | No | unique |
| `provider_payment_id` | `providerPaymentId` | text | No | unique |
| `client_request_id` | `clientRequestId` | text | No | unique |
| `failure_code` | `failureCode` | text | No | — |
| `failure_description` | `failureDescription` | text | No | — |
| `payment_date` | `paymentDate` | timestamptz | No | — |
| `paid_at` | `paidAt` | timestamptz | No | — |
| `failed_at` | `failedAt` | timestamptz | No | — |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |
| `updated_at` | `updatedAt` | timestamptz | Yes | default now() |

Table constraints/indexes: index: `payments_status_idx`; check: `payments_amount_paise_nonnegative`; check: `payments_provider_valid`; check: `payments_currency_inr`.

### employee-finance-profiles

SQL table: `employee_finance_profiles`. Model: `employeeFinanceProfilesTable` in [payroll.schema.ts](../backend/src/db/schema/payroll.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `store_id` | `storeId` | integer | Yes | FK stores.id |
| `user_id` | `userId` | integer | No | FK users.id; delete set null |
| `employee_code` | `employeeCode` | text | Yes | — |
| `display_name` | `displayName` | text | Yes | — |
| `employment_start_date` | `employmentStartDate` | date | Yes | — |
| `employment_end_date` | `employmentEndDate` | date | No | — |
| `status` | `status` | text | Yes | default "active" |
| `pay_frequency` | `payFrequency` | text | Yes | default "monthly" |
| `bank_account_encrypted` | `bankAccountEncrypted` | text | No | — |
| `bank_account_last4` | `bankAccountLast4` | text | No | — |
| `tax_identifier_encrypted` | `taxIdentifierEncrypted` | text | No | — |
| `tax_identifier_last4` | `taxIdentifierLast4` | text | No | — |
| `created_by` | `createdBy` | integer | No | FK users.id; delete set null |
| `updated_by` | `updatedBy` | integer | No | FK users.id; delete set null |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |
| `updated_at` | `updatedAt` | timestamptz | Yes | default now() |

Table constraints/indexes: unique: `employee_finance_profiles_id_store_unique`; unique: `employee_finance_profiles_store_code_unique`; uniqueIndex: `employee_finance_profiles_store_user_unique`; index: `employee_finance_profiles_store_status_idx`; check: `employee_finance_profiles_code_present`; check: `employee_finance_profiles_name_present`; check: `employee_finance_profiles_dates_valid`; check: `employee_finance_profiles_status_valid`; check: `employee_finance_profiles_terminated_date`; check: `employee_finance_profiles_frequency_valid`; check: `employee_finance_profiles_bank_pair`; check: `employee_finance_profiles_tax_pair`; check: `employee_finance_profiles_bank_last4`; check: `employee_finance_profiles_tax_last4`.

### compensation-versions

SQL table: `compensation_versions`. Model: `compensationVersionsTable` in [payroll.schema.ts](../backend/src/db/schema/payroll.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `profile_id` | `profileId` | integer | Yes | — |
| `store_id` | `storeId` | integer | Yes | — |
| `effective_from` | `effectiveFrom` | date | Yes | — |
| `effective_to` | `effectiveTo` | date | No | — |
| `currency` | `currency` | text | Yes | default "INR" |
| `source_note` | `sourceNote` | text | No | — |
| `demo_only` | `demoOnly` | boolean | Yes | default true |
| `created_by` | `createdBy` | integer | No | FK users.id; delete set null |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |

Table constraints/indexes: unique: `compensation_versions_profile_from_unique`; unique: `compensation_versions_id_profile_store_unique`; index: `compensation_versions_profile_effective_idx`; check: `compensation_versions_range_valid`; check: `compensation_versions_currency_inr`; check: `compensation_versions_demo_only`; check: `compensation_versions_source_note_length`.

Also declares a composite foreign key; see the source for column order and delete behavior.

### compensation-components

SQL table: `compensation_components`. Model: `compensationComponentsTable` in [payroll.schema.ts](../backend/src/db/schema/payroll.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `compensation_version_id` | `compensationVersionId` | integer | Yes | FK compensation_versions.id; delete cascade |
| `type` | `type` | text | Yes | — |
| `code` | `code` | text | Yes | — |
| `name` | `name` | text | Yes | — |
| `amount_paise` | `amountPaise` | integer | Yes | — |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |

Table constraints/indexes: unique: `compensation_components_version_type_code_unique`; index: `compensation_components_version_idx`; check: `compensation_components_type_valid`; check: `compensation_components_code_valid`; check: `compensation_components_name_present`; check: `compensation_components_amount_positive`.

### pay-runs

SQL table: `pay_runs`. Model: `payRunsTable` in [payroll.schema.ts](../backend/src/db/schema/payroll.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `store_id` | `storeId` | integer | Yes | FK stores.id |
| `period_start` | `periodStart` | date | Yes | — |
| `period_end` | `periodEnd` | date | Yes | — |
| `status` | `status` | text | Yes | default "draft" |
| `currency` | `currency` | text | Yes | default "INR" |
| `demo_only` | `demoOnly` | boolean | Yes | default true |
| `employee_count` | `employeeCount` | integer | No | — |
| `gross_pay_paise` | `grossPayPaise` | integer | No | — |
| `deduction_paise` | `deductionPaise` | integer | No | — |
| `net_pay_paise` | `netPayPaise` | integer | No | — |
| `employer_cost_paise` | `employerCostPaise` | integer | No | — |
| `total_employer_cost_paise` | `totalEmployerCostPaise` | integer | No | — |
| `client_request_id` | `clientRequestId` | text | Yes | — |
| `payload_hash` | `payloadHash` | text | Yes | — |
| `version` | `version` | integer | Yes | default 1 |
| `created_by` | `createdBy` | integer | No | FK users.id; delete set null |
| `calculated_by` | `calculatedBy` | integer | No | FK users.id; delete set null |
| `calculated_at` | `calculatedAt` | timestamptz | No | — |
| `approved_by` | `approvedBy` | integer | No | FK users.id; delete set null |
| `approved_at` | `approvedAt` | timestamptz | No | — |
| `paid_by` | `paidBy` | integer | No | FK users.id; delete set null |
| `paid_at` | `paidAt` | timestamptz | No | — |
| `payment_reference` | `paymentReference` | text | No | — |
| `posted_by` | `postedBy` | integer | No | FK users.id; delete set null |
| `posted_at` | `postedAt` | timestamptz | No | — |
| `voided_by` | `voidedBy` | integer | No | FK users.id; delete set null |
| `voided_at` | `voidedAt` | timestamptz | No | — |
| `void_reason` | `voidReason` | text | No | — |
| `reversed_by` | `reversedBy` | integer | No | FK users.id; delete set null |
| `reversed_at` | `reversedAt` | timestamptz | No | — |
| `reversal_reason` | `reversalReason` | text | No | — |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |
| `updated_at` | `updatedAt` | timestamptz | Yes | default now() |

Table constraints/indexes: unique: `pay_runs_id_store_unique`; unique: `pay_runs_store_period_unique`; unique: `pay_runs_client_request_unique`; index: `pay_runs_store_period_status_idx`; check: `pay_runs_period_valid`; check: `pay_runs_monthly_period`; check: `pay_runs_status_valid`; check: `pay_runs_currency_inr`; check: `pay_runs_demo_only`; check: `pay_runs_version_positive`; check: `pay_runs_request_uuid`; check: `pay_runs_payload_hash`; check: `pay_runs_totals_complete`; check: `pay_runs_calculation_evidence`; check: `pay_runs_approval_evidence`; check: `pay_runs_payment_evidence`; check: `pay_runs_posting_evidence`; check: `pay_runs_void_evidence`; check: `pay_runs_reversal_evidence`.

### pay-run-employees

SQL table: `pay_run_employees`. Model: `payRunEmployeesTable` in [payroll.schema.ts](../backend/src/db/schema/payroll.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `pay_run_id` | `payRunId` | integer | Yes | — |
| `pay_run_store_id` | `payRunStoreId` | integer | Yes | — |
| `profile_id` | `profileId` | integer | Yes | — |
| `compensation_version_id` | `compensationVersionId` | integer | Yes | — |
| `employee_code` | `employeeCode` | text | Yes | — |
| `display_name` | `displayName` | text | Yes | — |
| `gross_pay_paise` | `grossPayPaise` | integer | Yes | — |
| `deduction_paise` | `deductionPaise` | integer | Yes | — |
| `net_pay_paise` | `netPayPaise` | integer | Yes | — |
| `employer_cost_paise` | `employerCostPaise` | integer | Yes | — |
| `total_employer_cost_paise` | `totalEmployerCostPaise` | integer | Yes | — |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |

Table constraints/indexes: unique: `pay_run_employees_run_profile_unique`; index: `pay_run_employees_run_idx`; check: `pay_run_employees_code_present`; check: `pay_run_employees_name_present`; check: `pay_run_employees_totals_valid`.

Also declares a composite foreign key; see the source for column order and delete behavior.

### pay-run-lines

SQL table: `pay_run_lines`. Model: `payRunLinesTable` in [payroll.schema.ts](../backend/src/db/schema/payroll.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `pay_run_employee_id` | `payRunEmployeeId` | integer | Yes | FK pay_run_employees.id; delete cascade |
| `compensation_component_id` | `compensationComponentId` | integer | Yes | FK compensation_components.id |
| `type` | `type` | text | Yes | — |
| `component_code` | `componentCode` | text | Yes | — |
| `component_name` | `componentName` | text | Yes | — |
| `amount_paise` | `amountPaise` | integer | Yes | — |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |

Table constraints/indexes: unique: `pay_run_lines_employee_type_code_unique`; index: `pay_run_lines_employee_idx`; check: `pay_run_lines_type_valid`; check: `pay_run_lines_code_present`; check: `pay_run_lines_name_present`; check: `pay_run_lines_amount_positive`.

### pay-run-commands

SQL table: `pay_run_commands`. Model: `payRunCommandsTable` in [payroll.schema.ts](../backend/src/db/schema/payroll.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `pay_run_id` | `payRunId` | integer | Yes | FK pay_runs.id; delete cascade |
| `action` | `action` | text | Yes | — |
| `idempotency_key` | `idempotencyKey` | text | Yes | — |
| `payload_hash` | `payloadHash` | text | Yes | — |
| `result_version` | `resultVersion` | integer | Yes | — |
| `actor_id` | `actorId` | integer | No | FK users.id; delete set null |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |

Table constraints/indexes: unique: `pay_run_commands_idempotency_unique`; index: `pay_run_commands_run_action_idx`; check: `pay_run_commands_action_valid`; check: `pay_run_commands_key_uuid`; check: `pay_run_commands_payload_hash`; check: `pay_run_commands_result_version_positive`.

### product-cost-versions

SQL table: `product_cost_versions`. Model: `productCostVersionsTable` in [product-cost.schema.ts](../backend/src/db/schema/product-cost.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `store_product_id` | `storeProductId` | integer | Yes | — |
| `store_id` | `storeId` | integer | Yes | — |
| `unit_cost_paise` | `unitCostPaise` | integer | Yes | — |
| `effective_from` | `effectiveFrom` | date | Yes | — |
| `effective_to` | `effectiveTo` | date | No | — |
| `source` | `source` | text | Yes | — |
| `created_by` | `createdBy` | integer | No | FK users.id |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |

Table constraints/indexes: unique: `product_cost_versions_id_store_unique`; unique: `product_cost_versions_store_product_from_unique`; index: `product_cost_versions_store_product_effective_idx`; check: `product_cost_versions_amount_nonnegative`; check: `product_cost_versions_source_present`; check: `product_cost_versions_range_valid`.

Also declares a composite foreign key; see the source for column order and delete behavior.

### promotion-applications

SQL table: `promotion_applications`. Model: `promotionApplicationsTable` in [promotion-application.schema.ts](../backend/src/db/schema/promotion-application.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `promotion_id` | `promotionId` | integer | Yes | FK promotions.id |
| `order_id` | `orderId` | integer | Yes | FK orders.id |
| `user_id` | `userId` | integer | Yes | FK users.id |
| `store_id` | `storeId` | integer | Yes | FK stores.id |
| `promotion_kind` | `promotionKind` | text | Yes | — |
| `promotion_name` | `promotionName` | text | Yes | — |
| `promotion_code` | `promotionCode` | text | No | — |
| `discount_type` | `discountType` | text | Yes | — |
| `definition_version` | `definitionVersion` | integer | Yes | — |
| `status` | `status` | text | Yes | — |
| `item_discount_paise` | `itemDiscountPaise` | integer | Yes | — |
| `delivery_discount_paise` | `deliveryDiscountPaise` | integer | Yes | — |
| `total_savings_paise` | `totalSavingsPaise` | integer | Yes | — |
| `standard_delivery_fee_paise` | `standardDeliveryFeePaise` | integer | Yes | — |
| `charged_delivery_fee_paise` | `chargedDeliveryFeePaise` | integer | Yes | — |
| `reserved_at` | `reservedAt` | timestamptz | No | — |
| `consumed_at` | `consumedAt` | timestamptz | No | — |
| `released_at` | `releasedAt` | timestamptz | No | — |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |
| `updated_at` | `updatedAt` | timestamptz | Yes | default now() |

Table constraints/indexes: unique: `promotion_applications_order_promotion_unique`; uniqueIndex: `promotion_applications_active_coupon_order_unique`; index: `promotion_applications_capacity_idx`; index: `promotion_applications_user_usage_idx`; index: `promotion_applications_budget_usage_idx`; index: `promotion_applications_store_analytics_idx`; index: `promotion_applications_order_status_idx`; check: `promotion_applications_snapshot_identity_valid`; check: `promotion_applications_status_valid`; check: `promotion_applications_status_timestamps_valid`; check: `promotion_applications_amounts_valid`.

### promotion-discount-allocations

SQL table: `promotion_discount_allocations`. Model: `promotionDiscountAllocationsTable` in [promotion-discount-allocation.schema.ts](../backend/src/db/schema/promotion-discount-allocation.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `promotion_application_id` | `promotionApplicationId` | integer | Yes | FK promotion_applications.id; delete cascade |
| `order_item_id` | `orderItemId` | integer | No | FK order_items.id |
| `component` | `component` | text | Yes | — |
| `unit_index` | `unitIndex` | integer | No | — |
| `amount_paise` | `amountPaise` | integer | Yes | — |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |

Table constraints/indexes: uniqueIndex: `promotion_discount_allocations_item_unit_unique`; uniqueIndex: `promotion_discount_allocations_delivery_unique`; index: `promotion_discount_allocations_order_item_idx`; check: `promotion_discount_allocations_shape_valid`; check: `promotion_discount_allocations_amount_positive`.

### promotion-rules

SQL table: `promotion_rules`. Model: `promotionRulesTable` in [promotion-rule.schema.ts](../backend/src/db/schema/promotion-rule.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `promotion_id` | `promotionId` | integer | Yes | FK promotions.id; delete cascade |
| `rule_type` | `ruleType` | text | Yes | — |
| `product_id` | `productId` | integer | No | FK products.id |
| `category_id` | `categoryId` | integer | No | FK categories.id |
| `quantity` | `quantity` | integer | No | — |
| `tier_min_paise` | `tierMinPaise` | integer | No | — |
| `tier_discount_type` | `tierDiscountType` | text | No | — |
| `tier_discount_rate_bps` | `tierDiscountRateBps` | integer | No | — |
| `tier_discount_amount_paise` | `tierDiscountAmountPaise` | integer | No | — |
| `tier_max_discount_paise` | `tierMaxDiscountPaise` | integer | No | — |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |

Table constraints/indexes: index: `promotion_rules_promotion_type_idx`; index: `promotion_rules_product_target_idx`; index: `promotion_rules_category_target_idx`; uniqueIndex: `promotion_rules_product_target_unique`; uniqueIndex: `promotion_rules_category_target_unique`; uniqueIndex: `promotion_rules_tier_threshold_unique`; check: `promotion_rules_type_valid`; check: `promotion_rules_shape_valid`.

### promotions

SQL table: `promotions`. Model: `promotionsTable` in [promotion.schema.ts](../backend/src/db/schema/promotion.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `kind` | `kind` | text | Yes | — |
| `name` | `name` | text | Yes | — |
| `description` | `description` | text | Yes | — |
| `code` | `code` | text | No | — |
| `discount_type` | `discountType` | text | Yes | — |
| `discount_rate_bps` | `discountRateBps` | integer | No | — |
| `discount_amount_paise` | `discountAmountPaise` | integer | No | — |
| `max_discount_paise` | `maxDiscountPaise` | integer | No | — |
| `minimum_order_paise` | `minimumOrderPaise` | integer | Yes | default 0 |
| `minimum_cart_quantity` | `minimumCartQuantity` | integer | Yes | default 0 |
| `scope` | `scope` | text | Yes | — |
| `include_customization_value` | `includeCustomizationValue` | boolean | Yes | default false |
| `definition_version` | `definitionVersion` | integer | Yes | default 1 |
| `first_order_only` | `firstOrderOnly` | boolean | Yes | default false |
| `per_user_redemption_limit` | `perUserRedemptionLimit` | integer | No | — |
| `active_start_time` | `activeStartTime` | time | No | — |
| `active_end_time` | `activeEndTime` | time | No | — |
| `active_days_of_week` | `activeDaysOfWeek` | integer | No | — |
| `starts_at` | `startsAt` | timestamptz | Yes | — |
| `ends_at` | `endsAt` | timestamptz | Yes | — |
| `max_redemptions` | `maxRedemptions` | integer | No | — |
| `total_discount_budget_paise` | `totalDiscountBudgetPaise` | integer | No | — |
| `display_priority` | `displayPriority` | integer | Yes | default 0 |
| `image_url` | `imageUrl` | text | No | — |
| `mobile_image_url` | `mobileImageUrl` | text | No | — |
| `image_alt` | `imageAlt` | text | No | — |
| `show_on_homepage` | `showOnHomepage` | boolean | Yes | default false |
| `is_active` | `isActive` | boolean | Yes | default true |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |
| `updated_at` | `updatedAt` | timestamptz | Yes | default now() |

Table constraints/indexes: uniqueIndex: `promotions_normalized_code_unique`; index: `promotions_active_discovery_idx`; index: `promotions_capacity_budget_idx`; check: `promotions_kind_valid`; check: `promotions_name_description_valid`; check: `promotions_kind_code_consistency`; check: `promotions_discount_type_valid`; check: `promotions_scope_valid`; check: `promotions_kind_type_scope_valid`; check: `promotions_discount_value_matches_type`; check: `promotions_max_discount_valid`; check: `promotions_customization_value_valid`; check: `promotions_eligibility_amounts_valid`; check: `promotions_limits_valid`; check: `promotions_definition_version_positive`; check: `promotions_validity_range_valid`; check: `promotions_time_window_valid`; check: `promotions_active_days_valid`; check: `promotions_display_priority_nonnegative`; check: `promotions_media_consistency`; check: `promotions_homepage_placement_valid`.

### refunds

SQL table: `refunds`. Model: `refundsTable` in [refund.schema.ts](../backend/src/db/schema/refund.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `order_id` | `orderId` | integer | Yes | — |
| `payment_attempt_id` | `paymentAttemptId` | integer | Yes | — |
| `store_id` | `storeId` | integer | Yes | FK stores.id |
| `amount_paise` | `amountPaise` | integer | Yes | — |
| `currency` | `currency` | text | Yes | default "INR" |
| `status` | `status` | text | Yes | default "requested" |
| `reason_code` | `reasonCode` | text | Yes | — |
| `reason_note` | `reasonNote` | text | No | — |
| `client_request_id` | `clientRequestId` | text | Yes | unique |
| `provider_refund_id` | `providerRefundId` | text | No | unique |
| `provider_status` | `providerStatus` | text | No | — |
| `failure_code` | `failureCode` | text | No | — |
| `failure_description` | `failureDescription` | text | No | — |
| `version` | `version` | integer | Yes | default 1 |
| `requested_by` | `requestedBy` | integer | Yes | FK users.id |
| `approved_by` | `approvedBy` | integer | No | FK users.id |
| `rejected_by` | `rejectedBy` | integer | No | FK users.id |
| `cancelled_by` | `cancelledBy` | integer | No | FK users.id |
| `submitted_by` | `submittedBy` | integer | No | FK users.id |
| `processed_by` | `processedBy` | integer | No | FK users.id |
| `requested_at` | `requestedAt` | timestamptz | Yes | default now() |
| `approved_at` | `approvedAt` | timestamptz | No | — |
| `rejected_at` | `rejectedAt` | timestamptz | No | — |
| `cancelled_at` | `cancelledAt` | timestamptz | No | — |
| `submitted_at` | `submittedAt` | timestamptz | No | — |
| `processed_at` | `processedAt` | timestamptz | No | — |
| `failed_at` | `failedAt` | timestamptz | No | — |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |
| `updated_at` | `updatedAt` | timestamptz | Yes | default now() |

Table constraints/indexes: index: `refunds_store_requested_at_idx`; index: `refunds_order_id_idx`; index: `refunds_payment_attempt_id_idx`; index: `refunds_store_status_idx`; check: `refunds_amount_paise_positive`; check: `refunds_currency_inr`; check: `refunds_status_valid`; check: `refunds_reason_code_present`; check: `refunds_reason_note_valid`; check: `refunds_client_request_id_present`; check: `refunds_provider_refund_id_valid`; check: `refunds_version_positive`; unique: `refunds_allocation_scope_unique`; check: `refunds_actor_timestamp_pairs`; check: `refunds_status_evidence`; check: `refunds_timestamps_ordered`.

Also declares a composite foreign key; see the source for column order and delete behavior.

### refund-allocations

SQL table: `refund_allocations`. Model: `refundAllocationsTable` in [refund.schema.ts](../backend/src/db/schema/refund.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `refund_id` | `refundId` | integer | Yes | — |
| `order_id` | `orderId` | integer | Yes | — |
| `kind` | `kind` | text | Yes | — |
| `order_item_id` | `orderItemId` | integer | No | — |
| `quantity` | `quantity` | integer | No | — |
| `amount_paise` | `amountPaise` | integer | Yes | — |
| `taxable_amount_paise` | `taxableAmountPaise` | integer | Yes | — |
| `tax_paise` | `taxPaise` | integer | Yes | — |
| `discount_reversal_paise` | `discountReversalPaise` | integer | Yes | default 0 |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |

Table constraints/indexes: index: `refund_allocations_refund_id_idx`; index: `refund_allocations_order_item_id_idx`; uniqueIndex: `refund_allocations_item_unique`; uniqueIndex: `refund_allocations_delivery_fee_unique`; check: `refund_allocations_kind_valid`; check: `refund_allocations_target_valid`; check: `refund_allocations_amounts_valid`.

Also declares a composite foreign key; see the source for column order and delete behavior.

### settlement-batches

SQL table: `settlement_batches`. Model: `settlementBatchesTable` in [settlement.schema.ts](../backend/src/db/schema/settlement.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `store_id` | `storeId` | integer | Yes | FK stores.id |
| `provider` | `provider` | text | Yes | default "razorpay" |
| `provider_settlement_id` | `providerSettlementId` | text | Yes | unique |
| `provider_status` | `providerStatus` | text | Yes | — |
| `status` | `status` | text | Yes | default "imported" |
| `source` | `source` | text | Yes | — |
| `period_from` | `periodFrom` | timestamptz | Yes | — |
| `period_to` | `periodTo` | timestamptz | Yes | — |
| `gross_amount_paise` | `grossAmountPaise` | integer | Yes | — |
| `fee_paise` | `feePaise` | integer | Yes | — |
| `fee_tax_paise` | `feeTaxPaise` | integer | Yes | — |
| `adjustment_paise` | `adjustmentPaise` | integer | Yes | default 0 |
| `net_amount_paise` | `netAmountPaise` | integer | Yes | — |
| `currency` | `currency` | text | Yes | default "INR" |
| `utr` | `utr` | text | No | — |
| `provider_reference` | `providerReference` | text | No | — |
| `payload_hash` | `payloadHash` | text | Yes | — |
| `settled_at` | `settledAt` | timestamptz | Yes | — |
| `imported_by` | `importedBy` | integer | Yes | FK users.id |
| `imported_at` | `importedAt` | timestamptz | Yes | default now() |
| `reconciled_at` | `reconciledAt` | timestamptz | No | — |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |
| `updated_at` | `updatedAt` | timestamptz | Yes | default now() |

Table constraints/indexes: unique: `settlement_batches_id_store_unique`; index: `settlement_batches_store_settled_at_idx`; index: `settlement_batches_status_idx`; check: `settlement_batches_provider_valid`; check: `settlement_batches_provider_identity_present`; check: `settlement_batches_source_valid`; check: `settlement_batches_status_valid`; check: `settlement_batches_currency_inr`; check: `settlement_batches_period_valid`; check: `settlement_batches_settled_at_valid`; check: `settlement_batches_amounts_valid`; check: `settlement_batches_payload_hash_valid`; check: `settlement_batches_reconciled_evidence`.

### settlement-lines

SQL table: `settlement_lines`. Model: `settlementLinesTable` in [settlement.schema.ts](../backend/src/db/schema/settlement.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `batch_id` | `batchId` | integer | Yes | — |
| `store_id` | `storeId` | integer | Yes | — |
| `provider_line_id` | `providerLineId` | text | Yes | unique |
| `provider_transaction_id` | `providerTransactionId` | text | Yes | — |
| `provider_entity_id` | `providerEntityId` | text | Yes | — |
| `type` | `type` | text | Yes | — |
| `provider_status` | `providerStatus` | text | Yes | — |
| `amount_paise` | `amountPaise` | integer | Yes | — |
| `fee_paise` | `feePaise` | integer | Yes | default 0 |
| `fee_tax_paise` | `feeTaxPaise` | integer | Yes | default 0 |
| `currency` | `currency` | text | Yes | default "INR" |
| `occurred_at` | `occurredAt` | timestamptz | Yes | — |
| `match_status` | `matchStatus` | text | Yes | default "unmatched" |
| `payment_attempt_id` | `paymentAttemptId` | integer | No | FK payment_attempts.id |
| `refund_id` | `refundId` | integer | No | FK refunds.id |
| `payload_hash` | `payloadHash` | text | Yes | — |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |
| `updated_at` | `updatedAt` | timestamptz | Yes | default now() |

Table constraints/indexes: unique: `settlement_lines_id_store_unique`; index: `settlement_lines_batch_id_idx`; index: `settlement_lines_store_match_idx`; index: `settlement_lines_provider_transaction_idx`; check: `settlement_lines_type_valid`; check: `settlement_lines_provider_identity_present`; check: `settlement_lines_match_status_valid`; check: `settlement_lines_currency_inr`; check: `settlement_lines_amount_nonzero`; check: `settlement_lines_fees_nonnegative`; check: `settlement_lines_payload_hash_valid`; check: `settlement_lines_local_target_valid`; check: `settlement_lines_matched_target_present`.

Also declares a composite foreign key; see the source for column order and delete behavior.

### reconciliation-issues

SQL table: `reconciliation_issues`. Model: `reconciliationIssuesTable` in [settlement.schema.ts](../backend/src/db/schema/settlement.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `store_id` | `storeId` | integer | Yes | FK stores.id |
| `batch_id` | `batchId` | integer | No | — |
| `settlement_line_id` | `settlementLineId` | integer | No | — |
| `payment_attempt_id` | `paymentAttemptId` | integer | No | FK payment_attempts.id |
| `refund_id` | `refundId` | integer | No | FK refunds.id |
| `issue_type` | `issueType` | text | Yes | — |
| `severity` | `severity` | text | Yes | — |
| `status` | `status` | text | Yes | default "open" |
| `owner_user_id` | `ownerUserId` | integer | No | FK users.id |
| `details` | `details` | jsonb | Yes | default {} |
| `resolution_note` | `resolutionNote` | text | No | — |
| `resolved_by` | `resolvedBy` | integer | No | FK users.id |
| `resolved_at` | `resolvedAt` | timestamptz | No | — |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |
| `updated_at` | `updatedAt` | timestamptz | Yes | default now() |

Table constraints/indexes: index: `reconciliation_issues_store_status_idx`; index: `reconciliation_issues_batch_id_idx`; check: `reconciliation_issues_type_valid`; check: `reconciliation_issues_severity_valid`; check: `reconciliation_issues_status_valid`; check: `reconciliation_issues_resolution_valid`.

Also declares a composite foreign key; see the source for column order and delete behavior.

### store-promotion-settings

SQL table: `store_promotion_settings`. Model: `storePromotionSettingsTable` in [store-promotion-setting.schema.ts](../backend/src/db/schema/store-promotion-setting.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `promotion_id` | `promotionId` | integer | Yes | FK promotions.id; delete cascade |
| `store_id` | `storeId` | integer | Yes | FK stores.id; delete cascade |
| `is_enabled` | `isEnabled` | boolean | Yes | default true |
| `updated_by_user_id` | `updatedByUserId` | integer | Yes | FK users.id |
| `disabled_reason` | `disabledReason` | text | No | — |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |
| `updated_at` | `updatedAt` | timestamptz | Yes | default now() |

Table constraints/indexes: unique: `store_promotion_settings_promotion_store_unique`; index: `store_promotion_settings_store_enabled_idx`; check: `store_promotion_settings_reason_valid`.

### stores

SQL table: `stores`. Model: `storesTable` in [store.schema.ts](../backend/src/db/schema/store.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `name` | `name` | text | Yes | — |
| `slug` | `slug` | text | Yes | unique |
| `address` | `address` | text | Yes | — |
| `city` | `city` | text | Yes | — |
| `state` | `state` | text | Yes | — |
| `pincode` | `pincode` | text | Yes | — |
| `phone` | `phone` | text | Yes | — |
| `email` | `email` | text | No | — |
| `latitude` | `latitude` | doublePrecision | No | — |
| `longitude` | `longitude` | doublePrecision | No | — |
| `opens_at` | `opensAt` | text | Yes | — |
| `closes_at` | `closesAt` | text | Yes | — |
| `timezone` | `timezone` | text | Yes | default "Asia/Kolkata" |
| `is_active` | `isActive` | boolean | Yes | default true |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |
| `updated_at` | `updatedAt` | timestamptz | Yes | default now() |

### store-products

SQL table: `store_products`. Model: `storeProductsTable` in [store.schema.ts](../backend/src/db/schema/store.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `store_id` | `storeId` | integer | Yes | FK stores.id |
| `product_id` | `productId` | integer | Yes | FK products.id |
| `price_paise` | `pricePaise` | integer | Yes | — |
| `compare_at_price_paise` | `compareAtPricePaise` | integer | No | — |
| `is_available` | `isAvailable` | boolean | Yes | default true |
| `on_hand_quantity` | `onHandQuantity` | integer | No | — |
| `low_stock_threshold` | `lowStockThreshold` | integer | Yes | default 10 |
| `last_restocked_at` | `lastRestockedAt` | timestamptz | No | — |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |
| `updated_at` | `updatedAt` | timestamptz | Yes | default now() |

Table constraints/indexes: unique: `store_products_id_store_id_unique`; unique: `store_products_store_id_product_id_unique`; check: `store_products_on_hand_quantity_nonnegative`; check: `store_products_low_stock_threshold_nonnegative`; check: `store_products_price_paise_nonnegative`; check: `store_products_compare_at_price_valid`.

### delivery-zones

SQL table: `delivery_zones`. Model: `deliveryZonesTable` in [store.schema.ts](../backend/src/db/schema/store.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `store_id` | `storeId` | integer | Yes | FK stores.id |
| `pincode` | `pincode` | text | Yes | — |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |
| `updated_at` | `updatedAt` | timestamptz | Yes | default now() |

Table constraints/indexes: unique: `delivery_zones_store_id_pincode_unique`.

### delivery-pricing-rules

SQL table: `delivery_pricing_rules`. Model: `deliveryPricingRulesTable` in [store.schema.ts](../backend/src/db/schema/store.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `store_id` | `storeId` | integer | Yes | FK stores.id |
| `version` | `version` | integer | Yes | — |
| `delivery_fee_paise` | `deliveryFeePaise` | integer | Yes | — |
| `free_delivery_threshold_paise` | `freeDeliveryThresholdPaise` | integer | No | — |
| `effective_from` | `effectiveFrom` | date | Yes | — |
| `effective_to` | `effectiveTo` | date | No | — |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |
| `updated_at` | `updatedAt` | timestamptz | Yes | default now() |

Table constraints/indexes: unique: `delivery_pricing_rules_store_version_unique`; unique: `delivery_pricing_rules_store_effective_from_unique`; check: `delivery_pricing_rules_version_positive`; check: `delivery_pricing_rules_amounts_valid`; check: `delivery_pricing_rules_effective_range_valid`.

### tax-rules

SQL table: `tax_rules`. Model: `taxRulesTable` in [tax.schema.ts](../backend/src/db/schema/tax.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `store_id` | `storeId` | integer | Yes | FK stores.id |
| `component` | `component` | text | Yes | — |
| `version` | `version` | integer | Yes | — |
| `rate_bps` | `rateBps` | integer | Yes | — |
| `hsn_sac_code` | `hsnSacCode` | text | Yes | — |
| `is_demo` | `isDemo` | boolean | Yes | default true |
| `disclaimer` | `disclaimer` | text | Yes | default DEMO_TAX_DISCLAIMER |
| `effective_from` | `effectiveFrom` | date | Yes | — |
| `effective_to` | `effectiveTo` | date | No | — |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |
| `updated_at` | `updatedAt` | timestamptz | Yes | default now() |

Table constraints/indexes: unique: `tax_rules_store_component_version_unique`; unique: `tax_rules_store_component_effective_from_unique`; check: `tax_rules_component_valid`; check: `tax_rules_version_positive`; check: `tax_rules_rate_valid`; check: `tax_rules_hsn_sac_code_present`; check: `tax_rules_demo_only`; check: `tax_rules_disclaimer_exact`; check: `tax_rules_effective_range_valid`.

### users

SQL table: `users`. Model: `usersTable` in [user.schema.ts](../backend/src/db/schema/user.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `fname` | `fname` | text | Yes | — |
| `lname` | `lname` | text | Yes | — |
| `password` | `password` | text | Yes | — |
| `email` | `email` | text | Yes | — |
| `role` | `role` | text | Yes | default "user" |
| `token_version` | `tokenVersion` | integer | Yes | default 0 |
| `is_active` | `isActive` | boolean | Yes | default true |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |
| `updated_at` | `updatedAt` | timestamptz | Yes | default now() |

Table constraints/indexes: uniqueIndex: `users_lower_email_unique`; check: `users_token_version_nonnegative`.

### addresses

SQL table: `addresses`. Model: `addressTable` in [user.schema.ts](../backend/src/db/schema/user.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `user_id` | `userId` | integer | Yes | FK users.id |
| `type` | `type` | text | Yes | — |
| `street` | `street` | text | Yes | — |
| `city` | `city` | text | Yes | — |
| `state` | `state` | text | Yes | — |
| `pincode` | `pincode` | text | Yes | — |
| `phone` | `phone` | text | Yes | — |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |
| `updated_at` | `updatedAt` | timestamptz | Yes | default now() |

### vendors

SQL table: `vendors`. Model: `vendorsTable` in [vendor.schema.ts](../backend/src/db/schema/vendor.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `store_id` | `storeId` | integer | No | FK stores.id |
| `name` | `name` | text | Yes | — |
| `normalized_name` | `normalizedName` | text | Yes | — |
| `tax_registration_number` | `taxRegistrationNumber` | text | No | — |
| `contact_name` | `contactName` | text | No | — |
| `email` | `email` | text | No | — |
| `phone` | `phone` | text | No | — |
| `address` | `address` | text | No | — |
| `payment_terms_days` | `paymentTermsDays` | integer | Yes | default 0 |
| `is_active` | `isActive` | boolean | Yes | default true |
| `created_by` | `createdBy` | integer | Yes | FK users.id |
| `updated_by` | `updatedBy` | integer | Yes | FK users.id |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |
| `updated_at` | `updatedAt` | timestamptz | Yes | default now() |

Table constraints/indexes: uniqueIndex: `vendors_store_normalized_name_unique`; uniqueIndex: `vendors_platform_normalized_name_unique`; index: `vendors_store_active_name_idx`; check: `vendors_name_present`; check: `vendors_normalized_name_present`; check: `vendors_payment_terms_valid`.

### expense-categories

SQL table: `expense_categories`. Model: `expenseCategoriesTable` in [vendor.schema.ts](../backend/src/db/schema/vendor.schema.ts).

| SQL column | Model field | SQL type | Required | Default / key / reference |
| --- | --- | --- | --- | --- |
| `id` | `id` | integer | Yes | default identity; primary key |
| `store_id` | `storeId` | integer | No | FK stores.id |
| `parent_id` | `parentId` | integer | No | — |
| `name` | `name` | text | Yes | — |
| `normalized_name` | `normalizedName` | text | Yes | — |
| `classification` | `classification` | text | Yes | — |
| `ledger_account_id` | `ledgerAccountId` | integer | No | FK ledger_accounts.id |
| `is_active` | `isActive` | boolean | Yes | default true |
| `created_by` | `createdBy` | integer | Yes | FK users.id |
| `updated_by` | `updatedBy` | integer | Yes | FK users.id |
| `created_at` | `createdAt` | timestamptz | Yes | default now() |
| `updated_at` | `updatedAt` | timestamptz | Yes | default now() |

Table constraints/indexes: uniqueIndex: `expense_categories_store_parent_name_unique`; uniqueIndex: `expense_categories_store_root_name_unique`; uniqueIndex: `expense_categories_platform_parent_name_unique`; uniqueIndex: `expense_categories_platform_root_name_unique`; index: `expense_categories_store_active_name_idx`; check: `expense_categories_name_present`; check: `expense_categories_normalized_name_present`; check: `expense_categories_classification_valid`; check: `expense_categories_parent_not_self`; check: `expense_categories_ledger_account_positive`.

Also declares a composite foreign key; see the source for column order and delete behavior.

## Migration-only guarantees

The checked-in chain runs from `0000_baseline` through `0030_remove_legacy_coupons`. Retain [migration metadata](../backend/migrations/meta/_journal.json) and snapshots; they are required history for future migration generation.

[0023_balanced_posting_kernel.sql](../backend/migrations/0023_balanced_posting_kernel.sql) provides journal balance validation and posted-entry/line immutability triggers. The journal is inserted as draft, lines are inserted, then the balanced kernel posts it. A table-only schema push omits these guarantees. [0029](../backend/migrations/0029_promotion_application_bundle_foundation.sql) adds promotion/bundle foundations; [0030](../backend/migrations/0030_remove_legacy_coupons.sql) removes retired coupon persistence.

Apply migrations with `pnpm db:migrate` against the intended database. This audit did not execute the complete migration chain on a local/server PostgreSQL instance. The recruiter-seed PGlite test derives tables from current declarations and explicitly applies migration 0023; it is narrower evidence than a full migration-chain test. See [verification](case-study-verification.md).
