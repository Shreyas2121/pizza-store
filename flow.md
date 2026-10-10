# Manual app testing — expense payment and posting boundary

Starting point: your Rs. 1,500 Fort cleaning expense is Approved. Admin created it and your first finance-manager account approved it. Its Store cleaning category is currently Unmapped. Use the same expense ID; continue without seeding data.

## 1. Check the approver cannot pay their own approval

In the finance-manager session that approved the expense, select Fort and open `/admin/finance` → **Expenses** → **Open** on that expense.

Under the payment controls, choose **Bank transfer**, enter `FORT-CLEAN-001` as **Payment reference**, and leave **Platform-admin segregation override reason** blank. Click **Record payment**.

Expect rejection: **The expense creator or approver cannot pay it without an audited platform-admin override.** The request should return **403 SEGREGATION_OF_DUTIES_VIOLATION**. Refresh and confirm the expense remains Approved.

The finance-manager role grants payment permission, but being this expense's approver still blocks that action. Use a separate payer below so you can test the normal separation-of-duties path.

## 2. Set up an independent payer

Register another account through **Sign in → Create an account** in an independent browser profile. Use another email address you own and a password you choose. This account must be different from both the expense creator and approver. If you already have an independent Fort finance manager, reuse it.

As admin, select Fort and open `/admin/staff` → **Assign user**. Enter the new account's email, choose **Finance manager**, and click **Assign**. Confirm an Active membership that survives refresh. No invitation needs to be sent.

In this payer's session, refresh, open `/admin/finance`, select Fort, and open the Approved cleaning expense. Confirm its ID, vendor, date, amount and allocation match your recorded expense.

## 3. Record the simulated expense payment

As the independent payer, enter:

| Field | Value |
| --- | --- |
| Payment method | Bank transfer |
| Payment reference | FORT-CLEAN-001 |
| Platform-admin segregation override reason | Leave blank |

Click **Record payment** once. Expect **Paid**. Refresh and confirm the same expense remains Paid for **Rs. 1,500**, with no change to its allocation. Check the admin and approver sessions agree after refreshing.

This action records a payment in the app; it does not execute a real bank transfer. The reference above is a walkthrough reference, not proof of a bank transaction. Keep the payer account available for future finance exercises.

Check **Source-based operating view** on the Expenses tab. With no other expense changes, Operating expenses should increase by **Rs. 1,500** and Operating result should decrease by that amount once the view refreshes. This source view is separate from ledger-backed reports.

Verify Fort's COD expected cash is unchanged: this bank-transfer expense path does not create a COD cash movement. If the payment request loses its response, refresh the expense before retrying.

## 4. Check the unmapped-account posting guard

On the Paid expense, click **Post source event** once. Because this expense's saved allocation has no ledger account, expect:

**Every allocation requires a ledger account mapping before posting.**

The request should return **409 EXPENSE_LEDGER_MAPPING_REQUIRED**. Refresh and confirm the expense remains **Paid**, rather than Posted. Confirm the saved allocation still shows **Unmapped**.

This is the expected boundary for the category created in the previous part. If the saved allocation already contains a valid active account, do not use this as an expected rejection; record that configuration and leave posting for the ledger walkthrough.

Do not guess a ledger account ID or create a manual journal to bypass the mapping requirement. The posting check reads the expense's saved allocation; changing the category later alone does not automatically repair that allocation snapshot.

Stop here with the expense Paid. Record the creator, approver and payer accounts, the expense ID, payment reference, failed conflicting payment attempt and posting result. Account mapping and ledger posting are the next setup checks. Leave **Void expense** and **Reverse posting** for a separate correction exercise.

Optional request evidence: payment uses `POST /api/v1/finance/expenses/<expenseId>/pay` (**200** for the independent payer); source posting uses the same path ending in `/post`. Commands carry an Idempotency-Key. A successful payment command records an expense financial event, but does not by itself prove a ledger journal was posted.

Source check: [expense payment and posting controls](frontend/src/features/finance/components/expenses-panel.tsx), [staff assignment](frontend/src/features/staff/pages/admin-staff-page.tsx), [expense payment segregation and saved account validation](backend/src/features/expenses/expense.service.ts), and [expense API](backend/src/features/expenses/expense.routes.ts). Expected results are based on current code; confirm them in your browser.
