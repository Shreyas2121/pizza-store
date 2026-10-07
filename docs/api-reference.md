# API Reference

All endpoints are prefixed with `/api/v1`. Authentication is via `Authorization: Bearer <jwt>` header where noted.

## Users

### `POST /user/register`

Create a new user account.

**Body:**
```json
{
  "fname": "string",
  "lname": "string",
  "email": "string",
  "password": "string"
}
```

**Response `201`:**
```json
{
  "data": {
    "token": "string (JWT)",
    "user": { "id": 1, "fname": "...", "lname": "...", "email": "...", "role": "user" }
  }
}
```

### `POST /user/login`

Authenticate and receive a JWT.

**Body:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response `200`:**
```json
{
  "data": {
    "token": "string (JWT)",
    "user": { "id": 1, "fname": "...", "lname": "...", "email": "...", "role": "user" }
  }
}
```

### `GET /user` 🔒

Get current user profile.

**Response `200`:**
```json
{
  "data": { "id": 1, "fname": "...", "lname": "...", "email": "...", "role": "user" }
}
```

### `POST /user/address` 🔒

Create a delivery address for the current user.

**Body:**
```json
{
  "type": "Home | Work | Other",
  "street": "string",
  "city": "string",
  "state": "string",
  "pincode": "string",
  "phone": "string"
}
```

**Response `201`:**
```json
{
  "data": {
    "message": "Address created successfully",
    "address": { ... }
  }
}
```

### `GET /user/address` 🔒

List all addresses for the current user.

**Response `200`:**
```json
{
  "data": [ { "id": 1, "type": "Home", "street": "...", ... } ]
}
```

---

## Products

### `GET /product/menu`

Get products filtered by menu, with pagination and sorting.

When `storeId` is present, only globally available products with an available
mapping for that store are returned. The response and price sorting use the
store-specific price. Derived `stockStatus` (`"in_stock"`, `"low_stock"`,
`"out_of_stock"`, `"untracked"`) is calculated based on available stock
(`on_hand_quantity - active_reservations`). For low-stock items, `stockCount`
reports remaining available units. Without `storeId`, the existing global
catalog behavior is preserved.

**Query params:**
- `storeId` (optional) — scope the catalog to a resolved store
- `menuSlug` (optional) — filter by menu slug
- `page` (default `1`) — page number
- `sortBy` (default `"default"`) — `"default"`, `"price_low"`, `"price_high"`

**Response `200`:**
```json
{
  "data": [
    {
      "id": 1,
      "name": "Margherita",
      "pricePaise": 29900,
      "image": "/uploads/...",
      "stockStatus": "low_stock",
      "stockCount": 3
    }
  ],
  "meta": { "page": 1, "limit": 10, "hasNextPage": true }
}
```

### `GET /product/admin` 🔒🛡️

List all products with category data (admin view).

**Response `200`:**
```json
{
  "data": [ { "id": 1, "name": "...", "category": { "id": 1, "name": "..." } } ]
}
```

### `GET /product/category/:categoryId`

List products by category.

### `GET /product/group/:groupId`

List products assigned to a customization group.

### `POST /product` 🔒🛡️

Create a new product. Accepts `multipart/form-data`.

**Form fields:**
- `name` — string
- `description` — string (optional)
- `pricePaise` — non-negative integer paise
- `isVeg` — boolean
- `categoryId` — number
- `image` — file (JPEG/PNG/GIF, max 5MB)

**Response `200`:**
```json
{
  "message": "Product created successfully",
  "data": { ... }
}
```

---

## Categories

### `GET /category/select`

Get categories formatted for select dropdowns.

**Response `200`:**
```json
{
  "data": [ { "label": "Pizza", "value": "1" } ]
}
```

### `POST /category` 🔒🛡️

Create a new category.

---

## Customization

### `GET /customize/product/:productId`

Get customization groups and options for a product.

**Response `200`:**
```json
{
  "data": [
    {
      "group": {
        "id": 1, "name": "Size", "type": "single", "required": true,
        "options": [ { "id": 1, "name": "Small", "pricePaise": 0 }, { "id": 2, "name": "Large", "pricePaise": 5000 } ]
      }
    }
  ]
}
```

### `GET /customize/admin` 🔒🛡️

Get all customization groups with their associated products and options.

### `POST /customize/group` 🔒🛡️

Create a customization group.

### `POST /customize/option` 🔒🛡️

Create a customization option within a group.

### `POST /customize/mapping` 🔒🛡️

Map a customization group to a product.

---

## Menu

### `GET /menu`

List all active menu items.

**Response `200`:**
```json
{
  "data": [ { "id": 1, "name": "Pizza", "slug": "pizza", "image": "/uploads/...", "position": 1 } ]
}
```

### `POST /menu` 🔒🛡️

Create a menu item. Accepts `multipart/form-data`.

**Form fields:**
- `name` — string
- `position` — number
- `image` — file
- `productIds` — array of product IDs

---

## Stores

### `POST /stores/resolve`

Resolve the active, currently open store serving a six-digit delivery pincode.
Store operating hours are evaluated in IST, including schedules that cross
midnight. When multiple stores qualify, the store with the lowest ID is used.

**Body:**
```json
{
  "pincode": "560001"
}
```

Returns `404` when the area is unsupported or only has inactive stores, and
`409` when serving stores exist but are currently closed.

### `GET /stores/:storeId/products` 🔒🛡️

List the products mapped to a store. Each mapping includes its store-specific
price and availability plus the global product details and base price.

### `POST /stores/:storeId/products` 🔒🛡️

Bulk-create or update up to 100 store-product mappings.

**Body:**
```json
[
  { "productId": 1, "pricePaise": 29900, "isAvailable": true },
  { "productId": 2, "pricePaise": 34900, "isAvailable": false }
]
```

### `PUT /stores/:storeId/products/:productId` 🔒🛡️

Update a mapped product's store-specific price, availability, or both.

**Body:**
```json
{
  "pricePaise": 31900,
  "isAvailable": true
}
```

### `DELETE /stores/:storeId/products/:productId` 🔒🛡️

Remove a product from a store's offering.

### `GET /stores/:storeId/delivery-zones` 🔒🛡️

List the delivery pincodes assigned to a store, ordered by pincode.

### `POST /stores/:storeId/delivery-zones` 🔒🛡️

Add up to 100 delivery pincodes to a store. Existing mappings are skipped.

**Body:**
```json
{
  "pincodes": ["560001", "560002"]
}
```

**Response `201`:**
```json
{
  "data": [
    { "id": 1, "storeId": 2, "pincode": "560001" }
  ],
  "meta": { "addedCount": 1, "skippedCount": 1 },
  "message": "Delivery zones added successfully"
}
```

### `DELETE /stores/:storeId/delivery-zones/:zoneId` 🔒🛡️

Remove a delivery zone from the specified store.

---

## Cart

### `POST /cart/add` 🔒

Add a product to cart using its store-specific price (creates the cart if
needed). The product and store must both be active and available.

**Body:**
```json
{
  "productId": 1,
  "storeId": 2,
  "cIds": [3, 5]
}
```
`cIds` is an array of customization option IDs. Pass empty array for no customizations.
If the cart belongs to another store, its existing items are cleared atomically
before the new item is added and `data.cartCleared` is `true`.

**Response `200`:**
```json
{
  "data": { "cartCleared": false, "storeId": 2 },
  "message": "Product added to cart"
}
```

### `GET /cart/count` 🔒

Get number of items in the current user's cart.

**Response `200`:**
```json
{
  "data": 3
}
```

### `GET /cart` 🔒

Get the full cart with its assigned store, items, product details, and
customizations. Cart item prices are store-price snapshots from add time.

**Response `200`:**
```json
{
  "data": {
    "id": 1, "storeId": 2, "totalPaise": 54700,
    "store": { "id": 2, "name": "PizzaStore - Koramangala" },
    "items": [
      {
        "id": 1, "productId": 3, "quantity": 2, "pricePaise": 19900,
        "product": { "id": 3, "name": "Margherita", "image": "..." },
        "customizations": [ { "optionId": 5, "name": "Extra Cheese", "pricePaise": 4900 } ]
      }
    ]
  }
}
```

### `GET /cart/checkout` 🔒

Get the full paise-native cart used to construct an authoritative checkout quote.

### `PATCH /cart/update` 🔒

Update cart item quantity. Quantity increases revalidate store and product
availability while retaining the item's snapshotted store price.

**Body:**
```json
{
  "cartItemId": 1,
  "productId": 3,
  "type": "+" | "-"
}
```

If the requested quantity exceeds the store's current available stock, the server
rejects the request with `409 Conflict`:

**Error Response `409`:**
```json
{
  "message": "Insufficient stock for one or more items",
  "code": "INSUFFICIENT_STOCK",
  "data": {
    "items": [
      {
        "productId": 1,
        "productName": "Margherita",
        "requestedQuantity": 3,
        "availableQuantity": 1
      }
    ]
  }
}
```

### `DELETE /cart/:cartItemId` 🔒

Remove an item from cart.

---

## Orders

### `POST /order` 🔒

Create an order from the current cart.

The order's store is copied from the cart. Before creating the order, the
backend locks the cart, user eligibility key, store and catalogue/inventory rows,
verifies the store's local opening hours, checks address ownership and delivery
coverage, and reloads current store prices, customization values and bundle
components. Pricing policy v4 resolves automatic deals or the supplied manual
coupon under promotion/settings locks. Client prices and offer IDs are rejected.
Order, COD payment/attempt, consumed promotion applications and unit allocations,
item/customization/bundle snapshots, stock deduction and cart deletion commit
atomically. Item discounts, charged delivery fees and bundle compare-at markdown
retain separate accounting meanings. Consumed COD promotion usage remains
occupied after cancellation; cancellation restores stock without releasing
consumed applications.

**Body:**
```json
{
  "addressId": 1,
  "paymentType": "cash",
  "couponCode": "SAVE20"
}
```

`couponCode` is optional or nullable and is trimmed/uppercased with a 64-character
limit checked after normalization. `paymentType` defaults to `cash`. A coupon
cannot combine with an automatic offer or catalogue deal bundle.

**Response `200`:**
```json
{
  "message": "Order created successfully",
  "data": 42
}
```
`data` is the created order ID.

### `GET /order` 🔒

List current user's orders, filtered by status.

**Query params:**
- `status` — `"awaiting_payment"`, `"pending"`, `"preparing"`, `"out_for_delivery"`, `"delivered"`, `"cancelled"`

### `GET /order/:orderId` 🔒

Get full order details including items, customizations, address, coupon, and payment.

### `PATCH /order/:orderId` 🔒🛡️

Update order status.

**Body:**
```json
{
  "status": "preparing"
}
```

### `GET /order/admin/all` 🔒🛡️

List all orders (admin view), filtered by status.

---

## Payments

COD payments are created and linked atomically by `POST /order`. The legacy
`POST /payments/process-cod` endpoint has been removed because it created
orphan payment rows.

### `GET /payments/methods`

Return payment-method availability for checkout. This endpoint contains no
credentials and is safe to cache briefly.

```json
{
  "data": {
    "cash": true,
    "razorpay": true,
    "providerMode": "simulator"
  }
}
```

`razorpay` represents the compatible online-payment rail. It is available by
default through the credential-free simulator. In `razorpay_test` mode it is
true only when credentials are complete and `RAZORPAY_ENABLED` is true.

### `POST /payments/razorpay/orders` 🔒

Create or resume an online checkout attempt. The backend locks and validates
the cart, calculates the amount, snapshots an `awaiting_payment` order, creates
its linked payment, reserves every promotion application and inventory demand, and clears the snapshotted cart
before calling Razorpay. The local state therefore survives provider or browser
failures.

`clientRequestId` is a UUID generated once by the client for a checkout attempt.
Repeating it returns the same local attempt and never creates another local
order. The amount, currency, and Razorpay Order ID in the response are the only
values that should be passed to Standard Checkout.

**Body:**
```json
{
  "addressId": 1,
  "couponCode": "SAVE20",
  "clientRequestId": "524e5b0e-4d86-4e3c-8211-f4fc75c249f8"
}
```

`couponCode` is optional or nullable. Online totals below ₹1.00 are rejected.

**Response `200`:**
```json
{
  "data": {
    "localOrderId": 42,
    "localPaymentId": 17,
    "keyId": "rzp_test_...",
    "providerMode": "razorpay_test",
    "razorpayOrderId": "order_...",
    "amountPaise": 49900,
    "currency": "INR",
    "name": "PizzaStore",
    "description": "Order from PizzaStore - Koramangala",
    "paymentStatus": "processing",
    "providerStatus": "created",
    "checkoutReady": true,
    "failure": null
  },
  "message": "Online payment initialized"
}
```

Responses also include immutable `discountMode`, `orderStatus`, and `promotions[]` snapshots (`id`, `kind`, `name`, `code`, `discountType`, `definitionVersion`, `itemDiscountPaise`, `deliveryDiscountPaise`, `totalSavingsPaise`). These values come from the order applications, including during retry/status/recovery. Checkout is unavailable for cancelled or already paid orders.

If Razorpay order creation fails, the payment becomes `failed` and all inventory/promotion
reservations are released. The local order stays `awaiting_payment` so it can be
retried. The `502 PAYMENT_INIT_FAILED` response includes the safe local order
and payment IDs so the client can link to that recovery path. A concurrent
duplicate request can temporarily return
`checkoutReady: false` while the first request owns provider creation; use the
status endpoint before retrying.

### `POST /payments/simulator/orders/:localOrderId/events` ðŸ”’

Advance one deterministic provider event for the current user's online order.
This endpoint returns `404` unless `PAYMENT_PROVIDER_MODE=simulator`, and it
never accepts amounts or other financial truth from the browser.

An optional body selects `successful`, `failed`, `delayed`, `duplicate`, or
`out_of_order`. Omit it to continue the order's current script. Delayed,
duplicate, and out-of-order scripts require a second request to deliver their
second event. Duplicate delivery reuses the same immutable event ID; payment
finalization remains idempotent.

```json
{ "scenario": "delayed" }
```

The normal frontend uses `successful`. The other scripts are deterministic
diagnostic/demo controls for reconciliation behavior.

### `GET /payments/razorpay/orders/:localOrderId` 🔒

Return the current user's checkout-safe payment state. It never returns API or
webhook secrets. Returns `404` for another user's order and for COD orders.

### `POST /payments/razorpay/orders/:localOrderId/retry` 🔒

Retry provider-order creation for a failed or not-yet-claimed local attempt. A
stored Razorpay Order is reused; it is never recreated. If a failed attempt used
promotions, the complete saved application collection and inventory demand are restored atomically after capacity/budget/stock checks. Current definitions or opt-outs do not change the price. Receipt recovery precedes creation when the provider identity is missing. Cancelled/expired orders cannot retry. Requests made
while another request is creating the provider order return the current status.

### `POST /payments/razorpay/verify` 🔒

Verify the Standard Checkout success callback and finalize a captured online
payment. The server uses its stored Razorpay Order ID when generating the
HMAC-SHA256 signature; the submitted order ID must match but is never trusted as
the signature source.

**Body:**
```json
{
  "localOrderId": 42,
  "razorpay_order_id": "order_...",
  "razorpay_payment_id": "pay_...",
  "razorpay_signature": "64-character hexadecimal signature"
}
```

After signature validation, the backend fetches both resources from Razorpay.
It requires the payment to be `captured`, the provider order to be `paid`, and
the order association, INR currency, full paid amount, and zero amount due to
match the stored local payment.

**Response `200`:**
```json
{
  "data": {
    "localOrderId": 42,
    "localPaymentId": 17,
    "totalPrice": 499,
    "paymentStatus": "completed",
    "orderStatus": "pending",
    "finalizedNow": true
  },
  "message": "Payment verified successfully"
}
```

Finalization locks the local order/payment, records the provider payment ID and
paid timestamp, consumes all promotion applications and inventory reservations once, and moves fulfillment
from `awaiting_payment` to `pending` atomically. Repeated verification returns
the same success with `finalizedNow: false`; only the first commit emits
`orderPlaced`.

Important error codes include `PAYMENT_SIGNATURE_INVALID`,
`PAYMENT_ORDER_MISMATCH`, `PAYMENT_PROVIDER_MISMATCH`,
`PAYMENT_NOT_CAPTURED`, and `PAYMENT_PROVIDER_UNAVAILABLE`. An `authorized`
payment is not fulfillment-ready.

### `POST /payments/razorpay/webhook`

Public Razorpay webhook receiver. This route does not use JWT authentication;
it is protected by an HMAC-SHA256 signature over the exact raw request body
using `RAZORPAY_WEBHOOK_SECRET`.

Required headers:

- `X-Razorpay-Signature`
- `x-razorpay-event-id`

The backend handles `payment.captured`, `payment.failed`, and `order.paid`.
Other correctly signed events are acknowledged and recorded as ignored. Event
IDs are stored uniquely in `payment_webhook_events`; processed duplicates are
acknowledged without repeating state transitions. Failed events and processing
claims older than five minutes can be claimed again. A concurrent fresh claim
returns non-2xx so Razorpay retains retry responsibility if the first worker
fails.

Webhook payloads are treated as event hints. Before changing local payment
state, the backend fetches current order/payment data from Razorpay and verifies
association, amount, and currency. A newer authorized or captured attempt wins
over a late failed event, and completed/refunded payments are never downgraded.

**Response `200`:**
```json
{
  "data": {
    "eventId": "provider-event-id",
    "eventType": "payment.captured",
    "duplicate": false,
    "inProgress": false,
    "reconciliation": { "localOrderId": 42, "finalizedNow": true }
  },
  "message": "Webhook accepted"
}
```

### `POST /payments/razorpay/reconcile` 🔒🛡️

Admin-only recovery operation for stale `processing` or `failed` Razorpay
payments. It fetches current provider state, finalizes captured payments,
records genuine failures, and searches by the unique receipt to repair the
narrow crash window where Razorpay created an order but its ID was not saved
locally.

**Body:**
```json
{
  "olderThanMinutes": 15,
  "limit": 25
}
```

Both fields default to the values above. The age range is 1–1440 minutes and
the batch limit is 1–50. Errors are isolated per payment and returned in the
summary so one provider failure does not prevent recovery of the rest.

---

## Coupons

The legacy create/list/detail/code/update/delete coupon endpoints were retired in
C00 and return `404`; they have no compatibility contract. During the staged
backend cutover, only the authenticated validation endpoint below remains. C10
removes it after consumers move to `/promotions/validate`.

The final promotions endpoint and DTO contract is frozen in
[Promotions and offers API contract](promotions-contract.md).

### `POST /coupon/validate` 🔒

Preview a coupon against the authenticated user's current server-calculated
cart subtotal. Checkout always locks and revalidates the coupon before use.

**Body:**
```json
{
  "code": "SAVE20"
}
```

**Response `200`:**
```json
{
  "data": {
    "id": 1,
    "code": "SAVE20",
    "discountType": "percentage",
    "discountValue": 20,
    "quoteVersion": "2026-09-01-02",
    "currency": "INR",
    "pricingPolicyVersion": 3,
    "itemsSubtotalPaise": 50000,
    "discountPaise": 10000,
    "discountAmount": 100,
    "grandTotalPaise": 40000
  }
}
```

This temporary response is internal cutover scaffolding, not a target
compatibility shape. The additive quote fields come from the same integer-paise
policy used by final checkout; `discountAmount` is the temporary rupee
presentation value.

Coupon redemption is internal to the order transaction. The former public
`POST /coupon/redeem` endpoint has been removed to prevent replay and
cross-order redemption.

---

## Inventory

### `GET /inventory/store/:storeId` 🔒🛡️

List paginated inventory for a store with real-time calculated available quantities and stock statuses.

**Query params:**
- `status` (optional) — `"all"`, `"low_stock"`, `"out_of_stock"`
- `search` (optional) — search product names
- `page` (default `1`, max `10000`) — page number
- `limit` (default `20`, max `100`) — items per page

**Response `200`:**
```json
{
  "data": [
    {
      "storeProductId": 1,
      "storeId": 2,
      "productId": 3,
      "productName": "Margherita",
      "productImage": "/uploads/...",
      "pricePaise": 29900,
      "isAvailable": true,
      "productIsAvailable": true,
      "onHandQuantity": 15,
      "reservedQuantity": 2,
      "availableQuantity": 13,
      "lowStockThreshold": 5,
      "lastRestockedAt": "2026-08-25T12:00:00.000Z",
      "stockStatus": "in_stock"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    "hasNextPage": false
  }
}
```

### `GET /inventory/store/:storeId/product/:productId` 🔒🛡️

Get single product inventory details including the 20 most recent inventory movements.

**Response `200`:**
```json
{
  "data": {
    "storeProductId": 1,
    "storeId": 2,
    "productId": 3,
    "productName": "Margherita",
    "productImage": "/uploads/...",
    "pricePaise": 29900,
    "isAvailable": true,
    "productIsAvailable": true,
    "onHandQuantity": 15,
    "reservedQuantity": 2,
    "availableQuantity": 13,
    "lowStockThreshold": 5,
    "lastRestockedAt": "2026-08-25T12:00:00.000Z",
    "stockStatus": "in_stock",
    "recentMovements": [ ... ]
  }
}
```

### `POST /inventory/store/:storeId/product/:productId/restock` 🔒🛡️

Add positive stock to a single product. Tracking must already be enabled (on-hand is not NULL). Creates an append-only `restock` movement and updates `lastRestockedAt`.

**Body:**
```json
{
  "quantityAdded": 20,
  "reason": "Weekly bakery delivery"
}
```

**Response `200`:**
```json
{
  "message": "Product restocked successfully",
  "data": {
    "storeProductId": 1,
    "productId": 3,
    "productName": "Margherita",
    "previousQuantity": 15,
    "newQuantity": 35,
    "quantityChange": 20,
    "changeType": "restock",
    "lastRestockedAt": "2026-08-25T14:30:00.000Z"
  }
}
```

### `POST /inventory/store/:storeId/restock/bulk` 🔒🛡️

Restock up to 50 distinct products in a single atomic transaction.

**Body:**
```json
{
  "items": [
    { "productId": 1, "quantityAdded": 10, "reason": "Batch arrival" },
    { "productId": 2, "quantityAdded": 15, "reason": "Batch arrival" }
  ]
}
```

**Response `200`:**
```json
{
  "message": "Products restocked successfully",
  "data": {
    "updatedCount": 2,
    "items": [ ... ]
  }
}
```

### `POST /inventory/store/:storeId/product/:productId/adjustment` 🔒🛡️

Manually set the absolute on-hand stock count. Also used to establish an initial opening balance for an untracked product. A non-empty reason is mandatory. Rejects targets lower than currently active reservations.

**Body:**
```json
{
  "targetQuantity": 12,
  "reason": "Physical count discrepancy"
}
```

**Response `200`:**
```json
{
  "message": "Stock adjusted successfully",
  "data": {
    "storeProductId": 1,
    "productId": 3,
    "productName": "Margherita",
    "previousQuantity": 15,
    "newQuantity": 12,
    "quantityChange": -3,
    "changeType": "adjustment"
  }
}
```

### `PATCH /inventory/store/:storeId/product/:productId/threshold` 🔒🛡️

Update the product's low-stock threshold for status calculation and warning alerts.

**Body:**
```json
{
  "threshold": 8
}
```

**Response `200`:**
```json
{
  "message": "Low-stock threshold updated successfully",
  "data": {
    "storeProductId": 1,
    "lowStockThreshold": 8
  }
}
```

### `GET /inventory/store/:storeId/movements` 🔒🛡️

List paginated audit movements with actor information and change-type filtering.

**Query params:**
- `productId` (optional) — filter by product ID
- `changeType` (optional) — `"restock"`, `"sale"`, `"adjustment"`, `"cancellation"`
- `from` (optional) — ISO timestamp
- `to` (optional) — ISO timestamp
- `page` (default `1`) — page number
- `limit` (default `20`, max `100`) — items per page

**Response `200`:**
```json
{
  "data": [
    {
      "id": 101,
      "storeProductId": 1,
      "productId": 3,
      "productName": "Margherita",
      "changeType": "sale",
      "quantityChange": -2,
      "previousQuantity": 15,
      "newQuantity": 13,
      "reason": null,
      "orderId": 42,
      "createdBy": null,
      "actorFirstName": null,
      "actorLastName": null,
      "createdAt": "2026-08-25T12:30:00.000Z"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    "hasNextPage": false
  }
}
```

---

## Dashboard

### `GET /dashboard` 🔒🛡️

Get dashboard metric cards. Pass optional `storeId=<id>` to filter every
metric and its comparison period to one store.

**Query params:**
- `from` — start date (ISO string)
- `to` — end date (ISO string)

**Response `200`:**
```json
{
  "data": [
    {
      "label": "Gross Order Value",
      "data": {
        "current": "₹25,000",
        "previous": "₹20,000",
        "percentage": "25.00",
        "isLow": false,
        "icon": { "name": "IndianRupee", "color": "green" }
      }
    }
  ]
}
```

### `GET /dashboard/charts` 🔒🛡️

Get time-series chart data. Pass optional `storeId=<id>` to filter both chart
series to one store.

**Query params:**
- `from`, `to` — date range
- `group` — `"daily"`, `"weekly"`, `"monthly"`, `"quarterly"`, `"yearly"`

**Response `200`:**
```json
{
  "data": {
    "revenueOverTime": [ { "period": "2026-01", "revenue": 25000 } ],
    "ordersOverTime": [ { "period": "2026-01", "orders": 150 } ]
  }
}
```

---

## Chat / Support

### `POST /chat/request` 🔒

Create a new support chat session.

### `GET /chat/active` 🔒

Get the active chat session for the current user (or by `userId` query param for admin).

### `GET /chat/requests` 🔒🛡️

List support requests filtered by status.

**Query params:**
- `status` — `"pending"`, `"open"`, `"close"`, `"rejected"`

### `PATCH /chat/request` 🔒🛡️

Update a support request status (accept, reject, close).

### `GET /chat/messages` 🔒

Get messages for a chat session.

**Query params:**
- `userId` (optional, admin) — get messages for a specific user's session

### `POST /chat/message` 🔒

Send a message in a chat session.

**Body:**
```json
{
  "message": "Hello, I need help with my order",
  "sessionId": 5
}
```

---

## Finance & Management Accounting

Financial endpoints are mounted under `/api/v1/finance/*` and `/api/v1/checkout/quote`. Detailed request/response schemas, rollout transitions, error codes, and permission matrices are documented in [Finance API compatibility and rollout map](finance-api-compatibility-rollout.md).

### Pricing & Server Quote
- `POST /checkout/quote` — Promotion-aware pricing policy v4 and quote version `2026-09-12-03`. Current store prices, categories, customizations and bundle components come from the server. Returns the [frozen quote contract](promotions-contract.md#43-authoritative-pricing-quote), with automatic offers, optional manual coupon, separate item/delivery savings, display-only bundle markdown and inclusive tax after line discounts.
- `POST /promotions/validate` 🔒 — Body `{ "couponCode": "SAVE" }`; resolves the authenticated user's active cart and returns the same v4 quote. Store overrides, prices and offer IDs are rejected. Validation and coupon-bearing quote requests share a process-local 30-attempt/minute quota per authenticated user or anonymous IP; excess requests return `429`, `PROMOTION_VALIDATION_RATE_LIMITED`, and `Retry-After`. Both endpoints return `Cache-Control: no-store`.
- `POST /coupon/validate` 🔒 — Temporary legacy preview for online-payment callers awaiting C08 cutover. It remains on pricing policy v3 and is removed with its remaining consumers in C10. It is not an adapter to v4.

### Reports & P&L
- `GET /finance/overview` 🔒 — Recognized revenue, collections, COGS, gross margin, operating results, and drill-downs.
- `GET /finance/profit-and-loss` 🔒 — Multi-period store and consolidated income statement.
- `GET /finance/sales` 🔒 — Sales, discount allocations, and delivery revenue breakdown.
- `GET /finance/margins` 🔒 — Product and store contribution margin analysis.
- Every aggregate report includes currency, timezone, journal-business-date basis, delivery-recognition basis, included journal statuses, generation time, selected scope, comparison period, the latest successful settlement reconciliation time (`null` when none exists in scope), and `payrollCostVisibility`.
- Exact `payrollCostPaise` requires both the report permission and `payroll.read` for the selected store; platform administrators retain exact consolidated and store reporting. Without that permission, `payrollCostVisibility` is `suppressed`, and both `payrollCostPaise` and the payroll-derived `operatingResultPaise` are `null` across current totals, comparisons, grouped periods, drill-down links, and CSV exports. Suppressing the derived result prevents reconstructing payroll through subtraction. Other operating expenses remain payroll-exclusive.

Headline metric definitions:

| Metric | Definition |
| --- | --- |
| Recognized revenue | Tax-exclusive food and delivery revenue recognized at delivery, less posted discounts and finalized post-delivery refunds. |
| Collections | Captured COD and Razorpay amounts in the selected period; cash flow, not revenue. |
| Refunds | Tax-exclusive contra revenue from finalized post-delivery refunds; separately reversed included tax is excluded. |
| COGS | Standard-cost snapshots recognized at delivery; refunds do not reverse COGS unless inventory is separately accepted back. |
| Gross profit | Recognized revenue minus COGS. |
| Operating expenses | Net posted expense-account movements excluding COGS and payroll, including gateway charges, cash variance, and rounding movements. |
| Payroll cost | Employer cost from posted pay runs; may include earning, deduction, and employer-cost components and is not take-home pay. Exact values require `payroll.read`. |
| Operating result | Gross profit minus operating expenses and payroll employer cost; suppressed with payroll cost to prevent subtraction. |
| Unsettled Razorpay | Net Razorpay clearing balance through the report end date, including prior captures, refunds, and settlements. |
| Cash variance | Net posted cash shortages less overages from closed COD sessions. |
- `GET /finance/exports/:reportType` 🔒 — CSV exports with formula-injection mitigation.
  - `reportType`: `overview`, `profit-and-loss`, `sales`, or `margins`.
  - Query: `from`, `to`, optional `storeId`, and optional `groupBy=month|quarter|fiscal_year`.
  - Store staff must provide an authorized store. Only a platform owner can omit `storeId` for consolidation.
  - Response is `text/csv; charset=utf-8`, `Cache-Control: private, no-store`, with deterministic period/scope filename. Rows identify timezone, date and recognition basis, included journal statuses, generation and last-reconciliation times, payroll-cost visibility, currency, and whether each value is paise, basis points, or a count. Suppressed payroll and operating-result cells are blank.

### General Ledger & Fiscal Periods
- `GET /finance/ledger/accounts` 🔒 — Chart of accounts master.
- `GET /finance/ledger/journals` 🔒 — Store-scoped journal entries with cursor pagination.
- `GET /finance/ledger/journals/:id` 🔒 — Journal entry detail and balanced line breakdown.
- `GET /finance/ledger/trial-balance` 🔒 — Double-entry trial balance (debits = credits = 0 net).
- `POST /finance/ledger/manual-journals` 🔒 — Post audited manual adjustment journal.
- `POST /finance/ledger/journals/:id/reverse` 🔒 — Post linked reversal journal for an open period.
- `GET /finance/ledger/periods?storeId=:id` 🔒 — List fiscal periods and statuses.
- `POST /finance/ledger/periods` 🔒 — Open a non-overlapping store period with an audit reason.
- `POST /finance/ledger/periods/:id/soft-close` 🔒 — Soft close; ordinary posting stops and owner override requires a reason.
- `POST /finance/ledger/periods/:id/close` 🔒 — Lock fiscal period against every posting.
- `POST /finance/ledger/periods/:id/reopen` 🔒 — Controlled reopen with mandatory audit reason.

### Refunds & Reconciliation
- `GET /finance/refunds` 🔒 — List refunds and line item allocations.
- `GET /finance/refunds/stuck` 🔒 — List stuck and pending provider refunds for operational visibility.
- `POST /finance/refunds/reconcile` 🔒 — Reconcile stale provider refunds by receipt or ID.
- `POST /finance/orders/:orderId/refunds` 🔒 — Request full/partial refund with line allocations.
- `POST /finance/refunds/:id/approve` 🔒 — Manager/finance approval of refund request.
- `POST /finance/refunds/:id/reject` 🔒 — Reject refund request.
- `POST /finance/refunds/:id/retry` 🔒 — Retry a failed provider refund submission.
- `GET /finance/settlements` 🔒 — List Razorpay settlement batches.
- `GET /finance/settlements/:id` 🔒 — Settlement batch detail, fee breakdown, and matched lines.
- `POST /finance/settlements/import` 🔒 — Import settlement fixture or test provider sync.
  - Fixture body: `{ "source": "fixture", "providerSettlementId": "set_m1_s1_001" }`.
  - Test-provider body: `{ "source": "test_provider", "storeId": 1, "providerSettlementId": "set_..." }`.
  - Requires `finance.reconciliation.manage`; repeated identical imports return the existing batch.
- `GET /finance/reconciliation/issues` 🔒 — Reconciliation mismatch and observation issue queue.
- `POST /finance/reconciliation/issues/:id/resolve` 🔒 — Resolve reconciliation issue with audit note.

### Cash Management
- `GET /finance/cash/sessions` 🔒 — List store cash sessions.
- `GET /finance/cash/sessions/:id` 🔒 — Get session, movements, and closure history.
- `POST /finance/cash/sessions` 🔒 — Open cash session with initial float.
- `POST /finance/cash/sessions/:id/movements` 🔒 — Record manual cash in/out or adjustment.
- `POST /finance/cash/sessions/:id/close` 🔒 — Close session with counted cash and variance.
- `POST /finance/cash/sessions/:id/reopen` 🔒 — Controlled session reopen.
- `POST /finance/cash/movements/:id/reverse` 🔒 — Append a reversal for a manual movement.

### Costs, Vendors, and Expenses
- `GET /finance/costs/products` 🔒 — Standard unit cost history.
- `POST /finance/costs/products` 🔒 — Set effective-dated standard product cost.
- `GET /finance/vendors` 🔒 / `POST /finance/vendors` 🔒 / `PUT /finance/vendors/:id` 🔒 — Vendor master.
- `GET /finance/expenses/categories` 🔒 / `POST /finance/expenses/categories` 🔒 — Expense categories.
- `GET /finance/expenses` 🔒 / `GET /finance/expenses/:id` 🔒 / `POST /finance/expenses` 🔒 / `PUT /finance/expenses/:id` 🔒 — Expense records and exact allocations; writes use integer paise.
- `POST /finance/expenses/:id/submit` 🔒 / `approve` 🔒 / `reject` 🔒 / `pay` 🔒 / `post` 🔒 / `void` 🔒 / `reverse` 🔒 — Idempotent expense lifecycle commands; each requires an `Idempotency-Key` UUID.
- `GET /finance/expenses/:id/attachments` 🔒 / `POST /finance/expenses/:id/attachments` 🔒 — List or upload private draft/rejected-expense receipts. Upload field: `receipt`; accepted content: PDF/JPEG/PNG/WebP up to 5 MiB.
- `GET /finance/expenses/:id/attachments/:attachmentId` 🔒 — Authorized private receipt download with no public/static URL.
- `GET /finance/source-margin?storeId=:id` 🔒 — Source-based, pre-ledger delivered-sales, standard-COGS, operating-expense, and margin view with cost-coverage evidence.

### Payroll-Lite Profiles & Compensation
- `GET /finance/payroll/profiles?storeId=:id` 🔒 — Restricted, paginated employee finance profiles. Bank/PAN-like values are never returned; only last-four masks are exposed.
- `GET /finance/payroll/profiles/:id` 🔒 — Restricted profile detail with cross-store not-found masking.
- `POST /finance/payroll/profiles` 🔒 / `PUT /finance/payroll/profiles/:id` 🔒 — Create or update employment dates/status and encrypted sensitive metadata; requires `payroll.manage`.
- `GET /finance/payroll/profiles/:id/compensation?asOf=YYYY-MM-DD` 🔒 — Effective compensation history and exact recurring totals; requires `payroll.read`.
- `POST /finance/payroll/profiles/:id/compensation` 🔒 — Append a non-overlapping effective-dated set of earning, deduction, and employer-cost components; requires `payroll.manage`.

All compensation amounts are positive integer paise, currency is INR, and responses carry `demoOnly: true` plus a non-statutory boundary. Store managers and finance managers do not inherit payroll access. Compensation values and encrypted identifiers are excluded from audit metadata.

### Payroll Run Workflow
- `GET /finance/payroll/pay-runs?storeId=:id` 🔒 / `GET /finance/payroll/pay-runs/:id` 🔒 — Restricted pay-run list and detail. Detail includes immutable employee, compensation-version, and component snapshots after calculation.
- `GET /finance/payroll/pay-runs/:id/export` 🔒 — Restricted CSV snapshot export. Payment references and sensitive employee identifiers are excluded.
- `GET /finance/payroll/pay-runs/:id/statements/:employeeId` 🔒 — Restricted payslip-style gross-to-net statement from the immutable employee snapshot; marked demo-only.
- `POST /finance/payroll/pay-runs` 🔒 — Create one draft for a complete calendar month; requires `payroll.manage` and an `Idempotency-Key` UUID.
- `POST /finance/payroll/pay-runs/:id/calculate` 🔒 / `approve` 🔒 / `pay` 🔒 / `post` 🔒 / `void` 🔒 / `reverse` 🔒 — Idempotent lifecycle commands. Every command requires a distinct `Idempotency-Key` UUID and recent authentication; calculate, approve, and pay/post/reverse require their matching payroll permission. Reversal accepts `reason` and `effectiveBusinessDate`.

Calculation snapshots all eligible employees and the compensation effective at period end, uses exact integer paise, and is permitted only from `draft`. Approval must be performed by someone other than the drafter/calculator, and payment by someone other than the drafter/calculator/approver. Payment references are returned only in restricted detail and never written to exports, statements, logs, audit metadata, or ledger events. Posting uses the finance outbox and existing balanced ledger kernel; posted runs require exact reversal.

### High-Risk Audit Contract

Finance and payroll mutation requests return an `X-Request-ID`. Successful sensitive changes persist their lifecycle audit atomically with the mutation. Refund mutations, expense approval/payment, settlement reconciliation/issue resolution, fiscal-period administration, manual journal posting/reversal, compensation-version creation, and pay-run calculation/approval/payment/posting also persist failed or denied attempts.

Attempt actions use the stable `<operation>.failed` or `<operation>.denied` form and store `outcome`, actor ID, store ID when known, safe resource type/ID, request ID, timestamp, and `metadata.reasonCode`. Missing and cross-store resources continue to return the same `404`; internal denial auditing never changes that response. Audit rows exclude bank details, PAN/tax identifiers, compensation/payroll amounts, payment references, secrets, signatures, and raw provider payloads. A required audit-write failure produces `500 AUDIT_PERSISTENCE_FAILED` instead of allowing an unaudited high-risk operation.

### Operational Metrics

- `GET /metrics` — Prometheus text metrics for finance outbox, posting, journal-policy rejection, refunds, unsettled captures, settlement matching/variance, cash sessions/variance, and report duration/freshness. Send `Authorization: Bearer <METRICS_BEARER_TOKEN>`. The endpoint returns `401` for invalid credentials, `503` when authentication is not configured, and `503` when live aggregate collection fails.
- The endpoint has no application-level identity labels and should also be restricted to the monitoring network at the deployment ingress. Metric labels use only documented fixed enums; IDs, emails, provider references, and payroll-sensitive fields are excluded. See [finance-operations-runbook.md](finance-operations-runbook.md#finance-operational-metrics) for names, units, labels, definitions, and investigation thresholds.

---

## Promotion governance (C05)

The promotion backend exposes platform administration, store-manager participation, analytics, media, and public discovery through the [frozen promotion contract](promotions-contract.md#7-endpoint-contract).

- Platform: `POST/GET /promotions`, `GET/PUT/DELETE /promotions/:id`, `POST/DELETE /promotions/:id/images`, and `GET /promotions/:id/analytics`; requires `platform.promotions.manage`.
- Same-store manager: `GET /stores/:storeId/promotions` and `PUT /stores/:storeId/promotions/:promotionId/setting`; requires `store.promotions.toggle`. Platform admins do not override manager choices.
- Public: `GET /promotions/offers?storeId=...` and `GET /promotions/featured?storeId=...`; offer DTOs exclude coupons, codes, budgets and internal usage.

Definition writes are strict and version-checked. Store disable requests require a reason. Media uses one decoded JPEG/PNG/WebP file, a desktop/mobile variant and useful alt text. See [promotion operations](promotions-operations.md) for storage, replacement, cleanup and analytics semantics.

Promotion-aware public quotes and owned-cart coupon validation are implemented in C06; COD order/application persistence is implemented in C07. Online initiation/recovery remains on temporary v3 checkout scaffolding until C08 moves every payment finalizer to application collections. Finance integration, remaining order DTO cleanup and frontend consumption follow in C09/C10/C13. These slices are released together.

## Authentication legend

| Symbol | Meaning |
| --- | --- |
| 🔒 | Requires `Authorization: Bearer <jwt>` header |
| 🛡️ | Requires admin role (`role === "admin"` in JWT) |
| (none) | Public endpoint |
