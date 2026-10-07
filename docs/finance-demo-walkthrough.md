# Finance demo walkthrough

This is the repeatable recruiter/engineering walkthrough for the Phase 5 public cut. It demonstrates source truth, asynchronous posting, balanced journals, P&L drill-down, store isolation, consolidated reporting, and CSV reconciliation without live credentials.

## Reset and start

Prerequisites: migrated local PostgreSQL, backend/frontend environment files, and dependencies installed.

From the repository root run:

```bash
pnpm demo:reset
pnpm dev
```

The reset refuses production and remote database URLs. It truncates local application tables, restarts identities, and creates two stores, catalogue/stock, standard costs, the system chart of accounts, and these users:

| Persona | Login | Purpose |
| --- | --- | --- |
| Owner | `admin@pizzastore.com` / `admin123` | Consolidated reports, ledger, close, configuration |
| Customer | `customer@pizzastore.com` / `customer123` | COD and simulated-online source transactions |
| Finance manager | `finance@pizzastore.com` / `finance123` | Store-scoped finance boundary |

The reset seeds the complete checked-in two-store, two-month scenario. Its output lists the store IDs, reporting periods, order mapping, partial refund, settlements, COD session, pay runs, journal count, tax-inclusive customer headlines, and tax-separated ledger report/CSV totals. You can inspect reports and drill-down immediately. Run `pnpm demo:reset` again at any point to discard later walkthrough actions and replay the exact same seeded source data and totals.

The C09 seed writes `PIZZA50` as a global promotion with a consumed application and immutable item allocation; it no longer inserts a legacy coupon. Delivered fixture events use the production recognition builder and saved tax rates. Existing two-month report totals are preserved. Separate database-free promotion finance fixtures cover one global offer/coupon at two stores, free delivery, bundle markdown and paid refunds. C09 did not run reset or database reconciliation; those checks remain deferred at the owner's request.

## Simulated online path

1. Log in as the customer and deliver to pincode `400001`.
2. Add a product, note the server quote, and choose Pay online. The safe default simulator completes the capture without network credentials.
3. Log in as the owner, advance the order through preparing, out for delivery, and delivered.
4. From a backend shell run `pnpm finance:post-events` until `claimed` is zero.
5. Open Finance > Overview for the order's business date. Open recognized revenue, then inspect the journal source, exact debit/credit lines, business date, and source version.
6. Open Sales & margin and P&L. The delivered order contributes revenue and snapshotted COGS; an unpaid, failed, or cancelled order would contribute neither.

## COD path and cash variance

1. Open a COD cash session for the selected store with an opening float.
2. As the customer, place a COD order and deliver it through the same lifecycle.
3. Run `pnpm finance:post-events` until drained.
4. Close the cash session with a deliberately different counted amount and acknowledge the material variance.
5. Run the posting worker again. Drill from cash variance to the closure journal; status text identifies the variance without relying on color.

## Refund and settlement path

1. Request a partial refund from Payments & refunds with exact item/delivery allocations.
2. Approve it as an eligible different actor. For COD, explicitly confirm cash returned; for online, the simulator supplies deterministic provider evidence.
3. Run the posting worker and drill from refunds to its source journal.
4. Inspect the already imported and reconciled fixture settlement `set_m1_s1_001`. Its payment-attempt and refund links use the source IDs printed by `demo:reset`, so the result is deterministic and ready for journal drill-down.
5. Resolve only with an evidence note and point out that resolution does not rewrite money.

## Period close and correction

1. Reauthenticate as owner, open a period containing the demo business date, and soft-close it.
2. Show that ordinary backdated posting is blocked and owner override requires a reason.
3. Close the period, then reopen with a correction reason. Post a balanced reversal/replacement rather than editing a posted journal.
4. Show the immutable original, linked reversal, audit trail, and balanced trial balance.

## Consolidation, permission boundary, and export

1. As owner, switch report scope between the selected store and All stores. Store totals must add to consolidated totals for the same dates.
2. Download overview, P&L, sales, and margin CSVs. Point out deterministic headings, timezone/date basis, explicit amount units, and formula-safe text.
3. Compare a current-total CSV metric to the screen and its journal drill-down.
4. Log in as the finance manager. They can see only stores with active membership and cannot request an unscoped consolidated report.

For a deterministic all-report check, run `pnpm finance:reconcile-fixture`. It calculates overview, P&L, sales, margins, period series, and all four CSV exports for both stores and consolidated scope from the checked-in financial scenario, then fails on the first mismatch with `financial-scenario.fixtures.ts`.

## What to explain

- Browser prices are never authoritative; the server stores an immutable quote snapshot in integer paise.
- Payment capture and delivery recognition are separate events. Revenue and COGS are recognized at delivery.
- Domain writes and outbox events commit together; posting is retryable and idempotent.
- Posted journals are append-only and balanced. Corrections are reversals.
- Screens and CSV exports share one service/query policy, so reconciliation is structural rather than visual.
- This is a portfolio management-accounting system, not a statutory tax/payroll product.

For the restricted Phase 6 payroll operating-cost scenario, actor separation, statement masking, ledger reconciliation, and reversal, follow [payroll-demo-scope.md](payroll-demo-scope.md#recruiter-walkthrough).
