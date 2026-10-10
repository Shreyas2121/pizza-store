# Client cache isolation and invalidation

Private server-state identity includes the authenticated principal. A query key that only contains an order ID or endpoint name can display another account's cached result after switching accounts, even when the server rejects unauthorized requests. Logout does not universally clear the QueryClient, so correct keys remain necessary.

Access capabilities use `accessKeys.principal(userId)` and cancellation signals; `accessKeys.me()` stays an invalidation prefix. Checkout quotes, customer/staff orders, cart, address and profile reads include principal identity. Anonymous public quotes have a separate null-principal identity. Private non-suspense reads disable without a principal, and order details validate a positive ID. Staff/store reads avoid carrying placeholder results across stores/principals.

Cart clearing updates the captured principal's cache. Shared query transport and POST quotes forward cancellation signals so an obsolete account request cannot populate the new account's cache. Cart/catalogue keys use their actual feature root, allowing stock and checkout failure handlers to invalidate all relevant data.

Current source and regression evidence:

| Boundary | Evidence |
| --- | --- |
| Capabilities and prefix invalidation | [Access keys/tests](../frontend/src/features/access/model/access.keys.test.ts) |
| Private reads and account switching | [Frontend test suite](../frontend/package.json); checkout, orders, account and cart feature tests |
| Cart/catalogue invalidation | [Cart API](../frontend/src/features/cart/api/cart.queries.ts), [catalogue API](../frontend/src/features/catalog/api/product.queries.ts) |
| Cancellation-aware transport | [Query helpers](../frontend/src/shared/api/query-helpers.ts), [checkout queries](../frontend/src/features/checkout/api/quote.queries.ts) |

The full frontend suite passed during [the current audit](case-study-verification.md). These tests exercise key/transport/UI policies, not a live browser account-switch or two-store security session. Backend authentication and resource authorization remain authoritative.
