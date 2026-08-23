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
store-specific price. Without `storeId`, the existing global catalog behavior
is preserved.

**Query params:**
- `storeId` (optional) — scope the catalog to a resolved store
- `menuSlug` (optional) — filter by menu slug
- `page` (default `1`) — page number
- `sortBy` (default `"default"`) — `"default"`, `"price_low"`, `"price_high"`

**Response `200`:**
```json
{
  "data": [ { "id": 1, "name": "...", "price": 299, "image": "/uploads/..." } ],
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
- `price` — number
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
        "options": [ { "id": 1, "name": "Small", "price": 0 }, { "id": 2, "name": "Large", "price": 50 } ]
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
  { "productId": 1, "price": 299, "isAvailable": true },
  { "productId": 2, "price": 349, "isAvailable": false }
]
```

### `PUT /stores/:storeId/products/:productId` 🔒🛡️

Update a mapped product's store-specific price, availability, or both.

**Body:**
```json
{
  "price": 319,
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
    "id": 1, "storeId": 2, "totalPrice": 547,
    "store": { "id": 2, "name": "PizzaStore - Koramangala" },
    "items": [
      {
        "id": 1, "productId": 3, "quantity": 2, "price": 199,
        "product": { "id": 3, "name": "Margherita", "image": "..." },
        "customizations": [ { "optionId": 5, "name": "Extra Cheese", "price": 49 } ]
      }
    ]
  }
}
```

### `GET /cart/checkout` 🔒

Get cart summary for checkout (cart without items).

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

### `DELETE /cart/:cartItemId` 🔒

Remove an item from cart.

---

## Orders

### `POST /order` 🔒

Create an order from the current cart.

The order's store is copied from the cart. Before creating the order, the
backend locks the cart, verifies that the store is active/open, checks address
ownership and delivery coverage, and revalidates product availability. The
backend calculates subtotal, discount, and total from item/customization price
snapshots; client-supplied monetary values are rejected. Order, COD payment,
coupon consumption, item snapshots, and cart deletion commit atomically.

**Body:**
```json
{
  "addressId": 1,
  "paymentType": "cash",
  "couponCode": "SAVE20"
}
```

`couponCode` is optional or nullable. `paymentType` defaults to `cash`.

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
- `status` — `"pending"`, `"preparing"`, `"delievered"`, `"cancelled"`

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

### `POST /payments/razorpay/orders` 🔒

Create or resume an online checkout attempt. The backend locks and validates
the cart, calculates the amount, snapshots an `awaiting_payment` order, creates
its linked payment, reserves coupon capacity, and clears the snapshotted cart
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

If Razorpay order creation fails, the payment becomes `failed` and any coupon
reservation is released. The local order stays `awaiting_payment` so it can be
retried. The `502 PAYMENT_INIT_FAILED` response includes the safe local order
and payment IDs so the client can link to that recovery path. A concurrent
duplicate request can temporarily return
`checkoutReady: false` while the first request owns provider creation; use the
status endpoint before retrying.

### `GET /payments/razorpay/orders/:localOrderId` 🔒

Return the current user's checkout-safe payment state. It never returns API or
webhook secrets. Returns `404` for another user's order and for COD orders.

### `POST /payments/razorpay/orders/:localOrderId/retry` 🔒

Retry provider-order creation for a failed or not-yet-claimed local attempt. A
stored Razorpay Order is reused; it is never recreated. If a failed attempt used
a coupon, capacity is locked and reserved again before retrying. Requests made
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
paid timestamp, consumes the coupon reservation once, and moves fulfillment
from `awaiting_payment` to `pending` atomically. Repeated verification returns
the same success with `finalizedNow: false`; only the first commit emits
`orderPlaced`.

Important error codes include `PAYMENT_SIGNATURE_INVALID`,
`PAYMENT_ORDER_MISMATCH`, `PAYMENT_PROVIDER_MISMATCH`,
`PAYMENT_NOT_CAPTURED`, and `PAYMENT_PROVIDER_UNAVAILABLE`. An `authorized`
payment is not fulfillment-ready.

---

## Coupons

### `POST /coupon` 🔒🛡️

Create a coupon.

### `GET /coupon` 🔒🛡️

List all coupons.

### `PUT /coupon/:id` 🔒🛡️

Update a coupon.

### `POST /coupon/validate`

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
  "data": { "id": 1, "code": "SAVE20", "discountType": "percentage", "discountValue": 20, ... }
}
```

Coupon redemption is internal to the order transaction. The former public
`POST /coupon/redeem` endpoint has been removed to prevent replay and
cross-order redemption.

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
      "label": "Revenue",
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

## Authentication legend

| Symbol | Meaning |
| --- | --- |
| 🔒 | Requires `Authorization: Bearer <jwt>` header |
| 🛡️ | Requires admin role (`role === "admin"` in JWT) |
| (none) | Public endpoint |
