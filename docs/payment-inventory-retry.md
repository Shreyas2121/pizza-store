# Inventory reservation recovery

The [architecture](architecture.md) and [promotion operations](promotions-operations.md) describe discovery, locked quote, reservation, capture and accounting. Frontend retry shows the saved payable total and posts the owned order ID; it does not submit a new promotion or recompute the amount. Current offline evidence is in [verification](case-study-verification.md); this audit did not run a live provider retry.

Payment retry restores the original inventory reservation rows and quantities, including saved bundle component demand. It checks current availability against all active reservations while locking store products and then reservation rows in ascending ID order. A shortage rejects the whole retry transaction before any released reservation changes. Repeated restoration leaves active rows unchanged; consumed rows cannot be restored. Restored rows receive the same named 30-minute reservation duration as initial checkout.

Capture marks a saved reservation consumed even when stock tracking was disabled after checkout. It makes no stock movement for an untracked product. Previously this case left the reservation active indefinitely; `inventory-retry.service.test.ts` covers the correction.

The caller must hold order, user and store locks, and must restore promotion capacity in the same transaction before making another provider payment available. The current payment service/finalizer integrates these operations. Query/unit tests do not establish PostgreSQL concurrency behavior; database checks remain deferred.

First-order eligibility excludes an `awaiting_payment` order whose payment is failed, while still excluding pending/preparing/out-for-delivery/delivered orders from first-order promotions. Previously the promotion query counted failed online attempts until expiry cancelled their order. The eligibility query now checks failed payment state explicitly; its generated SQL is covered without connecting to a database.
