# Recruiter demo seed

Run from the repository root. Keep your existing admin login; this script never creates or edits an admin. Existing seed scripts remain available.

Preview without connecting to the database or writing files:

```powershell
pnpm --filter backend seed:recruiter --plan
```

Populate the cleared database:

```powershell
pnpm --filter backend seed:recruiter --apply
```

If you have several admins, append `--admin=your-admin-email`. To reproduce a particular date, append `--as-of=2026-10-10`. Otherwise it uses today's date in India. Your normal backend environment and applied schema must be available. No migrations, reset, or other seed scripts are executed.

The script requires empty application tables, with exceptions for existing admins, audit history, and compatible system ledger accounts. It aborts on other existing data. All database writes share one transaction. Generated banners and receipts are removed on a handled failure. Successful repeat runs find a completion record and return without adding duplicates or overwriting your subsequent changes. Repeating it does not refresh dates; the original seeded history stays intact.

## Accounts

All newly created accounts share `RecruiterDemo!2026`. You can set `RECRUITER_DEMO_PASSWORD` before applying to choose a different password. It does not affect your admin password.

| Login | Use |
|---|---|
| `customer@recruiter.pizzastore.test` | Customer with addresses, cart, support conversation, and order history |
| `new.customer@recruiter.pizzastore.test` | Customer with no orders, for first-order eligibility |
| `manager@recruiter.pizzastore.test` | Both stores, manager permissions |
| `finance_manager@recruiter.pizzastore.test` | Both stores, finance permissions |
| `payroll_manager@recruiter.pizzastore.test` | Both stores, payroll permissions |
| `operator@recruiter.pizzastore.test` | Both stores, order operations |
| `inventory_staff@recruiter.pizzastore.test` | Both stores, inventory permissions |
| `suspended.staff@recruiter.pizzastore.test` | Suspended store access |
| `revoked.staff@recruiter.pizzastore.test` | Revoked store access |

There are 25 customers, including the first-order customer, and seven staff accounts. Customer names use Faker with a fixed seed. Financial amounts and catalogue content are deterministic.

## What is populated

| Area | Demo content |
|---|---|
| Stores and checkout | Fort, Mumbai (`400001`) and Koramangala, Bengaluru (`560034`), six delivery pincodes, opening hours, coordinates, delivery pricing, included demo item and delivery tax |
| Catalogue | Five categories, 15 individual products with existing food photos, a pizza and drink combo, five menu sections, three customization groups with 14 options, product and store mappings |
| Inventory | Opening stock, chronological sales, consumed and released reservations, cancellation restoration, adjustment history, low and empty stock at Koramangala, effective-dated product costs |
| Customers | 50 home/work addresses, six saved carts including customization choices, six support threads with customer/admin messages and open/closed states |
| Orders and payments | 208 historical orders across two completed months and 60 recent days; four additional COD orders in pending, preparing, out-for-delivery and cancelled states; payment attempts, successful/failed payment evidence, webhook history |
| Promotions | Percentage, fixed amount, buy-two-get-one, free delivery and tiered discounts; first-order and redemption limits; coupon history, item allocations, store opt-out, desktop/mobile offer banners |
| Refunds | A completed partial refund with item, tax and disbursement evidence |
| Settlements | Matched reconciled provider batches and lines; an additional batch needing review with an unmatched line; open and resolved reconciliation issues |
| Cash | Historical closed cash sessions, COD movements, closure history and shortage posting; today's open drawer at each store |
| Expenses | Six vendors, fixed and variable categories, ten historical posted expenses, ten current workflow examples across draft/submitted/approved/rejected/voided states, allocations, command history, ten downloadable PNG receipts |
| Payroll | Four employee profiles, effective-dated salary versions and components, four posted monthly runs with employee snapshots and pay lines, command history, current-month draft runs |
| Accounting | System chart of accounts, financial event history, balanced posted journals using the application's posting policies, two prior fiscal periods and the current open period |
| Access and audit | All five store roles, suspended/revoked memberships, pending/accepted/revoked invitations and audit evidence |

Before committing, the script checks order totals, inventory balances, journal balance and population of every exported schema table. The isolated PostgreSQL test also checks foreign keys, database constraints, admin preservation, attachment files, first-order eligibility and repeat-run behavior.

## Showing the app

1. Open the homepage: browse menus, product photos, options, offers and the combo. Stores open from 9 am to 11 pm IST; outside these hours the app's normal closed-store behavior applies.
2. Sign in as the main customer. Select Fort and the home address, or Koramangala and the work address. Review the saved cart and place a fresh COD or simulated online order.
3. For manual coupon testing, use an offer-free cart without a combo. Codes: `PIZZA10`, `PIZZA30`, and `WELCOME` for the fresh customer. Eligibility and non-stacking rules apply normally.
4. Use your existing admin or store operator to advance the prepared COD orders. The combo order demonstrates component stock deduction. Delivering COD records the collection in today's open drawer.
5. Show inventory filters, movement history and Koramangala's low/empty stock. Restock through the UI.
6. Show support threads and staff permissions, then expenses, receipts and payroll. Use separate finance/requester and admin/approver accounts for actions that require separation of duties.
7. Show finance reports, CSV exports, journals, the partial refund, cash shortage, reconciled settlements and the open reconciliation issue. Use the printed reporting periods or a custom range covering the previous two months. Recent order revenue also appears in current dashboard filters.

Historical online payments, refunds, settlements, webhooks and audit messages are prepared portfolio evidence, not requests sent to Razorpay. Their provider IDs have no corresponding live/simulator payment state. Use **fresh checkout orders** to demonstrate online payment capture, retries or a new provider refund. Tax rules and receipts remain explicitly labelled as demo evidence.

Generated banner files live in `backend/uploads/promotions`; receipts live in `backend/.private/expense-receipts`. Keep these files with the same app instance as the database when hosting the demo. The seed uses the existing catalogue files in `backend/uploads` and checks that they exist before applying.

Verify the implementation without touching the configured database:

```powershell
pnpm --filter backend typecheck
pnpm --filter backend exec vitest run src/scripts/recruiter-demo.test.ts
```

The test uses an isolated in-memory PostgreSQL engine, the posting kernel migration's real balance/immutability triggers, and a temporary asset directory. It never connects to the configured database. Journals are created as drafts, receive their lines, and then become posted, as required by those triggers.
