# `/admin/finance` in simple English

This page helps you answer three questions: **How much did we earn? Where is our money? What needs checking?**

It has 11 tabs. Some show reports. Others let you record or check money activity. The tabs and buttons you see depend on your permissions.

This explanation follows the current frontend, backend calculations, and database schema. It explains how the page works; it does not check your live store balances.

## First, understand these three amounts

| Word | Simple meaning | When it happens |
| --- | --- | --- |
| Collections | Money successfully collected from customers. | An online payment succeeds, or COD cash is collected. |
| Revenue | Income earned from delivering the order. | The order is delivered and its accounting entry is posted. |
| Settlement | Online payment money transferred by Razorpay to the bank, after deductions. | Razorpay sends a payout, and the app records it through settlement checking. |

For example, a customer pays today, but the order is delivered tomorrow. The payment is today's collection. The sale becomes tomorrow's revenue. Razorpay may send the money to your bank later.

**These are different stages of the same money. Do not add them together as extra sales.**

Customer payments include tax. The main revenue reports exclude tax because that part is recorded separately. So a customer payment and reported revenue can differ even for the same order.

## The controls at the top

| Control | What it does |
| --- | --- |
| From / To | Chooses the date range for Overview, Profit & loss, Sales & margin, and the payment summary cards. Both dates are included. |
| Group reports by | Splits the detailed reports into months, calendar quarters, or Indian financial years. A financial year runs from 1 April to 31 March. |
| Report scope | The platform owner can view all stores together or the selected store. Other staff work within their store access. |
| Export buttons | Downloads the current report as CSV, using the selected dates and store scope. Sales and margin have separate exports. |

The default date range is the start of this month to today. Reports use the business date recorded on accounting entries.

**The top dates do not filter every tab.** Refund lists, expense lists, settlements, cash sessions, the normal Ledger view, Close, Issues, and Configuration use their own views. The source-based card in Expenses also does not receive these dates.

Even if the owner selects **All stores**, individual refunds, expenses, settlements, cash sessions, Close, and Configuration still need one selected store. Issues and report transaction details can show all stores.

## 1. Overview — a quick money summary

Use this tab for a first look at the business.

| Card | What it means |
| --- | --- |
| Recognized revenue | Delivered food and delivery income, minus recorded discounts and completed refunds after delivery. Tax is excluded. |
| Collections | Successful customer payments recorded in the selected period, including COD. This is not reduced by ordinary refunds; refunds are recorded separately. |
| Refunds | The tax-excluded part of completed refunds that reduces already-earned revenue. Pending requests and refunds before delivery do not count here. |
| Cost of goods sold | The saved standard cost of the food sold. Often shortened to **COGS**. |
| Gross profit | Recognized revenue minus COGS. |
| Operating expenses | Other recorded running costs, such as mapped expense bills, payment gateway charges, cash shortages or overages, and rounding differences. COGS and payroll are separate. |
| Payroll cost | The employer's cost from posted pay runs. This can differ from the amount employees receive. |
| Operating result | Gross profit minus operating expenses minus payroll cost. A negative amount means a loss on this calculation. |
| Unsettled Razorpay | The recorded balance still in the Razorpay clearing account at the end date. It includes earlier activity, not just the selected date range. |
| Cash variance | Recorded cash shortages minus overages from closed cash sessions. A positive amount here means a net shortage. |
| Open reconciliation issues | Money-checking problems that are open **now**. This is not a historical count for the selected dates. |

**Previous** compares with the immediately preceding range of the same length. For example, 8–14 October compares with 1–7 October. It does not always mean the previous calendar month.

Click most amounts to open the accounting entries behind them in Ledger. Click the open-issues count to open Issues. The small information icons explain each amount.

If payroll access is missing, Payroll cost and Operating result show **Restricted**. That does not mean zero.

The status labels also need care:

- **Partial — review issues:** the Overview has open settlement issues.
- **Complete:** this screen is not flagging that issue condition. It does not prove every bank transaction or pending accounting event has been checked.
- **Stale:** the saved report may need refreshing.
- **Last settlement reconciliation:** the latest successful settlement check in the chosen store scope.

## 2. Profit & loss — did the business make money?

Use this tab to see how income becomes profit or loss.

The calculation is:

```text
Recognized revenue
- Cost of goods sold
= Gross profit

Gross profit
- Operating expenses
- Payroll cost
= Operating result
```

Example: revenue is ₹10,000, food cost is ₹4,000, other running costs are ₹1,000, and payroll cost is ₹2,000. Gross profit is ₹6,000. Operating result is ₹3,000.

The screen shows current and previous totals, operating expenses by account, and results split into the chosen periods. Click an amount to inspect the entries behind it.

**Operating result is not your bank balance.** Some money may still be with Razorpay. Bank activity can also include money that is not income, such as an owner's contribution.

This report uses posted accounting entries. Saving a draft expense, approving a refund request, or importing a settlement does not by itself put that amount into this report.

## 3. Sales & margin — what did we sell, and how much remained after food cost?

This tab has two parts.

**Recognized sales** breaks income into food, delivery, discounts, refunds, and the amount left after those reductions:

```text
Food revenue + Delivery revenue - Discounts - Refunds
= Net recognized revenue
```

These amounts exclude tax. Discounts here are the discounts actually recorded in accounting. A crossed-out comparison price is not automatically an extra discount expense. Free delivery produces no charged delivery revenue.

**Gross margin** shows revenue, COGS, gross profit, and gross margin percentage:

```text
Gross margin % = Gross profit ÷ Revenue × 100
```

Example: revenue of ₹1,000 and food cost of ₹400 give gross profit of ₹600 and gross margin of 60%.

This percentage is before other running costs and payroll. It is not the final profit percentage. If revenue is zero, the percentage is unavailable.

Food cost comes from the cost saved on the order. Refunding a customer does not automatically undo that food cost: the food may already have been made and used. An accepted inventory return is a separate action.

## 4. Payments & refunds — return money to customers

The top cards show Collections, Refund contra revenue, and Unsettled Razorpay. They follow the report dates and scope.

**Refund contra revenue** means the refund amount that reduces earned income, excluding tax. It is not the total of every refund request below.

The list below manages refunds for the selected store. This tab is mainly a refund workspace, not a list of every customer payment.

To request a refund:

1. Enter the order ID and load the order.
2. Choose an item, its quantity, and the amount to refund. The item is optional for a delivery-only refund.
3. Add a delivery refund if needed. Only a delivery fee actually paid can be refunded.
4. Select a reason, check the total, and create the request.
5. Another authorised person approves or rejects it. The requester cannot approve or reject their own request.

The backend checks the payment collected, earlier refunds, quantities, and tax amounts. Creating a request does not mean money has been returned.

| Refund status | Simple meaning |
| --- | --- |
| Requested | Waiting for a decision. |
| Approved | Approved locally; this alone is not proof of completion. |
| Submitted | Sent for processing. |
| Processing | The provider is still handling it. |
| Processed | The refund has been confirmed as completed. |
| Failed | The refund attempt failed. An authorised person can retry an online refund. |
| Rejected | The request was refused. |
| Cancelled | The request was cancelled. |

For an online refund, approval starts submission to Razorpay. For COD, the approver must confirm that the cash was returned; the app records the refund and its cash movement. An open cash session is needed for that cash action.

**All refunds** shows the normal queue. **Stuck refunds** shows submitted or processing refunds that have not updated for the chosen time. **Reconcile stale refunds** asks the provider what happened and updates local records. It checks an existing refund; it does not create another one.

A refund before delivery returns a customer advance. A refund after delivery reduces earned revenue. This is another reason the refund list and the Overview refund card can show different totals.

## 5. Expenses — record business bills and payments

Use this tab for running costs such as rent, electricity, cleaning, or other bills.

A normal expense moves through:

```text
Draft → Submitted → Approved → Paid → Posted
```

| Step | Simple meaning |
| --- | --- |
| Draft | Enter the bill and attach a receipt. You can still edit it. |
| Submitted | Ask someone to review it. |
| Approved | An authorised reviewer accepts it. |
| Paid | Record the payment method and reference for a payment already made. |
| Posted | Send it into the accounting process so it can appear in ledger reports. |

**Record payment records evidence of payment. It does not send a bank transfer.** **Post source event** is a separate action after payment. The amount appears in the main reports once its accounting entry is posted.

The creator cannot approve or reject their own expense. Normally the payer must also be different from the creator and approver. A platform admin can use the payment override with a recorded reason when allowed.

When creating a bill:

- Enter the subtotal and tax separately. Total = subtotal + tax.
- Choose a vendor if needed.
- Split the total into categories or cost centres. A cost centre is simply a label for the part of the business that used the money.
- Make sure the splits add up exactly to the bill total.
- Every split needs an active ledger account mapping before posting.

For example, a ₹1,000 bill can be split into ₹700 Cleaning and ₹300 Repairs. These splits describe one bill; they are not extra expenses.

A rejected expense can be edited and submitted again. **Void** cancels an expense before posting; if it was paid, payment-reversal evidence is required. **Reverse posting** creates an opposite accounting record for a posted expense. Neither action sends money back from the vendor automatically.

### The “Source-based operating view” at the top

This is a separate, simpler calculation using delivered order records and paid/posted expense records directly.

It can differ from Profit & loss because:

- Delivered sales uses the full customer order total, including tax.
- It counts paid expenses even before their ledger posting.
- It does not subtract refunds or include the separate payroll calculation.
- It does not automatically include all ledger costs, such as settlement gateway fees.
- On this page, it uses the store's available history, not the top date range.

Use **Profit & loss** for the main ledger-based operating result. If this card says **Cost gaps**, some delivered items lack saved food costs, so its margin is incomplete.

## 6. Settlements — check Razorpay payouts

A settlement is a group of online payments and deductions that Razorpay reports as a payout.

| Field | Simple meaning |
| --- | --- |
| Gross | Payment amount before deductions. |
| Fee | Razorpay's processing charge. |
| Fee tax | Tax on that processing charge. |
| Adjustments | Signed changes to the payout, including refund deductions. A negative amount reduces it. |
| Net | The final payout amount reported by the provider. |
| UTR | A bank transfer reference used to trace the payout. |

```text
Net = Gross - Fee - Fee tax + Adjustments
```

Example: gross ₹1,000, fee ₹20, fee tax ₹3.60, and a ₹100 refund deduction give net ₹876.40. The adjustment is -₹100.

The current import options are **Checked-in fixture** and **Test provider sync**. These are demo/test sources. This screen does not offer a general live bank feed or arbitrary statement upload.

**Import or sync** saves the provider's report. **Run deterministic matching** then compares its payment and refund references, amounts, currency, and statuses with local records.

- **Imported:** saved, but not checked yet.
- **Reconciling:** checking is in progress.
- **Reconciled:** the batch has passed its local reconciliation workflow.
- **Needs review:** differences need attention in Issues.

Importing alone does not update the main accounting reports. A successfully posted settlement records the bank receipt, gateway charges, and reduction in the Razorpay balance. Unsupported adjustments or unmatched lines can still stop accounting posting, even after a batch is marked reconciled.

**A settlement is not another sale.** It moves money from the online-payment balance into the bank.

## 7. COD cash — check physical cash

COD means **cash on delivery**. A cash session is one store's cash record for one business day.

The normal routine is:

1. Open today's session with the opening float: cash already available at the start.
2. COD collections and COD refunds appear from their own workflows.
3. Record other cash movements with a reason.
4. Count the actual cash and close the session.

Manual movement types are:

| Type | What it means |
| --- | --- |
| Cash in | Add cash to the drawer. |
| Cash out | Remove cash from the drawer. |
| Deposit | Take cash out of the drawer for a bank deposit. |
| Adjustment | Record a correction in either direction. |

```text
Expected cash = Opening float + Cash coming in - Cash going out
Session variance = Counted cash - Expected cash
```

Example: opening float ₹500, COD collections ₹2,000, refunds ₹200, and a bank deposit ₹1,000 leave expected cash of ₹1,300. If you count ₹1,250, the session variance is -₹50: a ₹50 shortage.

**The signs differ between screens:** COD cash shows counted minus expected, so shortages are negative. Overview shows shortages minus overages, so a shortage is positive there.

These input boxes use **paise**: enter `50000` for ₹500. Check the field label, because other finance forms use rupees. A cash difference of ₹500 or more requires acknowledgement when closing.

Reopening lets an authorised reviewer correct a closed session while keeping the earlier count in history. Reversing a movement adds an opposite record; it does not delete the original.

Opening cash is existing cash, not a new sale. Cash moved to the bank is also not new income.

## 8. Ledger — inspect the accounting records

The ledger is the detailed money record behind the main reports.

An **account** is a named bucket, such as Cash, Bank, Sales Revenue, or Operating Expenses. A **journal** records one accounting event using two or more lines.

**Debit** and **credit** are the two sides of an entry. They do not simply mean money out and money in. For example, collecting ₹500 online records a ₹500 debit to Razorpay Clearing and a ₹500 credit to Customer Advances. Delivery later turns that advance into revenue and separately recorded tax.

Every journal must have equal total debits and credits.

The normal Ledger screen shows:

- **Trial balance:** account totals and whether total debits equal total credits. Balanced means the entries add up; it does not mean the business is profitable or every transaction is correct.
- **Journal history:** open an entry to inspect its date, source, and lines.
- **Manual adjustment:** authorised staff can post a balanced correction directly. Amounts here use paise.
- **Reverse journal:** creates opposite lines while keeping the original entry.
- **Fiscal periods:** the same date controls also shown in Close.

Clicking a report amount opens a filtered Ledger view. **Clear filter** returns to the normal view. A filtered list can show only the first batch of matching entries; read any partial-result message before comparing it with a full report total.

A ledger reversal corrects accounting. It does not itself refund a customer, reverse a bank transfer, or change an order's status.

## 9. Close — control which dates accept accounting entries

This tab controls accounting periods, such as a month. It does not close the shop or stop orders.

| State | What it allows |
| --- | --- |
| Open | Normal accounting posting within the period's dates. |
| Soft closed | System entries can still post. Ordinary manual adjustments are blocked unless the owner supplies an allowed override reason. |
| Closed | New entries dated within that period are blocked, including system entries. |

The platform owner can open a period, soft-close it, close it, or reopen a closed period. Changes require a reason and recent authentication. Other users with access can inspect the status.

At least one suitable period must exist for an entry's business date. Without it, accounting posting fails.

This tab records the owner's decision to close a period. **It does not automatically prove that every refund, payout, bill, or accounting task is finished.**

## 10. Issues — investigate money mismatches

Use this tab when the provider's settlement records and local records disagree.

Examples include a missing payment, different amounts, a duplicate provider line, or a refund with different statuses on the two sides.

Each issue shows its type, severity, related settlement batch or line, assigned owner, and recorded details. The owner can view all stores together; a store view shows that store's issues.

**Resolve** records your explanation and marks the issue resolved. It does not rewrite payment amounts, provider lines, or refund records. Resolving the last open issue can mark its batch reconciled, but it does not repair unmatched lines or guarantee that the settlement can post to the ledger.

Fix the underlying money record through the relevant workflow when a correction is needed. Writing a resolution note is not a money transfer or an amount correction.

## 11. Configuration — set up the money categories and food costs

This tab contains three areas for the selected store.

| Area | What you set up | Why it matters |
| --- | --- | --- |
| Vendors | Businesses you pay, plus payment terms in days. | Identifies who a bill belongs to. Terms record the agreed timing; they do not automatically pay the vendor. |
| Expense categories | Labels such as Rent or Repairs, fixed/variable classification, and a ledger account mapping. | Tells accounting where each expense belongs. An unmapped category cannot be posted as an expense allocation. |
| Standard costs | A saved cost per unit of a store product, with effective dates and a reason. | Supplies the food cost used for order COGS and margin. |

**Fixed** means a cost usually stays similar, such as rent. **Variable** means it tends to change with activity, such as supplies.

The category form asks for a **Ledger account ID**. This is the database identifier, which is different from an account code such as `6900`. The distinction matters when setting up a category.

Standard-cost inputs use paise. Enter `4000` for a ₹40 unit cost. Selling three units at that saved cost gives COGS of ₹120.

New costs are dated versions. Existing order cost snapshots stay unchanged, and overlapping cost date ranges are rejected. A missing effective cost can stop the order's delivery cost snapshot from being created.

Deactivating a vendor or category stops it being available for new selections while preserving existing records. Some vendors or categories can be shared across stores; platform-level changes are restricted to the owner.

## Which tab should I open?

| Your question | Tab |
| --- | --- |
| Give me a quick picture of the money. | Overview |
| Did we make a profit or loss? | Profit & loss |
| What remains after food cost? | Sales & margin |
| A customer needs money returned. | Payments & refunds |
| I need to record a business bill. | Expenses |
| I need to check a Razorpay payout. | Settlements |
| I need to count or correct physical cash. | COD cash |
| Where did this report number come from? | Ledger |
| We have finished checking a month's accounts. | Close |
| Provider records and our records disagree. | Issues |
| I need vendors, expense categories, or food costs. | Configuration |

## Where the numbers come from

The frontend displays these views and sends your actions to the backend. The backend checks permissions, amounts, and allowed status changes. The database keeps the original activity and its accounting history.

The main reports read posted journal entries, including originals and their opposite entries when reversed. Operational records, such as payments, refunds, expenses, settlements, and cash sessions, are kept separately. An action can be saved before its accounting entry is successfully posted, so a list status alone does not always prove it is already included in a report.

Money is stored in whole paise and displayed as rupees. Historical order prices and costs are saved so changing today's settings does not recalculate old orders.

The page is for management reporting. Its results are not a statutory financial statement or a tax filing.

## Code checked for this explanation

- Frontend: [finance page](frontend/src/features/finance/pages/finance-workspace-page.tsx), [tab components](frontend/src/features/finance/components/), and [API queries](frontend/src/features/finance/api/finance.queries.ts).
- Backend: [report calculations](backend/src/features/finance-reports/finance-report.policy.ts), [report data queries](backend/src/features/finance-reports/finance-report.repository.ts), and the refund, expense, settlement, cash, cost, and ledger services.
- Database definitions: [money-related schemas](backend/src/db/schema/), including payments, refunds, expenses, cash, settlements, product costs, and ledger records.
