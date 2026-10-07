# Inventory reservation recovery

Payment retry restores the original inventory reservation rows and quantities, including saved bundle component demand. It checks current availability against all active reservations while locking store products and then reservation rows in ascending ID order. A shortage rejects the whole retry transaction before any released reservation changes. Repeated restoration leaves active rows unchanged; consumed rows cannot be restored. Restored rows receive the same named 30-minute reservation duration as initial checkout.

Capture marks a saved reservation consumed even when stock tracking was disabled after checkout. It makes no stock movement for an untracked product. Previously this case left the reservation active indefinitely; `inventory-retry.service.test.ts` covers the correction.

The caller must hold order, user and store locks, and must restore promotion capacity in the same transaction before making another provider payment available. C08 integrates these operations. Query/unit tests do not establish PostgreSQL concurrency behavior; database checks remain deferred.
