# PizzaStore Developer Use, Manual Testing, and Recruiter Demo Guide

> **Prepared:** 2026-09-09  
> **Audience:** The project developer, reviewers, and recruiters  
> **Purpose:** Learn the application by using it, verify every important workflow, and present it honestly and confidently.  
> **Truth rule:** An automated test proves only the behavior it exercises. A successful build does not prove the browser workflow. Do not call a feature “tested” until you have personally completed the applicable checklist in this guide.

---

## 1. What this application is

PizzaStore is three related products in one repository:

1. **Customer storefront** — store selection by delivery pincode, catalogue browsing, customizations, cart, server-authoritative pricing, coupons, checkout, COD or simulated online payment, order tracking, addresses, and support chat.
2. **Staff operations workspace** — dashboards, order fulfilment, inventory, store configuration, staff access, audit history, finance, payroll, support, and destructive system maintenance. What a user can see and do depends on their platform role, store membership, and selected store.
3. **Public engineering case study** — unauthenticated `/docs` pages explaining architecture, transaction boundaries, payment recovery, inventory contention, design decisions, and verification evidence. This is the best recruiter entry point because it works without the API.

The most distinctive engineering story is not “a pizza UI.” It is the connection between commerce and management accounting:

```text
customer checkout
    -> order/payment/inventory source records
    -> transactional financial outbox
    -> idempotent posting worker
    -> balanced append-only journals
    -> store and consolidated reports
    -> CSV and journal drill-down evidence
```

The project is a portfolio management-accounting system. It is not production payment infrastructure, statutory accounting software, a tax filing product, or statutory payroll.

---

## 2. How I recommend you learn and use it

Do not begin by randomly clicking every admin page. Use this order:

1. Reset to the deterministic demo dataset.
2. Read the public case study for the architectural vocabulary.
3. Complete one customer order from pincode selection to order history.
4. Complete that order’s fulfilment as staff.
5. Follow the resulting financial event into a journal and report.
6. Test store isolation with non-admin staff.
7. Test failure cases and permission denials.
8. Reset again before recording screenshots or giving a recruiter demo.

This sequence teaches the causal relationships. You should be able to explain why each row, status, and amount exists rather than only naming screens.

### Suggested learning schedule

| Session | Time | Goal |
| --- | ---: | --- |
| Environment and reset | 30–60 min | Reproduce the app from an empty local database |
| Customer workflow | 30 min | Understand pincode, cart, quote, checkout, and order states |
| Operations workflow | 45 min | Understand store scope, orders, inventory, and realtime updates |
| Finance workflow | 60–90 min | Understand outbox posting, journals, reports, expenses, cash, refunds, and settlements |
| Authorization workflow | 45–60 min | Exercise each fixed role and cross-store denial |
| Payroll workflow | 45–60 min | Understand effective compensation, actor separation, posting, and reversal |
| Presentation rehearsal | 30 min | Deliver the 5- and 15-minute recruiter tours without notes |

---

## 3. First-time local setup

### 3.1 Prerequisites

- Node.js 22.13.0 or newer
- pnpm
- PostgreSQL 15 or newer
- A desktop browser with DevTools
- Preferably two browser profiles, or one normal window plus an incognito window, for realtime and role tests

There is currently no Docker Compose setup. PostgreSQL must already be installed or otherwise available.

### 3.2 Install dependencies

From `F:\Shreyas\food`:

```powershell
pnpm install
```

The root is a pnpm workspace containing `backend` and `frontend`. Use root scripts when they exist so both packages are handled consistently.

### 3.3 Create a local database

Example with `psql`:

```powershell
psql -U postgres -c "CREATE DATABASE pizzastore;"
```

Use a disposable local database for the demo. Never point `demo:reset` at data you care about.

### 3.4 Backend environment

Create `backend/.env`. Use your own random secrets; do not copy real production credentials into a portfolio environment.

```env
NODE_ENV=development
PORT=3000

DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=<your-local-postgres-password>
DB_NAME=pizzastore

JWT_SECRET=<long-random-development-secret>
JWT_ALGORITHM=HS256
JWT_ISSUER=pizzastore-api
JWT_AUDIENCE=pizzastore-web
JWT_EXPIRES_IN=6h

FE_URL=http://localhost:3150
PAYMENT_PROVIDER_MODE=simulator
RAZORPAY_ENABLED=false

METRICS_BEARER_TOKEN=<dedicated-random-secret-at-least-32-characters>

# Optional. Required only before writing encrypted bank/PAN-like demo fields.
# PAYROLL_ENCRYPTION_KEY=<different-random-secret-at-least-32-characters>
```

Important environment behavior:

- `PORT` must currently be a four-character value such as `3000`.
- `DATABASE_URL` can replace the individual `DB_*` values.
- Simulator mode is the recommended local and recruiter-demo payment mode.
- Razorpay live mode is intentionally rejected.
- Production startup requires `METRICS_BEARER_TOKEN`; `/metrics` fails closed when it is unconfigured.
- Keep JWT, metrics, Razorpay, and payroll encryption secrets separate.

### 3.5 Frontend environment

Create `frontend/.env`:

```env
VITE_BACKEND_URL=http://localhost:3000
```

Optionally add `VITE_DOCS_REPOSITORY_URL` only after the repository has a verified public HTTPS URL.

### 3.6 Migrate and create the deterministic demo

From the repository root:

```powershell
pnpm run db:migrate
pnpm demo:reset
```

`demo:reset` is destructive. It truncates local application tables and restarts identities. Safety code refuses production, non-development, and non-local database targets. The reset creates:

- two active stores;
- catalogue, menus, customizations, product mappings, stock, and standard costs;
- chart-of-account data;
- customer, owner, and finance-manager personas;
- orders, payments, a partial refund, settlements, a COD cash variance, expenses, compensation history, pay runs, financial events, balanced journals, and a closed July period;
- a deterministic July–August 2026 reporting scenario.

Run the reset whenever you need to discard experiments and return to known data.

### 3.7 Start the application

From the repository root:

```powershell
pnpm dev
```

Expected local URLs:

| Service | URL |
| --- | --- |
| Storefront | `http://localhost:3150/` |
| Public case study | `http://localhost:3150/docs` |
| Staff workspace | `http://localhost:3150/admin` |
| API prefix | `http://localhost:3000/api/v1` |
| Prometheus metrics | `http://localhost:3000/metrics` |

There is no dedicated health endpoint. Verify startup by checking:

- backend logs report database connectivity;
- `http://localhost:3000/api/v1/menu` returns JSON;
- the storefront renders product images;
- browser DevTools Network shows successful calls to port `3000`;
- the console has no uncaught errors.

Test authenticated metrics from PowerShell:

```powershell
$headers = @{ Authorization = "Bearer <your-METRICS_BEARER_TOKEN>" }
Invoke-WebRequest -Uri "http://localhost:3000/metrics" -Headers $headers
```

Expect `401` with a wrong/missing token and Prometheus text with the correct token.

### 3.8 Store-hours trap

The seeded stores are open from `09:00` to `23:00` IST. Store resolution and checkout enforce operating hours. If you test outside that range, the storefront can correctly report that the store is closed. For a scheduled demo, either present during those hours or use the owner’s Stores page to set hours that include the presentation time.

---

## 4. Seeded personas and demo data

### 4.1 Built-in logins

These credentials exist only after `pnpm demo:reset`:

| Persona | Credentials | Access |
| --- | --- | --- |
| Platform owner | `admin@pizzastore.com` / `admin123` | Every store, global catalogue/support/system functions, consolidated finance, fiscal-period control |
| Customer | `customer@pizzastore.com` / `customer123` | Storefront, saved Mumbai address, cart, checkout, own orders, support |
| Finance manager | `finance@pizzastore.com` / `finance123` | Store-scoped finance access to both seeded stores; no global administration, payroll, or period control |

Do not deploy these credentials publicly.

### 4.2 Seeded stores

| Store | Slug | Service pincode | Hours |
| --- | --- | --- | --- |
| PizzaStore – Mumbai Central | `pizzastore-default` | `400001` | 09:00–23:00 IST |
| PizzaStore – Bengaluru South | `pizzastore-bengaluru-south` | `560034` | 09:00–23:00 IST |

The customer already has a Mumbai address using `400001`. Add a Bengaluru address with `560034` when testing store switching.

### 4.3 Finance date range

The deterministic finance fixture is in July and August 2026. The Finance workspace defaults to the current month, which can make the seeded reports appear empty.

For the prepared demo, set:

```text
From: 2026-07-01
To:   2026-08-31
Group reports by: Month
```

The seeded `PIZZA50` coupon is historical, expired after August 2026, and already consumed. It is evidence for the fixture, not a reusable current checkout coupon.

### 4.4 Create personas for every store role

The reset does not create manager, payroll-manager, operator, and inventory-staff logins. To test authorization properly:

1. Open the storefront in a separate browser profile.
2. Register fictional accounts such as:
   - `manager.demo@example.com`
   - `payroll1.demo@example.com`
   - `payroll2.demo@example.com`
   - `payroll3.demo@example.com`
   - `operator.demo@example.com`
   - `inventory.demo@example.com`
3. Sign in as the owner.
4. Select a store in the top-right store switcher.
5. Open **Staff** and use **Assign user**.
6. Assign the appropriate role.

Use at least three payroll users if you want to exercise segregation of duties. Calculation, approval, and payment cannot all be performed by the same actor. Use separate browser profiles and re-login immediately before high-risk commands because payroll and fiscal-period actions require a token issued within the preceding 15 minutes.

The development-only staff seed is useful after the accounts already exist:

```powershell
pnpm --filter backend seed:staff -- --actor=admin@pizzastore.com --store=pizzastore-default --member=manager:manager.demo@example.com --member=payroll_manager:payroll1.demo@example.com --member=operator:operator.demo@example.com --member=inventory_staff:inventory.demo@example.com
```

It assigns memberships; it does not create users or passwords.

### 4.5 Role expectations

| Role | What to exercise | What must be denied |
| --- | --- | --- |
| Platform admin | Global catalogue, both stores, all finance, support, audit, system clear | Nothing within the demo’s implemented admin scope |
| Manager | Store profile/products/zones, orders, inventory, staff, audit, reports, expenses, refunds, cash, settlement read, costs | Privileged staff roles, global catalogue, payment reconciliation, payroll, fiscal close, system clear |
| Finance manager | Reports, expenses including payment/posting, refunds, cash, settlements/reconciliation, ledger, costs | Order status changes, inventory mutation, payroll, fiscal close, global operations |
| Payroll manager | Payroll profiles/history and pay-run lifecycle for assigned store | General finance, orders, inventory, staff, global operations |
| Operator | Operations dashboard, order read/status update, inventory read, refund request, ordinary cash movements | Inventory writes, price/mapping changes, expense/ledger/settlement operations, privileged cash controls |
| Inventory staff | Dashboard, inventory mutations, store-product read/availability, cost read | Orders, general finance, product price/mapping, staff, payroll |
| Customer | Own addresses/cart/checkout/orders/support | Every staff route and other customers’ resources |

Backend authorization is the security boundary. Hidden frontend controls improve usability, but a direct API request must still be denied when unauthorized.

---

## 5. Screen and route map

### Public/customer routes

| Route | Purpose |
| --- | --- |
| `/` | Storefront and menu |
| `/cart` | Authenticated cart |
| `/checkout` | Authenticated quote and checkout |
| `/profile` | Read-only account overview |
| `/address` | Saved-address CRUD |
| `/orders` | Customer order history |
| `/order/:id` | Customer-owned order detail and payment retry |
| `/staff-invitations/accept?token=...` | Accept an invitation while signed in as the invited email |

### Staff routes

| Route | Main capability |
| --- | --- |
| `/admin` | Operations dashboard |
| `/admin/products` | Platform catalogue list |
| `/admin/product/new` | Create global product |
| `/admin/customization` | View customization groups and manage product assignment |
| `/admin/menu` | View and create storefront menu sections |
| `/admin/stores` | Store list and permission-specific actions |
| `/admin/stores/:id/products` | Store-specific mapping, price, and availability |
| `/admin/stores/:id/delivery-zones` | Delivery pincodes |
| `/admin/inventory` | Stock operations and movement history |
| `/admin/orders` | Store order queue |
| `/admin/order/:id` | Fulfilment detail and state transition |
| `/admin/finance` | Reports, refunds, expenses, settlements, cash, ledger, close, issues, configuration |
| `/admin/payroll` | Compensation history and pay runs |
| `/admin/staff` | Memberships and invitations |
| `/admin/audit` | Store/global audit history |
| `/admin/support` | Platform support queue |
| `/admin/support/:userId` | Active support conversation |
| `/admin/system` | Platform-admin destructive clear-all operation |

### Public engineering routes

| Route | What to learn or show |
| --- | --- |
| `/docs` | Project framing and three core engineering problems |
| `/docs/architecture` | Browser/API/database/provider boundaries |
| `/docs/order-lifecycle` | COD, online payment, retries, cancellation, and recovery |
| `/docs/inventory` | Reservations, locks, and deterministic last-item explorer |
| `/docs/decisions` | Alternatives, tradeoffs, and revisit triggers |
| `/docs/reliability` | Tests, recovery commands, evidence, and limitations |

---

## 6. Customer feature walkthrough

### 6.1 Registration and login

Test both a fresh registration and the seeded customer login.

Verify:

- invalid email and short password validation;
- duplicate email rejection;
- invalid credentials do not reveal whether the email exists;
- successful login restores authenticated navigation;
- logout removes access to `/cart`, `/checkout`, profile, and orders;
- expired or invalid tokens cause a clean logout rather than an error loop.

The current frontend stores the bearer token in `localStorage`. That is a documented security tradeoff: it avoids ambient-cookie CSRF but makes token theft possible after successful XSS. Do not present this as the final ideal session design.

### 6.2 Delivery-area/store resolution

1. Enter `400001` for Mumbai.
2. Confirm the resolved store name and hours appear.
3. Browse products and note store-specific price/availability.
4. Try `560034` and confirm Bengaluru resolves.
5. Try an unsupported six-digit pincode and expect a clear failure.
6. Switch pincode with a non-empty cart and verify the app requires cart/store consistency.

What to explain: store selection is not a cosmetic filter. Cart, quote, inventory, order, and later finance records carry store scope.

### 6.3 Catalogue and menu

Verify:

- menu sections load and navigate/filter products;
- pagination or “load more” behavior works beyond ten products;
- price-low and price-high sorting are correct;
- vegetarian marks are correct;
- images load from the backend `/uploads` path;
- unavailable products disappear or become non-orderable as intended;
- low-stock and out-of-stock states match inventory availability, not only on-hand stock;
- customizable pizza items open the customization drawer;
- required single-choice groups and optional multiple-choice groups validate correctly;
- customization price additions update the displayed price.

The browser display is not authoritative. The server recalculates product, customization, delivery, discount, and tax amounts during quote and checkout.

### 6.4 Cart

1. Add a standard product.
2. Add a customized pizza with size, crust, and optional toppings.
3. Increase and decrease quantities.
4. Edit customizations.
5. Remove an item and test the five-second undo action.
6. Refresh the page and confirm server-side cart persistence.
7. Try to increase beyond available stock and expect a stock-specific error plus refreshed cart/catalogue state.
8. Confirm checkout stays disabled when pincode/store/cart do not match.

What to explain: the cart is a draft. Checkout uses a fresh server quote and rechecks availability.

### 6.5 Addresses and profile

Use `/address` to create, edit, and delete Home, Work, or Other addresses. Verify:

- pincode is six digits;
- phone and required fields validate;
- checkout initially selects the first matching address;
- an address from a different pincode cannot be used for the resolved store;
- another user cannot access or mutate the address by guessing its ID.

`/profile` is intentionally read-only. There is no profile-edit workflow in the current API/UI.

### 6.6 Checkout and server quote

Use the customer account and pincode `400001`:

1. Build a cart.
2. Open checkout.
3. Confirm customer, store, address, item subtotal, customizations, delivery, discount, tax disclosure, and grand total.
4. Change the address or coupon and confirm the quote refreshes.
5. Confirm checkout blocks mismatched pincode, closed store, missing address, empty cart, and unavailable inventory.

Amounts are internally integer paise. Some UI entry fields deliberately accept rupees, while finance controls labelled “paise” accept whole paise. Read every field label.

### 6.7 COD order

1. Choose **Cash on delivery**.
2. Place the order.
3. Confirm navigation to `/order/:id`.
4. Confirm the order begins `pending` and payment remains pending until delivery.
5. Confirm the cart is cleared.
6. In a staff session, progress the order through `preparing -> out_for_delivery -> delivered`.
7. Refresh the customer detail and verify the timeline updates.

Expected valid order transitions:

```text
awaiting_payment -> pending or cancelled
pending          -> preparing or cancelled
preparing        -> out_for_delivery or cancelled
out_for_delivery -> delivered or cancelled
delivered        -> terminal
cancelled        -> terminal
```

Same-status retries are idempotent. Invalid jumps should return a conflict rather than silently changing history.

### 6.8 Simulated online payment

Keep `PAYMENT_PROVIDER_MODE=simulator`:

1. Choose **Pay online**.
2. Submit checkout.
3. The backend creates a local order and reservation, runs the deterministic successful simulator event, reconciles it, and finalizes capture.
4. Confirm the order reaches `pending` only after successful payment finalization.
5. Confirm payment detail is completed and the order can now enter fulfilment.

The simulator is the preferred recruiter flow: no credentials, provider network, pop-up, or webhook tunnel are required. Razorpay Test Mode is optional and should be demonstrated only after following `docs/razorpay-test-credentials.md` and `docs/razorpay-runbook.md`. Never use live credentials; live mode is unsupported.

### 6.9 Order history and ownership

Verify status filters on `/orders`, open details, and confirm:

- the timeline matches the state;
- item/customization snapshots and totals remain stable;
- coupon details appear for historical discounted orders;
- an `awaiting_payment` online order offers retry/status recovery;
- one customer cannot read another customer’s order by changing the URL ID;
- staff access is based on the order’s store, not on customer ownership.

### 6.10 Customer support and realtime chat

Use two browser profiles:

1. As customer, click the floating **Support** button and submit a subject.
2. As owner, open `/admin/support`; the pending request should appear, including realtime notification behavior.
3. Accept it and open the conversation.
4. Exchange messages in both windows and verify messages appear without refreshing.
5. Test Enter to send and Shift+Enter for a newline.
6. Reject a new pending request and verify the customer receives status feedback.

The current UI supports pending acceptance/rejection and open chat. The API supports a `close` status, but the staff UI does not expose a clear “Close conversation” control; record this as a current UI gap rather than pretending the lifecycle is complete.

---

## 7. Staff operations feature walkthrough

### 7.1 Store scope and navigation

The top-right selector is fundamental:

- platform owner can choose **All Stores (Global)** or one store;
- multi-store staff can choose only assigned stores;
- single-store staff receive that store automatically;
- store-specific pages require a selected store;
- finance owner reports can be consolidated while individual mutations still require a store.

Use a desktop viewport while learning. The current store selector is hidden below the `sm` breakpoint, so mobile staff-store switching needs a separate UX review.

After switching stores, verify every table, KPI, chart, mutation, and cached query reflects the new store. This is a critical isolation test.

### 7.2 Dashboard

The dashboard contains:

- date-range selection;
- KPI cards and comparison with a previous period;
- gross order value trend;
- order-volume chart;
- low-stock information;
- first five pending orders;
- realtime new-order notifications linking to order detail.

Test a customer order while the owner or operator dashboard is open. Confirm only the correct store audience gets the notification.

Current UX caveat: the Dashboard navigation is visible to every staff account, while the dashboard APIs require operations permissions. A payroll-only user may see failed/empty dashboard regions before opening Payroll. Backend denial is correct; the frontend landing experience should be improved before calling it polished.

### 7.3 Orders and fulfilment

1. Select a store.
2. Filter the order queue by status.
3. Search by customer.
4. Open an order.
5. Review payment, address, items, customizations, coupon, total, and next-action guidance.
6. Apply only a valid next transition.
7. Confirm terminal orders cannot be modified.
8. Confirm finance managers have read-only order access and managers/operators can update status.
9. Change to the other store and verify the order disappears.

### 7.4 Inventory

The inventory screen exposes:

- search and status filters;
- pagination;
- on-hand, reserved, available, threshold, and derived stock status;
- single restock;
- adjustment to an absolute count;
- low-stock threshold update;
- selection and bulk restock, up to 50 products;
- immutable movement history.

Recommended test:

1. Record the starting on-hand/reserved/available values.
2. Restock by 5 and verify movement history.
3. Adjust to a valid absolute count with a reason.
4. Try adjusting below reserved stock and expect denial.
5. Set the threshold equal to available stock and verify low-stock presentation.
6. Select two products and bulk restock.
7. Place an online payment attempt and observe reservations affect available stock.
8. Deliver/cancel/reconcile as appropriate and observe consumption or release.

Current UX caveat: the row action menu is rendered for inventory readers even when their role lacks one or more mutation permissions. The backend still denies unauthorized writes. Explicitly test operator and finance-manager denial, and treat action-level hiding as remaining frontend polish.

### 7.5 Platform catalogue

Only platform admins can use these pages:

- **Products** lists global products, category, diet, base price, global availability, and customization status.
- **Create product** accepts name, category, description, rupee price, vegetarian flag, and an image.
- **Customization** displays groups/options and manages which products use each group.
- **Menu** lists storefront sections and creates a section with image, position, category-filtered product selection, and mapping.

Test that a new product is not automatically a complete storefront offering. It may need:

1. a category;
2. customization-group mapping if appropriate;
3. menu-section mapping;
4. store-product mapping;
5. store price and availability;
6. inventory and standard cost.

Current UI scope:

- product creation is exposed, but product edit/delete is not;
- customization product assignment is exposed, but group/option creation is API-only;
- menu section creation is exposed, but full menu edit/delete controls are not;
- category creation and coupon administration are API-only.

These are valid implemented APIs but incomplete admin-product UX. Present them as such.

### 7.6 Stores, products, and delivery zones

On `/admin/stores`:

- owner can create stores and activate/deactivate them;
- owner and authorized managers can edit store profile details;
- manager edits intentionally omit platform-only slug and active-state fields;
- product and delivery-zone links appear only with matching read permission.

On a store’s Products page:

- mapping-authorized managers can add/remove global products;
- managers can update store-specific price and availability;
- inventory staff can update availability only;
- finance managers/operators can read mappings but cannot mutate them.

On Delivery zones:

- readers can list pincodes;
- managers can add up to 100 six-digit pincodes and remove them;
- storefront resolution should immediately reflect the active zone set.

Test the URL boundary directly: a user authorized for Store 1 must not gain Store 2 access by changing `:id` in the address bar.

### 7.7 Staff memberships and invitations

Membership actions include:

- assign an existing registered user;
- invite an email;
- resend/revoke a pending invitation;
- change role;
- suspend/reactivate;
- revoke.

Important rules to test:

- managers can manage only operators and inventory staff;
- owner is required for manager, finance-manager, and payroll-manager roles;
- a user cannot elevate their own membership;
- an active store cannot lose its final active manager;
- suspend/revoke affects the next authorized HTTP request;
- local-process sockets for the affected user are disconnected after commit;
- invitation is single-use, expires, and must match the signed-in normalized email;
- assigning staff does not change `users.role`; store role and platform role are separate.

In development, an invitation URL is displayed once in memory. Copy it immediately. Production invitation delivery is deliberately not implemented and fails closed; do not advertise email delivery as complete.

### 7.8 Audit history

The audit page supports:

- global history for owner or store-only history for manager;
- store, action, actor-user-ID, and date filters;
- resource identifiers;
- success/denied outcome badges;
- allow-listed safe metadata.

Perform a staff change, inventory adjustment, store-product change, order transition, and high-risk finance action, then find each record. Confirm secrets, bank/PAN-like identifiers, compensation amounts, payment references, raw provider payloads, and receipt contents are not exposed in audit metadata.

---

## 8. Finance and management-accounting walkthrough

Select the owner account, set the report range to `2026-07-01`–`2026-08-31`, and begin with **All Stores (Global)**. Then compare each seeded store.

### 8.1 Reports

#### Overview

Use it to inspect high-level ledger-backed totals and payment summaries. Click report aggregates to open filtered journal drill-down. Verify the selected date range, scope, currency, report generation metadata, and last reconciliation time.

#### Profit & loss

Explain:

- delivered-order revenue recognition;
- snapshotted standard COGS;
- gross profit;
- operating expenses excluding payroll;
- payroll employer cost visibility;
- operating result;
- comparison period and monthly/quarterly/fiscal-year grouping.

Payroll cost and the derived operating result are suppressed for report viewers without payroll access so payroll cannot be reconstructed by subtraction.

#### Sales & margin

Inspect sales, item/category margin, cost coverage, and drill-down. A missing cost snapshot should be shown as an evidence gap, not silently treated as zero cost.

#### CSV exports

Download Overview, P&L, Sales, and Margin CSVs. Verify:

- screen and CSV current totals agree;
- filenames and headings are deterministic;
- the business-date/timezone basis is explicit;
- amount units are explicit;
- formula-like text is safely encoded;
- suppressed payroll cells remain blank where required.

Run the deterministic cross-check from the repository root:

```powershell
pnpm finance:reconcile-fixture
```

This compares all seeded store and consolidated reports/exports to checked-in expected results.

### 8.2 Payments and refunds

The refund workflow is:

```text
requested -> approved -> submitted/processing -> processed
         \-> rejected
processing/submission -> failed -> retry/reconcile
```

Test:

1. Request a partial refund against an eligible order.
2. Allocate the exact refund across item/delivery components.
3. Attempt self-approval and expect denial.
4. Approve as a different eligible actor.
5. For COD, explicitly confirm cash was returned.
6. For simulator online payment, observe deterministic provider evidence.
7. Run the posting worker and drill into the refund journal.
8. Retry only a failed refund; do not create a second request to hide an uncertain result.

Manager approval is amount-limited by `REFUND_MANAGER_APPROVAL_LIMIT_PAISE`; finance manager or owner handles broader authority.

### 8.3 Expenses and private receipts

Expense lifecycle:

```text
draft -> submitted -> approved -> paid -> posted
                   \-> rejected
pre-post states -> voided
posted -> reversed
```

Test:

1. In Configuration, confirm vendor and mapped expense category data.
2. Create a draft with subtotal, included tax, and allocations whose paise total exactly equals the expense total.
3. Upload a PDF/JPEG/PNG/WebP receipt up to 5 MiB.
4. Confirm the receipt downloads only through the authenticated endpoint and is not reachable through public `/uploads`.
5. Submit as creator.
6. Attempt creator self-approval and expect denial.
7. Approve as another actor.
8. Record payment as an independent finance actor.
9. Post the source event.
10. Run the posting worker and inspect the journal.

Never edit posted history. Void eligible pre-post states with a reason. A paid void requires real payment-reversal evidence. Reverse a posted expense to create an exact opposite journal.

### 8.4 Settlements

The seeded safe fixture IDs are:

- `set_m1_s1_001` for Store 1;
- `set_m2_s2_001` for Store 2.

The reset already imports/reconciles fixture data, so inspect it first. To rehearse import on a reset state where applicable:

1. select **Checked-in fixture**;
2. enter the ID corresponding to the selected store;
3. confirm the import acknowledgement;
4. import/sync;
5. run deterministic matching;
6. inspect every provider line, fee/tax, local payment/refund source, and match state.

An identical re-import is an idempotent no-op. Different content under the same provider settlement ID is a conflict.

### 8.5 Reconciliation issues

Issues identify missing-local, missing-provider, amount, currency, duplicate, unexpected-state, or stale-pending differences. Resolution records evidence and ownership; it does not rewrite provider lines, payments, refunds, settlements, or money.

Before resolving, understand and record the evidence. After resolving, find the corresponding audit entry.

### 8.6 COD cash

1. Open today’s store cash session with an opening float.
2. Record ordinary cash-in/out, deposit, or adjustment with a reason.
3. Deliver a COD order and verify its collection appears automatically.
4. Process a COD refund and verify its cash effect.
5. Reverse an eligible manual movement; confirm the original remains and an opposite movement is added.
6. Close with a deliberately different counted amount.
7. Acknowledge a material variance of ₹500 or more.
8. Run the posting worker and inspect the variance journal.
9. Reopen only with a correction reason and confirm prior counted evidence remains.

Operators may record ordinary movements but cannot perform high-risk open/close/reopen/reversal/material-adjustment controls. Manager, finance manager, or owner must review those actions.

### 8.7 Ledger

Verify:

- total debits equal total credits;
- trial-balance `difference` is zero;
- journal detail shows account code/name, debit/credit lines, source type/ID, source version, business date, and status;
- report drill-down reaches the exact contributing journals;
- posted journals cannot be edited or deleted;
- reversal creates linked opposite lines while retaining the original.

Finance managers can post balanced manual journals for their assigned store. Use a small fictional amount, an open business date, distinct debit/credit accounts, and a clear explanation. Do not use SQL to “fix” a journal.

### 8.8 Fiscal periods

Only a recently authenticated platform owner can open, soft-close, close, or reopen periods.

Test in this order:

1. login again as owner to obtain a fresh token;
2. open a non-overlapping period with a reason;
3. soft-close it;
4. verify ordinary backdated posting is blocked;
5. test the supported owner soft-close override with a reason;
6. close it and verify every posting is blocked;
7. reopen with a correction reason;
8. post a reversal/replacement rather than editing history;
9. rerun reports and close again.

The seeded July 2026 period is already closed, which is useful for read-only evidence but not a safe target for casual mutation.

### 8.9 Vendors, categories, and standard costs

Configuration includes:

- store or owner-wide vendors and payment terms;
- fixed/variable expense categories;
- ledger-account mappings required before expense posting;
- activation/deactivation without deleting history;
- effective-dated product standard costs with source/rationale.

Add a future cost version and confirm older delivered order lines retain their original cost snapshot. This is a strong recruiter example of historical reproducibility.

### 8.10 Posting worker and operational jobs

Financial source writes enqueue outbox events; they do not rely on the browser to create journals. Drain the worker from the root:

```powershell
pnpm --filter backend finance:post-events
```

Repeat until `claimed` is zero. Also know these one-shot commands:

```powershell
pnpm --filter backend payments:reconcile
pnpm --filter backend inventory:reconcile-reservations
pnpm finance:reconcile-fixture
```

No scheduler is included. In a production design, a trusted scheduler/worker deployment would invoke reconciliation and posting.

---

## 9. Payroll-lite walkthrough

### 9.1 Scope

Payroll-lite demonstrates restricted operating-cost controls, not statutory payroll. It includes:

- store-scoped employee finance profiles;
- encrypted optional bank/PAN-like source fields and last-four masks;
- non-overlapping effective-dated compensation versions;
- earning, deduction, and employer-cost components;
- complete-calendar-month pay runs;
- immutable employee/component snapshots after calculation;
- actor-separated approval and payment;
- CSV snapshot and payslip-style evidence;
- ledger posting and exact reversal.

It does not implement attendance, leave, overtime, proration, retro-pay, off-cycle payroll, TDS, EPF, ESI, professional tax, statutory filing, or remittance.

### 9.2 UI versus API scope

The current Payroll UI can:

- list profiles;
- inspect compensation history;
- create a monthly pay-run draft;
- calculate, approve, pay, post, void, or reverse when authorized;
- inspect run detail and employee statements;
- download the run CSV.

Creating/updating employee finance profiles and adding compensation versions are currently API-only. Use the seeded profiles/history for a UI-first recruiter demo, and use `docs/api-reference.md` when deliberately testing those mutations.

### 9.3 Existing seeded evidence

After reset, select a store and inspect:

- Compensation history for effective versions;
- already-posted pay-run snapshots;
- employee statements;
- CSV export;
- the payroll journal and report contribution for July/August 2026.

Explain that adding a later compensation version does not rewrite a prior pay run.

### 9.4 New pay-run lifecycle

Use fictional data and separate recently authenticated payroll actors:

1. Actor A creates a complete-calendar-month draft.
2. Actor A or another calculation-authorized user calculates it.
3. Confirm immutable employee and compensation snapshots.
4. Attempt approval as creator/calculator and expect a segregation error.
5. Actor B approves.
6. Attempt payment as creator/calculator/approver and expect denial.
7. Actor C records payment with a fictional reference.
8. Post the paid run.
9. Drain the financial outbox.
10. Reconcile Payroll Expense `6200`, payroll liabilities, and Bank `1010`; debits must equal credits.
11. Reverse with a reason and effective business date in an open period; verify the linked exact opposite journal.

Every lifecycle command uses a unique idempotency UUID generated by the frontend and requires recent authentication. If an HTTP response is uncertain, a client should retry the same command with the same key and unchanged meaning, not create a new command.

Never put real employee, bank, PAN, tax, or government-registration data in this portfolio demo.

---

## 10. API-only and partially exposed features

“Backend exists” and “complete product feature” are not the same claim. This table prevents overstatement in interviews.

| Capability | Backend | Current frontend |
| --- | --- | --- |
| User register/login/profile | Implemented | Register/login and read-only profile |
| Address CRUD | Implemented | Implemented |
| Product create/list/filter | Implemented | Create/list/filter; no complete edit/delete UI |
| Category create/list | Implemented | Selection/list use; create is API-only |
| Customization group/option creation | Implemented | API-only; product assignment has UI |
| Menu create and product mapping | Implemented | Create/list; no complete edit/delete UI |
| Coupon CRUD | Implemented | Validation at checkout; admin CRUD is API-only |
| Store CRUD/configuration | Implemented | Create/edit/deactivate plus product/zone management |
| Inventory operations | Implemented | Implemented; some unauthorized row controls are not hidden yet |
| Payment simulator | Implemented | Full successful browser flow |
| Razorpay Test Mode | Implemented with runbook limits | Browser flow exists; requires credentials/tunnel/configuration |
| Razorpay live | Rejected | Unsupported |
| Refunds/settlements/cash/expenses/ledger/reports | Implemented | Substantial finance UI |
| Payroll profile/compensation writes | Implemented | API-only |
| Payroll run lifecycle | Implemented | Implemented |
| Support close status | Implemented | Accept/reject/open/chat exposed; explicit close control missing |
| Metrics | Implemented | Service endpoint only, as expected |
| Posting/reconciliation scheduling | One-shot jobs implemented | No scheduler/deployment included |
| Production invitation delivery | Interface/fail-closed adapter | Delivery provider not included |

### Optional PowerShell API session

Use this when testing API-only admin endpoints:

```powershell
$base = "http://localhost:3000/api/v1"
$loginBody = @{
  email = "admin@pizzastore.com"
  password = "admin123"
} | ConvertTo-Json

$login = Invoke-RestMethod -Method Post -Uri "$base/user/login" -ContentType "application/json" -Body $loginBody
$auth = @{ Authorization = "Bearer $($login.data.token)" }

Invoke-RestMethod -Method Get -Uri "$base/coupon" -Headers $auth
```

Example current demo coupon creation. This compatibility endpoint accepts fixed/minimum amounts in rupees even though the underlying financial model stores paise:

```powershell
$coupon = @{
  code = "RECRUITER50"
  discountType = "fixed"
  discountValue = 50
  minOrderValue = 200
  maxRedemptions = 20
  startDate = (Get-Date).AddDays(-1).ToString("o")
  endDate = (Get-Date).AddDays(30).ToString("o")
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri "$base/coupon" -Headers $auth -ContentType "application/json" -Body $coupon
```

Then build a customer cart above ₹200 and apply `RECRUITER50` at checkout. Consult `docs/api-reference.md` for request/response contracts rather than guessing payloads.

---

## 11. Manual test plan

Create a copy of this section in an issue or test record. Record date, commit SHA, browser, Node/PostgreSQL versions, tester, and evidence.

### 11.1 Smoke tests

- [ ] Fresh dependency install succeeds.
- [ ] Empty local database migrates from repository head.
- [ ] `pnpm demo:reset` completes and prints two stores/personas/scenario summary.
- [ ] Backend starts and reports database connectivity.
- [ ] Frontend starts with no fatal console error.
- [ ] `/docs` works with the API stopped.
- [ ] Storefront product/menu images load.
- [ ] Customer login works.
- [ ] Owner `/admin` works.
- [ ] Metrics rejects missing credentials and accepts the configured token.

### 11.2 Customer happy path

- [ ] Resolve `400001`.
- [ ] Add standard and customized items.
- [ ] Edit quantities/customizations and test remove/undo.
- [ ] Create/edit/delete an address.
- [ ] Confirm authoritative quote.
- [ ] Place COD order.
- [ ] Place simulated-online order.
- [ ] Confirm cart clearing and order history.
- [ ] Progress an order as staff and observe customer timeline.
- [ ] Open and use realtime support chat.

### 11.3 Store and inventory path

- [ ] Owner switches between global and both stores.
- [ ] Store-specific product price differs without changing global base price.
- [ ] Product mapping add/remove works only for eligible role.
- [ ] Inventory staff can update availability but not price.
- [ ] Delivery-zone changes affect pincode resolution.
- [ ] Restock, bulk restock, adjustment, threshold, and movement history work.
- [ ] Available quantity equals on-hand minus active reservations.
- [ ] Store switching does not show prior-store cached rows.

### 11.4 Authorization matrix

- [ ] Owner can operate both stores and global features.
- [ ] Store 1 manager cannot see or mutate Store 2 resources.
- [ ] Finance manager cannot update order status or close a fiscal period.
- [ ] Payroll manager cannot read finance, orders, or inventory APIs.
- [ ] Operator can update fulfilment but cannot mutate inventory.
- [ ] Inventory staff can mutate inventory/availability but cannot read orders.
- [ ] Customer cannot enter the staff workspace.
- [ ] Guessed cross-store order, membership, movement, invitation, receipt, and payroll IDs return concealed not-found responses where designed.
- [ ] Manager cannot grant privileged roles or remove the final manager.
- [ ] Suspension/revocation blocks the next request and disconnects the local socket.
- [ ] Invitation works once and only for the matching email.

### 11.5 Finance path

- [ ] July–August seeded overview/P&L/sales/margin render for each store and consolidated scope.
- [ ] Store totals add to consolidated totals for identical filters.
- [ ] Screen and CSV totals match.
- [ ] Aggregate drill-down reaches contributing journals.
- [ ] Trial balance is balanced with zero difference.
- [ ] Expense creator cannot approve; creator/approver payment segregation works.
- [ ] Receipt access is private.
- [ ] Refund requester cannot self-approve.
- [ ] Manager approval thresholds are enforced.
- [ ] COD session variance acknowledgement is enforced.
- [ ] Settlement identical replay is idempotent; conflicting replay is rejected.
- [ ] Issue resolution records evidence without changing money.
- [ ] Closed period blocks posting; owner recent-auth and reason gates work.
- [ ] Reversals retain originals and exactly negate lines.
- [ ] Posting worker is idempotent when run repeatedly.
- [ ] `pnpm finance:reconcile-fixture` passes.

### 11.6 Payroll path

- [ ] Payroll data is visible only to owner/payroll role.
- [ ] Bank/PAN-like data is masked and excluded from exports/audit.
- [ ] Effective compensation versions do not overlap.
- [ ] Pay-run creation covers a complete calendar month.
- [ ] Calculation snapshots employees/components.
- [ ] Creator/calculator cannot approve.
- [ ] Creator/calculator/approver cannot pay.
- [ ] CSV and employee statement reconcile to run totals.
- [ ] Posting creates balanced payroll journals.
- [ ] Reversal creates linked opposite journal and keeps the snapshot.

### 11.7 Failure and resilience tests

- [ ] Stop backend: UI shows errors without crashing.
- [ ] Restart backend: queries and socket reconnect recover.
- [ ] Stop PostgreSQL: backend logs failures and returns safe errors.
- [ ] Submit the same idempotent finance action twice with the same key/payload: one semantic result.
- [ ] Reuse the key with changed meaning: conflict.
- [ ] Force insufficient stock between quote and checkout: checkout rejects and refreshes state.
- [ ] Cancel/expire an online attempt and verify reservation recovery behavior through the documented reconciler.
- [ ] Run workers repeatedly and confirm no duplicate journals.

### 11.8 Browser, responsive, and accessibility checks

Test Chrome plus at least Firefox or Edge at desktop and narrow widths.

- [ ] Every form is keyboard operable.
- [ ] Focus remains visible.
- [ ] Modal/drawer focus returns sensibly after close.
- [ ] Validation is conveyed in text, not color alone.
- [ ] Tables remain usable on narrow screens.
- [ ] Admin mobile navigation opens/closes correctly.
- [ ] Store switching is available or its current mobile limitation is documented.
- [ ] Reduced-motion preference does not hide content.
- [ ] `/docs` print preview is readable.
- [ ] Direct refresh works on every deployed SPA route.
- [ ] Unknown `/docs/*` and application routes show intentional not-found pages.

---

## 12. Automated developer workflow

Run focused tests while developing, then the complete preflight before a recruiter recording, release tag, or deployment:

```powershell
pnpm run preflight
```

This runs lint, typecheck, tests, and production builds across the workspace. Individual commands:

```powershell
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
```

Useful focused commands:

```powershell
pnpm --filter backend test
pnpm --filter backend typecheck
pnpm --filter frontend test
pnpm --filter frontend lint
pnpm --filter frontend build
```

After a database/schema change:

```powershell
pnpm run db:generate
pnpm run db:migrate
pnpm demo:reset
```

Do not use `db:push` as a production migration substitute.

For every manual test session, record:

```text
Date/time:
Commit SHA (`git rev-parse --short HEAD`):
Node / pnpm / PostgreSQL versions:
Browser and viewport:
Database reset performed: yes/no
Persona and store:
Scenario:
Expected:
Actual:
Result: pass/fail/blocked
Evidence: screenshot, console/network excerpt, DB query, or test output
Issue link:
```

### Developer debugging workflow

When a feature fails, trace it through the layers instead of repeatedly clicking:

1. **Browser state** — check the selected pincode/store, logged-in persona, active staff store, current route, and form values.
2. **Network request** — inspect URL, method, request body, bearer header presence, status, response code/message, and `X-Request-ID` in DevTools.
3. **Backend log** — correlate the method/path/status in the terminal and inspect `backend/logs/<YYYY-MM-DD>/combined.log`; errors also appear in `error.log`.
4. **Database state** — inspect the relevant source row, membership, reservation, outbox event, or journal. Use read-only SQL whenever possible.
5. **Worker boundary** — if domain state exists but its journal does not, inspect/drain the financial outbox rather than altering the journal table.
6. **Cache/realtime boundary** — invalidate/refetch, reconnect the socket, or reload after confirming the backend result. Never “fix” authoritative server state only in Zustand/React Query.

You can open Drizzle Studio for local inspection from the backend package:

```powershell
pnpm --filter backend exec drizzle-kit studio
```

Treat Studio as an inspection tool during workflow testing. Manual database edits bypass validation, audit, idempotency, locking, outbox, and realtime behavior, so they do not prove the application works.

---

## 13. Recruiter presentation plan

### 13.1 Before the call

1. Run `pnpm run preflight` and save the output.
2. Run `pnpm demo:reset`.
3. Start both apps and inspect the browser console.
4. Confirm current time falls inside store hours or update the hours.
5. Open these tabs in advance:
   - `/docs`
   - storefront `/`
   - customer order history
   - owner dashboard
   - Finance with `2026-07-01`–`2026-08-31`
   - one journal detail
6. Keep customer and owner in separate browser profiles.
7. Disable personal notifications and hide secrets/terminals containing `.env`.
8. Reset once more if rehearsal modified important fixture evidence.

### 13.2 Five-minute demo

**0:00–0:45 — Product.** Show the storefront, pincode-resolved store, product customization, and stock badge.

**0:45–1:45 — Transaction.** Show checkout quote and explain that browser totals are untrusted; COD commits order/payment/stock/coupon/cart locally, while online payment uses reservation and reconciliation boundaries.

**1:45–2:30 — Operations.** Place or open an order, show realtime notification and fulfilment state machine.

**2:30–4:15 — Accounting.** Open seeded Finance data, click P&L or sales aggregate into a balanced journal, then show store versus consolidated scope.

**4:15–5:00 — Engineering judgment.** Open `/docs/decisions` or `/docs/reliability`; state one accepted limitation and the condition that would trigger redesign.

### 13.3 Fifteen-minute demo

1. **Problem and architecture (2 min)** — multi-store commerce plus auditable management accounting; React/Express/PostgreSQL boundaries.
2. **Customer order (3 min)** — pincode, customizations, cart, authoritative quote, simulator/COD.
3. **Inventory and realtime (2 min)** — reservation-aware availability, movement history, new-order event.
4. **Finance (4 min)** — delivery recognition, outbox, journal, P&L, CSV, reversal, period close.
5. **Authorization (2 min)** — platform role versus store membership, selected store, one allowed and one denied role action.
6. **Quality and limitations (2 min)** — tests/runbooks, what you manually verified, and what remains incomplete.

### 13.4 Strong talking points

- Money is stored as integer paise; rounding and tax extraction are explicit.
- Checkout pricing is server-authoritative and snapshot-based.
- Payment capture and revenue recognition are separate events.
- Online attempts reserve stock; COD deducts it within order creation.
- Domain state and financial outbox event commit together.
- Posting is retryable/idempotent by source identity and version.
- Journals are balanced and append-only; correction uses reversal.
- Store scope is loaded from current database membership, not trusted JWT permissions.
- High-risk workflows add segregation, thresholds, recent authentication, idempotency, and audit evidence beyond basic RBAC.
- Reports and CSV use the same service policy and support journal drill-down.
- The public docs explicitly distinguish simulations/tests from production proof.

### 13.5 Questions you should be ready to answer

**Why a modular monolith?**  
The domains need strong local transactions and are not yet independently scaled. Feature modules preserve boundaries without distributed-transaction cost. Split services only when scaling/team/deployment evidence justifies it.

**Where does atomicity stop?**  
At the database boundary. External provider calls and Socket.IO delivery cannot share the local transaction, so the design uses reservations, idempotency, webhooks/reconciliation, and an outbox rather than claiming end-to-end atomicity.

**Why not trust frontend prices or permissions?**  
The browser is controlled by the user. The backend recalculates financial values and reloads current identity/membership before authorization.

**Why not update posted journals?**  
Mutation destroys auditability. Linked reversals preserve the original claim and the correction.

**What would you improve next?**  
Database-backed HTTP authorization integration tests, browser E2E coverage, cookie/session plus CSRF design, frontend permission polish, production invitation delivery, durable/shared realtime infrastructure, job scheduling, observability deployment, and verified hosting/CI.

**What is intentionally not production-ready?**  
Live payments, statutory payroll/tax, selective payroll retention/deletion, horizontally scaled Socket.IO eviction, production invitation delivery, and deployment/backup automation.

Avoid vague claims such as “enterprise-grade,” “exactly once,” “fully secure,” or “production-ready.” State the exact boundary and evidence.

---

## 14. Current limitations and presentation honesty

Know these before a recruiter finds them:

- bearer tokens are persisted in `localStorage`; cookie/CSRF architecture is not implemented;
- HTTP-level authorization integration tests and full browser E2E tests remain gaps;
- Socket.IO uses process-local delivery/eviction; horizontal scaling needs a shared adapter and cross-process signal;
- invitation email delivery is not implemented for production;
- background reconciliation/posting commands are not scheduled;
- payroll is demo-only and omits statutory/attendance calculations;
- Razorpay live mode is intentionally unsupported;
- profile editing is not supported;
- coupon/category/customization creation and payroll profile/compensation writes have incomplete or API-only frontend coverage;
- support-session close lacks a clear UI action;
- inventory mutation controls need finer frontend permission visibility, although the backend denies unauthorized writes;
- payroll-only staff can land on a dashboard they cannot populate;
- staff store switching needs mobile UX review;
- no hosting manifest, verified deployed URL, public remote, or CI workflow is currently established in this checkout;
- no Docker-based local environment is provided;
- the deterministic demo reset is destructive and local-only;
- business reports are management reports, not statutory statements.

These are not reasons to hide the project. They are opportunities to show engineering judgment: explain impact, current safeguard, and next step.

---

## 15. Reset, recovery, and safe experimentation

### Return to the known demo

Stop the app or leave it running, then from the root:

```powershell
pnpm demo:reset
```

Refresh both browser profiles and log in again. Resetting invalidates the meaning of open browser state and old record IDs.

### Do not use System > Clear all for normal reset

The System page permanently deletes application data while preserving admin accounts and uploaded files. It is useful as a destructive-control demonstration, not as the normal portfolio reset. Prefer `pnpm demo:reset`, which recreates deterministic data.

### When finance results look wrong

1. Confirm selected store versus All Stores.
2. Confirm date range includes July–August 2026.
3. Run `finance:post-events` until no events are claimed.
4. Inspect Finance > Issues.
5. Verify trial balance difference is zero.
6. Run `pnpm finance:reconcile-fixture` on an unmodified reset dataset.
7. Do not edit financial tables manually.

### When checkout looks wrong

1. Confirm the resolved pincode and selected address match.
2. Confirm store hours include current IST time.
3. Confirm cart belongs to the resolved store.
4. Refresh cart and catalogue queries.
5. Inspect the server quote response in Network.
6. Check on-hand, reservations, availability, and global/store availability.
7. For online payment, inspect the local order/attempt before retrying.

### When role access looks wrong

1. Confirm the user’s platform role and active store membership separately.
2. Confirm membership/store are active.
3. Confirm the top-right selected store.
4. Refresh or reconnect the socket; access data is invalidated on connection changes and otherwise has a one-minute freshness window.
5. Test the API response. A visible frontend control is not proof of permission.
6. Check Audit for the change and denial evidence where applicable.

---

## 16. Final “ready to show” gate

Do not send a recruiter a demo link or record a video until all applicable items pass:

- [ ] Clean clone/setup instructions were reproduced once.
- [ ] Full `pnpm run preflight` passes on the shown commit.
- [ ] Core manual customer, operations, finance, and authorization flows pass.
- [ ] Both seeded stores were checked.
- [ ] Current screenshots come from the tested commit.
- [ ] No `.env`, bearer token, database password, or provider secret appears on screen.
- [ ] Direct URL refresh works on the deployed host.
- [ ] `/docs` works when the API is unavailable.
- [ ] The deployed backend restricts `/metrics` with its bearer token and network policy.
- [ ] Demo accounts contain fictional data only.
- [ ] Known limitations are stated in the README/demo notes.
- [ ] You can explain one happy path, one failure/recovery path, one authorization denial, and one tradeoff without reading source.
- [ ] You can distinguish what was manually observed, unit tested, statically reviewed, simulated, and not yet verified.

If you complete this guide in order, you will know the application at the level a strong interviewer expects: not just where the buttons are, but which boundary owns each decision, what evidence proves it, how it fails, and what you would improve next.

---

## 17. Source documentation map

Use these deeper references while testing:

| Document | Use it for |
| --- | --- |
| `README.md` | Product overview, stack, repository map |
| `docs/setup.md` | Environment and database setup |
| `docs/api-reference.md` | Exact endpoint contracts and API-only workflows |
| `docs/architecture.md` | System boundaries and data flow |
| `docs/database-schema.md` | Tables, relations, and constraints |
| `docs/finance-demo-walkthrough.md` | Prepared deterministic finance narrative |
| `docs/two-store-financial-fixtures.md` | Expected July/August values and source mappings |
| `docs/finance-operations-runbook.md` | Recovery, posting, close, metrics, migrations, backups |
| `docs/payroll-demo-scope.md` | Payroll boundary, privacy, actor separation, recruiter walkthrough |
| `docs/store-staff-authorization.md` | Role matrix, membership lifecycle, security matrix |
| `docs/razorpay-runbook.md` | Optional Test Mode and payment recovery |
| `docs/razorpay-test-credentials.md` | Safe Test Mode credential setup |
| `realtime-audit.md` | Current Socket.IO architecture and realtime gap analysis |
| `docs/case-study-walkthrough.md` | Two-minute public-docs presentation |
| `docs/case-study-verification.md` | Dated evidence and still-required runtime checks |
