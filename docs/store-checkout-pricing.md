# Store checkout pricing setup

New stores created through the app now receive three initial pricing rules in the same transaction as the store record:

| Rule | Initial demo value |
| --- | --- |
| Delivery | ₹40; free delivery from an item subtotal of ₹500 |
| Item demo tax | 5% inclusive; `21069099-DEMO` |
| Delivery demo tax | 5% inclusive; `996331-DEMO` |

The rules start on the current business date in the store's configured timezone. Demo tax is not a statutory tax invoice. The create-store form displays these defaults before submission. Store creation still requires separate product mapping, stock and delivery-zone setup.

Quote pricing policy v5 applies the configured free-delivery threshold to the item subtotal before promotions, including customizations. A subtotal equal to or greater than ₹500 receives ordinary free delivery under the default rule; a null threshold disables this benefit, while zero makes delivery free for any valid cart. Delivery promotions operate on the remaining ordinary fee and do not claim savings when it is already zero. Included delivery tax is also zero when delivery is free. Existing saved order snapshots are preserved; refresh cart/checkout quotes after updating the server.

## Repair an existing manually created store such as Fort

1. Sign in as a platform admin and open **Admin → Stores** (`/admin/stores`).
2. On Fort's card, choose **Checkout pricing**.
3. Inspect the store business date and all three applicable rule sections. The screen distinguishes missing rules from configured rules and overlaps.
4. If rules are missing, choose **Initialize missing demo rules**. This fills only missing components; valid current delivery/tax rules are preserved, including custom amounts and rates.
5. Confirm **Checkout pricing ready**. Refresh the customer's cart to obtain a fresh server quote, then continue checkout.

This action does not run a seed/reset, overwrite order snapshots or change unrelated stores. It starts missing defaults today, not retroactively. If future rules are scheduled, the new default ends the day before their start. Date boundaries are inclusive. A missing component receives the next version number for its store/component. Overlapping current rules produce `409 PRICING_RULES_OVERLAP` and require a separate deliberate correction; initialization will not guess which rule to delete.

## API and implementation

- `GET /api/v1/stores/:id/checkout-pricing`: platform-admin-only readiness, business date, defaults and applicable rules.
- `POST /api/v1/stores/:id/checkout-pricing/initialize`: platform-admin-only initialization; no configurable request fields. Repeated requests do not create additional applicable rules.
- Both use existing store-admin authorization. Initialization locks the store row, checks all components before inserting, and audits a repair as `store.checkout_pricing.initialized` in the same transaction.
- `backend/src/features/stores/store-pricing-setup.ts` defines defaults and gap/version planning. `stores.service.ts` integrates atomic store creation and existing-store repair. Existing quote selection and tax calculations remain authoritative.

This is an initial-defaults path, not a general editor for changing existing rule versions or resolving overlaps. It uses the existing pricing tables and needs no new migration. Tests exercise default quote generation, partial missing configuration, preservation, date/version boundaries, repeat requests, authorization, locking and audit behavior with an in-memory/mocked repository. Live database/concurrency and Fort's actual cart remain manual verification steps; no database setup scripts are part of this fix.
