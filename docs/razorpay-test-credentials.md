# Razorpay Test Mode Credentials Guide

Reviewed against backend configuration and Razorpay's official key/webhook/capture documentation on 10 October 2026. The simulator remains the default; configuring credentials alone does not select the external adapter.

This application needs three Razorpay values. The Test API key pair is generated
by Razorpay; the webhook secret is a separate value that you create yourself.
Test Mode never moves real money.

## 1. Open Razorpay in Test Mode

1. Create or sign in to your [Razorpay Dashboard](https://dashboard.razorpay.com/).
2. Turn on **Test Mode** using the Dashboard mode selector.
3. Keep Test Mode selected throughout every step in this guide. Test and Live
   credentials are separate and cannot be mixed.

## 2. Get `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`

1. In the Test Mode Dashboard, open **Account & Settings**.
2. Under **Website and app settings**, open **API Keys**.
3. Click **Generate Key**.
4. Download or securely copy both generated values:
   - **Key ID** becomes `RAZORPAY_KEY_ID`. A Test Mode ID normally starts with
     `rzp_test_`.
   - **Key Secret** becomes `RAZORPAY_KEY_SECRET`.

The Key Secret is shown only when the pair is generated. If it is lost, generate
a new pair and replace both values in the application. Do not put either value
in frontend code; this repository sends the public Key ID to the browser from
the backend only when Checkout is initiated.

Official reference: [Generate Test Mode API keys](https://razorpay.com/docs/payments/dashboard/account-settings/api-keys/).

## 3. Create `RAZORPAY_WEBHOOK_SECRET`

The webhook secret is not the API Key Secret and is not supplied by Razorpay.
Create a new strong random value. From a terminal with Node.js installed, run:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output; it becomes `RAZORPAY_WEBHOOK_SECRET` in the backend.

Next, while still in Test Mode:

1. Open **Account & Settings**, then **Webhooks** under **Website and app settings**.
2. Click **Add New Webhook**.
3. Enter this URL, replacing the host with the public HTTPS address of the
   deployed or tunneled backend:

   ```text
   https://<public-backend-host>/api/v1/payments/razorpay/webhook
   ```

4. Paste the generated random value into the webhook **Secret** field.
5. Enter an alert email address.
6. Enable these events:
   - `payment.captured`
   - `payment.failed`
   - `order.paid`
7. Create and enable the webhook.

Razorpay cannot deliver webhooks directly to `localhost`; the URL must be
publicly reachable. During local development, expose the backend through a
trusted HTTPS tunnel and use its temporary public URL. If that URL changes,
update the webhook in the Dashboard.

Official reference: [Set up Razorpay webhooks](https://razorpay.com/docs/payments/dashboard/account-settings/webhooks/).

## 4. Configure the backend

Create or update `backend/.env`:

```env
PAYMENT_PROVIDER_MODE=razorpay_test
RAZORPAY_ENABLED=true
RAZORPAY_KEY_ID=rzp_test_replace_with_your_key_id
RAZORPAY_KEY_SECRET=replace_with_your_test_key_secret
RAZORPAY_WEBHOOK_SECRET=replace_with_the_random_webhook_secret
```

`RAZORPAY_ENABLED` is a rollout switch, not a Razorpay credential. All three
Razorpay values must be present when it is `true`. Restart the backend after
changing `.env`.

Do not add these values to `frontend/.env`, commit `backend/.env`, paste secrets
into issues/chat, or use the API Key Secret as the webhook secret.

## 5. Enable automatic capture

In Test Mode, configure automatic capture under **Account & Settings → Payments and refunds → Payment capture**. Follow the current [official capture settings](https://razorpay.com/docs/payments/payments/capture-settings/) if Dashboard labels change. This application intentionally does not move an order to the
kitchen until Razorpay reports the payment as `captured` and the provider order
as `paid`.

## 6. Verify the configuration

1. Start the backend and frontend.
2. Open this backend endpoint:

   ```text
   http://localhost:3000/api/v1/payments/methods
   ```

3. Confirm it returns:

   ```json
   {
     "data": {
       "cash": true,
       "razorpay": true,
       "providerMode": "razorpay_test"
     }
   }
   ```

4. Add an item, go to checkout, and confirm **Pay online with Razorpay** appears.
5. Complete a Test Mode payment and verify that the order changes from
   `awaiting_payment` to `pending`.
6. In the Razorpay Test Mode Dashboard, inspect the payment and webhook delivery.

If the endpoint reports `razorpay: false`, confirm that Test Mode credentials are
all present, `RAZORPAY_ENABLED=true` is spelled exactly, and the backend was
restarted. If the backend fails at startup, its environment validation message
identifies an incomplete credential set.
