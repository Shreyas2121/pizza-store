# Requesting an item and delivery refund

The refund dialog now separates item and delivery amounts. Entering the complete order total into the item field incorrectly asks the server to allocate the delivery fee to the purchased item.

For a paid order containing one ₹249 pizza and a ₹40 charged delivery fee:

1. Load the order, select the pizza and quantity 1.
2. Enter **₹249** in **Item refund amount**. This includes the item's paid tax and reflects its saved discounts.
3. Select **Refund delivery charge**. **Delivery refund amount** initially becomes ₹40; lower it if only part of the delivery charge should be refunded.
4. Confirm that **Total refund** is **₹289**, enter the reason and review the confirmation before creating the request.

For delivery-only refunds, clear the item selection and select the delivery charge. Orders with free delivery have no delivery fee to refund. Multiple item lines still require separate item requests through this dialog; the existing API supports multiple allocations.

The browser sends separate item and `delivery_fee` allocations whose sum equals the requested amount. The backend retains its captured-payment, prior refund, purchased quantity, paid item amount and charged delivery fee checks. A prior/refund reservation can make the remaining refundable amount less than the original paid amount displayed by the dialog. Approval/provider submission are separate actions; requesting a refund does not automatically return inventory.

Verification covers the ₹249 + ₹40 case, item-only and delivery-only requests, partial delivery, discounted item totals, quantity limits, free-delivery rejection and invalid amounts. No live refund or database mutation was performed to validate this UI fix.
