# Cart and catalogue invalidation

C13 review reproduced two cache bugs: invalidating `cartKeys.all` did not invalidate the cart/detail/count queries, and invalidating `catalogKeys.all` did not invalidate the store menu query. Both prefixes existed, but the actual query keys were unrelated strings. Checkout failure and product stock-error handlers therefore left cached data unchanged.

Cart and catalogue query keys now start with their authoritative feature root. Existing helper-based mutations keep their specific invalidation prefixes; checkout failure handlers and stock-error handlers can invalidate the entire feature. Account IDs added by the prior cache-isolation fix remain in cart read keys. No backend, request shape or pricing calculation changes.

Both regression tests failed before the change. The frontend gate validates the fix independently before the C13 feature commit. This prerequisite expands C13 into the cart and catalogue query-key boundary; see the C13 handoff for final integration evidence. No live database checks were run.
