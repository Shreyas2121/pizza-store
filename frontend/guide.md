# Portfolio learning, testing and demo guide

Use this project to demonstrate a complete business flow and explain the engineering behind it. You do not need to memorize every file. For each feature, learn what the user does, what the server guarantees, what happens when something fails, and one design tradeoff.

This guide was prepared by inspecting the actual router, screens, permissions, services, payment simulator, demo seed and scripts on 2026-10-07. Documentation is supporting context. A fresh agent must check the current code again before coaching you; neither this guide nor an old passing test establishes that your current running environment works.

## How to use this guide

1. Start with **F00**. Record your environment and available accounts once.
2. Give a fresh agent the prompt beneath one feature. It must read this entire guide, including the shared coaching contract, before beginning.
3. Let it guide you through a few actions at a time. You perform the browser actions and report the result; an agent with browser access can inspect with your authorization.
4. Save the result in `docs/learning/Fxx.md`. Carry the environment notes and relevant order IDs into the next session.
5. Finish the customer journey first, then operations and finance. Rehearse F21 after you understand the core flows; advanced failure scenarios can come later.

| Track | Sessions | What you should be able to demonstrate |
| --- | --- | --- |
| Customer journey | F00–F05, F07–F08 | Sign in, select a serviceable address, shop, understand discounts, pay and track an order |
| Store operations | F06, F09–F12 | Configure promotions, fulfill orders, manage stock, explain permissions and support |
| Financial explanation | F13–F14 | Explain how an order becomes financial events, journals and reports |
| Advanced business flows | F15–F19 | Refunds, settlements, cash, expenses and payroll |
| Reliability and presentation | F20–F21 | Explain failure recovery and give a coherent recruiter demo |

The minimum strong portfolio demo is the customer journey, inventory/fulfillment, store permissions, and one financial trace. Learn the remaining sessions so you can answer deeper interview questions, rather than putting every screen into a short demo.

## Shared contract for every fresh coaching agent

**Your task is to coach the owner through the selected feature, not implement a new feature.** Read the repository instructions and this guide. Do not automatically refactor, fix bugs, commit, merge or publish. Report a reproducible bug separately; ask for scope before turning coaching into implementation.

### Verify the code before giving instructions

- Start with `frontend/src/app/router/routes.tsx` and `backend/src/routes.ts`. Identify the actual route, screen, request and mounted API path. Do not invent buttons or endpoints from documentation.
- Inspect the relevant frontend components/hooks/API client, request schema, server authentication and permission checks, service rules, persistence/transaction code, and focused tests. Follow imports where this guide points to a directory.
- Cite source files and symbols, preferably current line numbers, for the important claims. Explain at least one complete trace: UI action → request → authorization/validation → service → persisted state → response/UI.
- Identify **browser UI**, **API-only**, **CLI**, and **test-only** behavior explicitly. If a capability has no UI, say so and give a separate optional API/CLI exercise.
- Use documentation for background after checking code. When it disagrees with implementation, show the discrepancy and coach the implemented behavior. Do not silently change code to match the prose.
- Check role/store scope on the server as well as visible controls. A hidden button alone does not prove authorization.
- Separate **expected from source**, **observed in this session**, **automated test evidence**, and **not verified**. Reading a test is not running it; a unit test is not a browser or live-provider test.

### Respect the existing environment constraints

The owner previously deferred live database verification and execution of migrations, schema push, seeds and resets. That restriction still applies. Do not execute those actions during these sessions unless the owner explicitly lifts it for the named environment. Explain prerequisites and continue source review/offline learning when a database gate is pending. Normal owner-led browser exercises on an already prepared demo environment are the intended walkthrough; do not turn them into an unsolicited database verification suite.

`demo:reset` truncates application tables and restarts identities. It is not a routine preparation step for each session. Never reset an existing environment to make your instructions easier. Do not print `.env` contents, tokens or real credentials. Use synthetic demo records and simulator/test providers; real payment processing is outside this learning plan.

### Coach interactively

Begin with the purpose, prerequisites, actual account/role, store, screen and required data. Provide two to four actions, their expected visible result, and how to inspect the relevant request/state. Then wait for the owner’s result before continuing. Do not dump the entire walkthrough and mark it complete.

Each session must include:

1. One happy path with concrete inputs discovered in the running environment.
2. One meaningful failure/permission/boundary case, using a safe demo record.
3. A code trace and explanation of the business invariant.
4. A short recruiter explanation and one likely interview question.
5. A saved result with evidence and unresolved prerequisites.

Use this note template in `docs/learning/Fxx.md`:

```md
# Fxx — Feature
Environment / revision / date:
Account role / store / relevant IDs:
Source files and symbols checked:
Happy path: expected / observed / evidence
Boundary case: expected / observed / evidence
Code trace and business rule:
Automated evidence (command and result, or merely read):
Not verified / blocked prerequisites / bugs:
My 30-second explanation:
Next session handoff:
```

## Environment and accounts to establish in F00

Root `package.json` defines `pnpm.cmd dev`, `dev:fe`, `dev:be`, `preflight` and `finance:reconcile-fixture`. Check current scripts, environment schema and terminal output before choosing startup commands or URLs. Do not assume a port or start a duplicate server. Offline fixture reconciliation is distinct from live database reconciliation.

The following accounts are defined in `backend/src/scripts/demo-reset.ts`; they exist only if that seed/reset was successfully applied to the current environment. These are synthetic local demo credentials, not evidence that the accounts currently exist.

| Account | Demo password | Intended use |
| --- | --- | --- |
| `admin@pizzastore.com` | `admin123` | Platform administration |
| `customer@pizzastore.com` | `customer123` | Customer with seeded history |
| `new.customer@pizzastore.com` | `customer123` | First-order customer scenario |
| `finance@pizzastore.com` | `finance123` | Finance manager at both stores |
| `mumbai.manager@pizzastore.com` | `manager123` | Mumbai store manager |
| `bengaluru.manager@pizzastore.com` | `manager123` | Bengaluru store manager |

There is no automatic payroll-manager/operator/inventory-staff account in this reset script. Check available memberships before those exercises; do not fabricate credentials or silently grant access.

Seeded stores are Mumbai (`pizzastore-default`, pincode `400001`) and Bengaluru (`pizzastore-bengaluru-south`, pincode `560034`), with configured hours 09:00–23:00 Asia/Kolkata. Confirm current zones, hours and IDs. Customer store resolution from an address/pincode differs from staff active-store selection. Use separate browser profiles/private sessions for different accounts; tabs in one profile may share persisted authentication.

Seeded finance examples use July/August 2026. Select **2026-07-01 through 2026-08-31** when inspecting that history; the workspace defaults to the current month. Use an eligible open period for new financial exercises, and check period locks before mutations.

## Feature sessions

### F00 — Startup, demo data and readiness

**Start here.** Sources: `package.json`, `docs/setup.md`, `backend/src/scripts/demo-reset.ts`, `backend/src/scripts/demo-reset.policy.ts`, and payment/environment configuration.

- Identify the current revision, running services, frontend/backend URLs and selected payment mode without exposing secrets.
- Determine which demo data/accounts are already available. Record missing prerequisites without running a seed/reset/migration.
- Open the storefront and `/docs`; identify the login entry point and browser/network tools.
- Explain simulator versus provider-test mode and source inspection versus executed verification. Record one startup/configuration limitation if present.

**Deliverable:** environment handoff that later agents can reuse. **Interview question:** How can someone reproduce this demo safely?

**Fresh-agent prompt:** `Read F:\Shreyas\food\guide.md and follow its shared coaching contract. Coach me through F00 only. Inspect actual code and scripts, establish demo readiness without executing the deferred database actions, and save the handoff in docs/learning/F00.md.`

### F01 — Authentication, profile and addresses

**Role/screens:** customer; login modal, `/profile`, `/address`. There is no declared `/login` page in the current router. Sources: frontend `auth`/`account`, backend `auth`/`users`, and the actual address handlers reached through imports.

- Sign in, inspect profile and add/edit a synthetic address using a serviceable pincode.
- Sign out and confirm protected screens require authentication; use a separate session for a second customer.
- Trace validation and ownership of profile/address requests. Check account switching does not expose another account’s cached information.

**Rule:** authentication and resource ownership are distinct checks. **Interview question:** How do you avoid stale user data after logout?

**Fresh-agent prompt:** `Read F:\Shreyas\food\guide.md, follow the shared contract, and coach F01 only. Verify the actual authentication/profile/address code, guide a happy path and ownership/logout boundary, and save docs/learning/F01.md.`

### F02 — Store selection and delivery serviceability

**Role/screens:** customer address selection; authorized staff `/admin/stores`, `/admin/stores/:id/products`, `/admin/stores/:id/delivery-zones`. Sources: frontend `store`, backend `stores` and checkout store-resolution code.

- Compare Mumbai and Bengaluru serviceability with actual address/zone data; inspect current opening hours and product mapping.
- Try an unsupported pincode or unavailable store and explain the response before placing an order.
- Compare customer-resolved store with staff active store. Inspect cross-store request authorization, using discovered IDs.

**Rule:** location, store availability and scoped permissions all affect the journey. **Interview question:** Why is store selection more than a frontend filter?

**Fresh-agent prompt:** `Read F:\Shreyas\food\guide.md and coach F02 under the shared contract. Trace actual store/serviceability code and store scope; save docs/learning/F02.md.`

### F03 — Catalogue, menu and customizations

**Role/screens:** customer `/`; platform admin `/admin/products`, `/admin/product/new`, `/admin/customization`, `/admin/menu`. Sources: frontend `catalog`; backend `products`, `category`, `customization`, `menu`, and `pricing`.

- Browse a product and select supported customization options. Explain how price changes are calculated.
- Inspect the admin configuration that produced this product/menu. If editing, use a disposable item and record how to restore it.
- Test an invalid option combination or unavailable item through a verified surface. Distinguish global catalogue configuration from store price/availability.

**Rule:** selected options must remain valid server-side. **Interview question:** What prevents a customer from submitting an arbitrary price?

**Fresh-agent prompt:** `Read F:\Shreyas\food\guide.md and coach F03 under the shared contract. Verify catalogue/menu/customization behavior in code and save docs/learning/F03.md.`

### F04 — Cart and authoritative checkout quote

**Role/screens:** customer `/cart`, `/checkout`. Sources: frontend `cart`/`checkout`; backend `cart`, `checkout`, `pricing`, `promotions`, and `checkout-snapshot.service.ts`.

- Add, change quantity and remove items; inspect subtotal, delivery and final payable amount from the server response.
- Inspect the quote/snapshot flow and its invalidation rules. Reproduce one safe stale-price, changed-availability or invalid-quantity case.
- Explain the response when the cart can no longer be purchased as displayed; do not calculate the authoritative total only in the browser.

**Rule:** checkout revalidates the cart and payable amount. **Interview question:** What if catalogue prices change while a cart is open?

**Fresh-agent prompt:** `Read F:\Shreyas\food\guide.md and coach F04 under the shared contract. Trace cart-to-quote validation and one stale/invalid cart case; save docs/learning/F04.md.`

### F05 — Public offers, bundles and coupon use

**Role/screens:** customer `/offers`, `/offers/:id/products`, cart/checkout and order history. Sources: frontend `offers`/`checkout`; backend `bundles`, `promotions`, `checkout`; `backend/src/fixtures/promotions.fixtures.ts`.

- Discover an offer, follow its product link and compare the actual quote with the advertised eligibility.
- Add an eligible bundle; explain component inventory and display markdown versus a separately applied promotion.
- Apply/remove a manual coupon, inspect savings, and verify the saved breakdown on an order when checkout is available.
- Check an ineligible cart/code and first-order eligibility. A first-order account must still qualify according to current server history.

Seed candidates: `DEMO10`, `DEMO30`, `DEMOFIRST`; two seeded Coca-Cola items may provide a non-pizza cart below automatic cart/delivery thresholds. Verify products, prices and quote eligibility first. Pizza offers can prevent manual-coupon eligibility; delivery savings may be zero if ordinary delivery is already free. The seeded pizza-and-Coke bundle has no customization and uses component stock.

**Rule:** advertised offers are conditional; saved order savings must explain what actually applied. **Interview question:** How do stacking rules avoid double discounts?

**Fresh-agent prompt:** `Read F:\Shreyas\food\guide.md and coach F05 under the shared contract. Check actual offer, bundle, coupon and saved-savings code; test eligibility rather than assuming the seed examples work; save docs/learning/F05.md.`

### F06 — Promotion administration and store opt-out

**Role/screens:** platform admin `/admin/promotions`; store manager `/admin/store-promotions`. Sources: both frontend promotion pages, backend `promotions`, `access/access.permissions.ts`, and promotion fixtures.

- Inspect/create a disposable promotion through the real form: type, targets, schedule, eligibility and media.
- Check featured desktop/mobile behavior and fallback where media is absent.
- Have a scoped store manager inspect/toggle an eligible store promotion; compare customer quotes across stores.
- Verify invalid schedule/target validation and permission boundaries. Platform-admin override is explicitly denied for the manager-only store-promotion route in the current UI policy; trace the server rule too.

**Rule:** platform definition and store participation are separate controls. **Interview question:** How do you prevent a manager changing a global campaign?

**Fresh-agent prompt:** `Read F:\Shreyas\food\guide.md and coach F06 under the shared contract. Verify promotion forms, server rules and manager-only store toggles; save docs/learning/F06.md.`

### F07 — COD checkout, fulfillment and customer order history

**Prerequisite:** F01–F04, available stock and a serviceable open store. **Screens:** `/checkout`, `/orders`, `/order/:id`, `/admin/orders`, `/admin/order/:id`. Sources: backend `checkout`, `order/order.logic.ts`, order service, inventory and cash integration.

- Place one synthetic COD order and record its real order ID, totals and initial status.
- As authorized staff, progress through the allowed preparation/dispatch/delivery flow. Observe the customer details/history after each change.
- Inspect cancellation rules on a separate eligible order and reject an illegal transition or cross-store update.
- Trace COD payment/cash completion separately from online capture and revenue recognition.

Current order transitions: `awaiting_payment → pending/cancelled`; `pending → preparing/cancelled`; `preparing → out_for_delivery/cancelled`; `out_for_delivery → delivered/cancelled`; delivered/cancelled are terminal. Verify all additional business guards in the service before acting.

**Interview question:** Why separate order status from payment status?

**Fresh-agent prompt:** `Read F:\Shreyas\food\guide.md and coach F07 under the shared contract. Trace one COD order end to end plus a transition boundary; hand its ID to finance sessions in docs/learning/F07.md.`

### F08 — Simulated online payment and recovery

**Role/screens:** customer checkout/order details; advanced scenarios may be API-only. Sources: backend `payments/razorpay.config.ts`, `payment-provider-simulator.ts`, `payment-simulator.service.ts`, payment routes/finalization/reconciliation; frontend checkout payment flow.

- Confirm simulator mode and complete an online checkout. Trace provider attempt, verification/capture and the order becoming fulfillable.
- Inspect retry/recovery behavior and duplicate processing protection in focused tests.
- For a controlled pending attempt, plan one failed/delayed/duplicate/out-of-order simulator scenario through the verified authenticated endpoint. Do not promise a scenario-picker UI: normal checkout defaults to successful simulation and may already have finalized the attempt.
- Explain that simulator provider state is in memory and differs from persistent application records. Provider-test integration is a separate optional verification gate.

Code currently allows simulator checkout without Razorpay credentials/enable flags. Mounted simulator API is `POST /api/v1/payments/simulator/orders/:localOrderId/events`; verify mounting/schema/ownership before using it and discover the appropriate initiation flow rather than guessing a body.

**Rule:** repeated observations must not create repeated financial/order effects. **Interview question:** How do you recover when payment succeeds but the client loses its response?

**Fresh-agent prompt:** `Read F:\Shreyas\food\guide.md and coach F08 under the shared contract. Verify simulator checkout and distinguish UI from API-only failure scenarios; save docs/learning/F08.md without real charges.`

### F09 — Inventory and order reservations

**Role/screens:** authorized store staff `/admin/inventory`; customer purchase availability. Sources: frontend `inventory`; backend `inventory`, `checkout`, `order`, `bundles`, and relevant inventory tests.

- Inspect stock, thresholds and supported restock/adjustment controls for a disposable product in one store.
- Compare stock/reservations before checkout, during a pending order and after fulfillment or cancellation, following actual service rules.
- Check out-of-stock rejection and component availability for a bundle. Explain which operation reserves, consumes or releases stock.
- Review concurrency tests and transaction code separately from your sequential browser exercise; do not claim a live overselling test happened unless it did.

**Rule:** stock belongs to the store/components, not a separate invented bundle pool. **Interview question:** How do simultaneous checkouts avoid overselling?

**Fresh-agent prompt:** `Read F:\Shreyas\food\guide.md and coach F09 under the shared contract. Trace inventory reservation/release and bundle components, with clear limits on concurrency evidence; save docs/learning/F09.md.`

### F10 — Staff roles, invitations, scope and audit

**Role/screens:** eligible administrator/manager; `/admin/staff`, `/staff-invitations/accept`, `/admin/audit`. Sources: frontend `staff`/`access`/`audit`; backend `staff` (including invitation handling), `access`, `audit`.

- Inspect memberships and permitted invitation/role controls; preview a synthetic invitation flow without sending real messages unless explicitly authorized.
- Compare Mumbai manager, Bengaluru manager and finance-manager access with separate sessions.
- Inspect a scoped denied request and audit evidence for a permitted sensitive action. Trace permission resolution and server filtering.

Managers can perform store operations and several finance actions, but do not have ledger posting/reading, expense payment, period-close or payroll permissions in the current permission table. Finance managers have finance/ledger permissions but not order-status updates or payroll. Payroll manager is a separate role. Verify platform overrides and maker/checker rules per operation rather than assuming every admin can approve everything.

**Interview question:** How do you enforce tenant/store boundaries beyond hiding navigation?

**Fresh-agent prompt:** `Read F:\Shreyas\food\guide.md and coach F10 under the shared contract. Inspect actual role/invitation/audit code, avoid real invitation sends, and save docs/learning/F10.md.`

### F11 — Support and realtime behavior

**Role/screens:** customer support entry discovered from the UI; platform admin `/admin/support`, `/admin/support/:id`; customer order updates. Sources: `frontend/src/features/support`, `frontend/src/shared/realtime`, backend `chat`, and socket setup/authentication reached through imports.

- Open a synthetic conversation and exchange a message through two authorized demo sessions.
- Observe delivery/reload/reconnection behavior and trace persistence versus socket notification.
- Verify another customer cannot read the conversation; inspect store/customer authorization for order subscriptions separately.

**Rule:** realtime events do not replace persisted state or ownership checks. **Interview question:** What happens when a socket disconnects during an order update?

**Fresh-agent prompt:** `Read F:\Shreyas\food\guide.md and coach F11 under the shared contract. Verify actual support entry points and realtime authorization/recovery; save docs/learning/F11.md.`

### F12 — Operational dashboard

**Role/screens:** authorized staff `/admin`; store selector and current dashboard filters. Sources: frontend `admin-dashboard`, backend `dashboard` and access rules.

- Explain each displayed metric using its actual query/status/date definition.
- Compare stores and see how a demo order affects the relevant metric after a permitted status change.
- Explain why an operational revenue badge need not equal a posted financial report total; identify scope/date/status differences.

**Interview question:** What exactly does this dashboard count?

**Fresh-agent prompt:** `Read F:\Shreyas\food\guide.md and coach F12 under the shared contract. Trace dashboard queries and compare their definitions with finance; save docs/learning/F12.md.`

### F13 — Finance reports, costs and exports

**Role/screens:** platform owner/eligible finance manager; `/admin/finance` Overview, Profit & loss, Sales & margin, Configuration. Sources: finance workspace and costs/vendors panels; backend `finance-reports`, `costs`, `vendors`.

- Inspect seeded July/August history with explicit dates, then compare store-scoped and permitted consolidated reports.
- Trace sales, discount, delivery, cost and margin definitions; distinguish paise API amounts from rupee display.
- Inspect effective-dated costs and whether an historical order uses a saved cost rather than today’s edited value.
- Export a supported CSV and compare its filters/totals with the screen; check a scope/permission boundary.

The workspace route guard and individual tab permissions differ. Do not assume access to `/admin/finance` grants every tab.

**Interview question:** How can a historical margin remain reproducible after cost changes?

**Fresh-agent prompt:** `Read F:\Shreyas\food\guide.md and coach F13 under the shared contract. Verify report/cost/export queries and permissions, with the correct historic date range; save docs/learning/F13.md.`

### F14 — Financial events, ledger and period close

**Prerequisite:** an order ID from F07/F08 plus appropriate ledger/close permissions. **Screens:** finance Ledger and Close tabs. Sources: backend `finance-events`, `ledger/commerce-posting.service.ts`, ledger services, `backend/src/scripts/post-financial-events.ts`; frontend ledger/period-close panels.

- Trace one completed order from business event/outbox to posting and journal lines. Identify how posting is triggered in the current setup; a CLI-backed action must be labelled accordingly.
- Explain balanced debits/credits, delivery recognition versus payment capture, promotion treatment and duplicate-event handling.
- Inspect a closed period and its guards; use a disposable open period only if practicing close is authorized. Do not close a period merely to make the walkthrough pass.
- Compare offline `finance:reconcile-fixture` evidence with the separate, deferred live posting/reconciliation gate. Do not run live posting under the existing database restriction.

**Interview question:** Why use an outbox, and what happens if its worker processes an event twice?

**Fresh-agent prompt:** `Read F:\Shreyas\food\guide.md and coach F14 under the shared contract. Trace actual event-to-journal and close rules, respect deferred live database verification, and save docs/learning/F14.md.`

### F15 — Refund request, approval and recovery

**Role/screens:** accounts with the actual create/approve permissions; finance Payments & refunds tab and verified order controls. Sources: refunds panel; backend `refunds/refund.routes.ts`, schemas/service, payments provider/refund integration and ledger posting.

- Choose an eligible simulated captured payment; inspect remaining refundable amount and create a synthetic refund request.
- Check exact maker/checker restrictions before choosing the approving account. Trace rejection, approval and provider completion states.
- Inspect idempotency keys, over-refund prevention and retry/reconciliation for a stuck attempt; separate API-only actions from visible controls.
- Explain what financial event/journal a completed refund produces.

**Interview question:** How do you prevent both duplicate refunds and refunds above the captured amount?

**Fresh-agent prompt:** `Read F:\Shreyas\food\guide.md and coach F15 under the shared contract. Verify eligible amounts, actors and simulated refund recovery in actual code; save docs/learning/F15.md.`

### F16 — Settlement import, reconciliation and issues

**Role/screens:** permitted finance user; Settlements and Issues tabs. Sources: corresponding frontend panels; backend `settlements` routes/schemas/service and ledger integration.

- Inspect a seeded/synthetic settlement batch and its payment/refund/fee/net definitions.
- Determine whether import is available in the current UI or API-only. Prepare a schema-valid synthetic example before any import.
- Compare a matched case with an intentional safe mismatch, inspect its issue, and explain the resolution action and audit trail.
- Inspect repeated-import/reconciliation behavior and scoped visibility. No real bank/provider settlement import is required.

**Interview question:** Why can provider settlement totals differ from gross customer payments?

**Fresh-agent prompt:** `Read F:\Shreyas\food\guide.md and coach F16 under the shared contract. Verify actual settlement import/reconciliation surfaces and issue rules; save docs/learning/F16.md.`

### F17 — COD cash sessions and variances

**Prerequisite:** F07 and cash permissions. **Screens:** finance COD cash tab. Sources: cash-sessions panel; backend `cash-management`, order completion and ledger integration.

- Inspect/open a permissible synthetic cash session and trace a delivered COD order into expected cash.
- Inspect the actual collection/count/close controls and explain how actual versus expected cash produces a variance.
- Test a safe invalid state or duplicate action; trace attribution, scope and journal effects.

**Rule:** delivered COD sales and cash accountability are related but distinct records. **Interview question:** How do you explain a cash drawer shortage?

**Fresh-agent prompt:** `Read F:\Shreyas\food\guide.md and coach F17 under the shared contract. Verify cash-session states and the connection to the recorded COD order; save docs/learning/F17.md.`

### F18 — Vendors, expenses, attachments and payment

**Role/screens:** permitted finance actors; Configuration and Expenses tabs. Sources: vendors/expenses panels; backend `vendors`, `expenses`, attachment service and ledger integration.

- Inspect/create a synthetic vendor and a permitted expense category/date/amount; review the attachment validation path if available.
- Trace create, approve/reject and pay, selecting actors according to the actual separation-of-duties policy.
- Check an invalid attachment/state or unauthorized payment. Store managers can create/approve expenses but lack expense-payment permission in the current table.
- Explain expense recognition versus payment and the corresponding journal entries.

**Interview question:** Why separate expense approval from payment?

**Fresh-agent prompt:** `Read F:\Shreyas\food\guide.md and coach F18 under the shared contract. Verify expense/vendor/attachment and actor rules from code; save docs/learning/F18.md.`

### F19 — Payroll workspace and pay-run lifecycle

**Role/screens:** verified payroll-manager membership or another explicitly permitted principal; `/admin/payroll`. Sources: frontend `payroll`; backend `payroll/payroll.routes.ts`, payroll service, pay-run service, schemas/tests; `docs/payroll-demo-scope.md` as context.

- Establish a usable permitted account; do not assume the finance-manager seed has payroll access.
- Inspect synthetic employee/pay settings and the actual calculation inputs; trace calculate, approve and mark/pay transitions exposed by the UI/API.
- Check duplicate/invalid transition or actor restrictions and explain ledger effects where implemented.
- Explain the documented and implemented scope: do not present internal payroll records as statutory compliance or a real bank transfer integration.

**Interview question:** What is the difference between calculating payroll, approving it and executing a bank transfer?

**Fresh-agent prompt:** `Read F:\Shreyas\food\guide.md and coach F19 under the shared contract. Verify payroll access, lifecycle and integration limits; if the role is unavailable, give a source walkthrough and record the gate in docs/learning/F19.md.`

### F20 — Reliability, maintenance and architecture

**Role/screens:** public `/docs/architecture`, `/docs/order-lifecycle`, `/docs/inventory`, `/docs/decisions`, `/docs/reliability`; platform-only `/admin/system`. Sources: frontend `docs`/`system-maintenance`; backend maintenance, payment recovery, inventory transactions, finance outbox and focused tests.

- Explain the architecture with one real order trace and the boundary between frontend state, persistent server state and provider state.
- Review idempotency, stale payment recovery, inventory concurrency, account-cache isolation and outbox retries using actual implementations/tests.
- Inspect maintenance controls without executing destructive clear/reset actions. Explain authorization and audit requirements.
- Make an evidence table: source-implemented, offline-tested, manually observed, and pending live/provider/concurrency verification. Check `docs/promotions-c14-handoff.md` and current tests before discussing release readiness.

**Interview question:** Which failures can this design recover from, and which claims still need integration evidence?

**Fresh-agent prompt:** `Read F:\Shreyas\food\guide.md and coach F20 under the shared contract. Review actual reliability/maintenance code without destructive actions and save an honest evidence table in docs/learning/F20.md.`

### F21 — Recruiter demo and interview rehearsal

**Prerequisite:** completed core sessions and their evidence. Sources: your learning notes, actual current implementation, in-app docs; `docs/case-study-walkthrough.md`, `docs/case-study-verification.md` and `docs/case-study-evidence.md` as supporting material.

- Prepare a five-to-seven-minute narrative: customer need → serviceable store/product → discount quote → simulated payment → staff fulfillment → inventory effect → financial report/journal → permission boundary.
- Use a prepared synthetic order/history when live posting or another prerequisite is pending. Label prepared evidence and live actions honestly.
- Capture useful local screenshots or a short recording. Hide secrets/personal data; no publishing or external messages are implied by this task.
- Rehearse explaining authoritative pricing, stock concurrency, payment idempotency, store-scoped access and the outbox. Answer one design tradeoff for each.
- Draft a portfolio description stating your contribution, actual stack, demonstrated outcomes and remaining verification limits. Cite measured results only with their reproducible evidence.

**Deliverable:** a repeatable demo script, fallback plan, feature/evidence links and interview questions. A recruiter should understand the user benefit first, then the engineering choices.

**Fresh-agent prompt:** `Read F:\Shreyas\food\guide.md and follow the shared contract. Coach F21 using my completed learning notes and current code. Build and rehearse the recruiter demo, verify every technical claim, and save docs/learning/F21.md without publishing anything.`

## Completion checklist

For each session, mark **learned**, **observed**, or **pending** separately. A feature is learned when you can perform its normal flow, explain a failure case, point to the server rule, and give a short explanation without reading the agent's answer. It is observed only when you have evidence from your actual session. Pending environment/provider gates should remain visible in your portfolio preparation notes.

After the first pass, repeat the core demo yourself without an agent. Use a fresh agent for questions you cannot yet answer, rather than restarting the entire project walkthrough.
