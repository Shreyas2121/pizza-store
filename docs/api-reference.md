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

**Query params:**
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

Add a product to cart (creates cart if needed).

**Body:**
```json
{
  "productId": 1,
  "cIds": [3, 5]
}
```
`cIds` is an array of customization option IDs. Pass empty array for no customizations.

**Response `200`:**
```json
{
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

Get full cart with items, product details, and customizations.

**Response `200`:**
```json
{
  "data": {
    "id": 1, "totalPrice": 547,
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

Update cart item quantity.

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

**Body:**
```json
{
  "addressId": 1,
  "totalPrice": 547,
  "paymentType": "cash",
  "couponId": null,
  "discountAmount": 0
}
```

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

### `POST /payments/process-cod` 🔒

Process a Cash on Delivery payment.

**Body:**
```json
{
  "orderId": 42
}
```

**Response `200`:**
```json
{
  "data": {
    "paymentId": 1,
    "paymentType": "cash",
    "message": "Order placed successfully with Cash on Delivery"
  }
}
```

---

## Coupons

### `POST /coupon` 🔒🛡️

Create a coupon.

### `GET /coupon` 🔒🛡️

List all coupons.

### `PUT /coupon/:id` 🔒🛡️

Update a coupon.

### `POST /coupon/validate`

Validate a coupon code against an order total.

**Body:**
```json
{
  "code": "SAVE20",
  "total": 500
}
```

**Response `200`:**
```json
{
  "data": { "id": 1, "code": "SAVE20", "discountType": "percentage", "discountValue": 20, ... }
}
```

### `POST /coupon/redeem`

Redeem a coupon for an order.

**Body:**
```json
{
  "code": "SAVE20",
  "orderId": 42
}
```

---

## Dashboard

### `GET /dashboard` 🔒🛡️

Get dashboard metric cards.

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

Get time-series chart data.

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
