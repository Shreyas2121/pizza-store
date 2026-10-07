# Checkout and order account isolation

During C13 review, six regression cases demonstrated that authenticated quote, order detail/history, cart, address and profile reads reused another account's cached result after the principal changed. Their query keys contained request/resource identifiers but no account identifier. Login/logout does not clear the query client.

The prerequisite fix scopes these reads by authenticated user ID. Anonymous public quotes retain a separate null-principal key. Private non-suspense reads are disabled without a principal, and order details require a positive integer ID. Order lists no longer carry placeholder results between principals or staff stores. Existing unscoped key helpers remain invalidation prefixes; hook reads always pass a principal. Cart clearing updates only the captured principal's cache. Query helpers and checkout POST quotes now forward cancellation signals to Axios.

The change touches checkout/orders plus their profile, address and cart inputs and the shared query transport helper. It changes cache identity and cancellation, not backend authorization or pricing. All six cases failed before the change and passed afterward. Frontend tests, lint, typecheck and build are the commit gates; C13's handoff records final integration results. No database or browser checks were run.
