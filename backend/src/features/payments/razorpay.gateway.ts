import Razorpay from "razorpay";
import type { Orders } from "razorpay/dist/types/orders";
import type { Payments } from "razorpay/dist/types/payments";
import type {
  CreateRazorpayOrderInput,
  CreateRazorpayRefundInput,
  RazorpayCredentials,
  RazorpayGateway,
  RazorpayOrderSnapshot,
  RazorpayPaymentSnapshot,
  RazorpayRefundSnapshot,
} from "./razorpay.types";
import { paymentProviderSimulator } from "./payment-provider-simulator";

type RazorpaySdk = Pick<Razorpay, "orders" | "payments">;
type SdkRefund = {
  id: string;
  payment_id: string;
  amount: number | string;
  currency: string;
  status: "pending" | "processed" | "failed";
  receipt?: string | null;
};

const asSafeInteger = (value: number | string, field: string) => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`Razorpay returned an invalid ${field}`);
  }
  return parsed;
};

const toOrderSnapshot = (order: Orders.RazorpayOrder): RazorpayOrderSnapshot => ({
  id: order.id,
  amountPaise: asSafeInteger(order.amount, "order amount"),
  amountPaidPaise: asSafeInteger(order.amount_paid, "paid amount"),
  amountDuePaise: asSafeInteger(order.amount_due, "amount due"),
  currency: order.currency,
  receipt: order.receipt ?? null,
  status: order.status,
  attempts: asSafeInteger(order.attempts, "attempt count"),
});

const toPaymentSnapshot = (payment: Payments.RazorpayPayment): RazorpayPaymentSnapshot => ({
  id: payment.id,
  orderId: payment.order_id,
  amountPaise: asSafeInteger(payment.amount, "payment amount"),
  currency: payment.currency,
  status: payment.status,
});

const toRefundSnapshot = (refund: SdkRefund): RazorpayRefundSnapshot => ({
  id: refund.id,
  paymentId: refund.payment_id,
  amountPaise: asSafeInteger(refund.amount, "refund amount"),
  currency: refund.currency,
  status: refund.status,
  receipt: refund.receipt ?? null,
});

export class RazorpaySdkGateway implements RazorpayGateway {
  constructor(private readonly sdk: RazorpaySdk) {}

  async createOrder(input: CreateRazorpayOrderInput) {
    return toOrderSnapshot(await this.sdk.orders.create({
      amount: input.amountPaise,
      currency: input.currency,
      receipt: input.receipt,
      notes: input.notes,
      partial_payment: false,
    }));
  }

  async findOrderByReceipt(receipt: string) {
    const orders = await this.sdk.orders.all({ receipt, count: 2 });
    const matches = orders.items.filter((order) => order.receipt === receipt);
    if (matches.length > 1) throw new Error("Razorpay returned multiple orders for one receipt");
    return matches[0] ? toOrderSnapshot(matches[0]) : null;
  }

  async fetchOrder(orderId: string) {
    return toOrderSnapshot(await this.sdk.orders.fetch(orderId));
  }

  async fetchOrderPayments(orderId: string) {
    const payments = await this.sdk.orders.fetchPayments(orderId);
    return payments.items.map(toPaymentSnapshot);
  }

  async fetchPayment(paymentId: string) {
    return toPaymentSnapshot(await this.sdk.payments.fetch(paymentId));
  }

  async createRefund(input: CreateRazorpayRefundInput) {
    const payments = this.sdk.payments as unknown as {
      refund(paymentId: string, options: {
        amount: number;
        receipt: string;
        notes?: Record<string, string | number>;
      }): Promise<SdkRefund>;
    };
    return toRefundSnapshot(await payments.refund(input.paymentId, {
      amount: input.amountPaise,
      receipt: input.receipt,
      notes: input.notes,
    }));
  }

  async findRefundByReceipt(paymentId: string, receipt: string) {
    const payments = this.sdk.payments as unknown as {
      fetchMultipleRefund(paymentId: string, options: { count: number }): Promise<{ items: SdkRefund[] }>;
    };
    const refunds = await payments.fetchMultipleRefund(paymentId, { count: 100 });
    const matches = refunds.items.filter((refund) => refund.receipt === receipt);
    if (matches.length > 1) throw new Error("Razorpay returned multiple refunds for one receipt");
    return matches[0] ? toRefundSnapshot(matches[0]) : null;
  }

  async fetchRefund(refundId: string) {
    const refundsApi = (this.sdk as unknown as { refunds?: { fetch(id: string): Promise<SdkRefund> } }).refunds;
    if (refundsApi?.fetch) {
      try {
        const refund = await refundsApi.fetch(refundId);
        return toRefundSnapshot(refund);
      } catch {
        return null;
      }
    }
    return null;
  }
}

export const createRazorpayGateway = (
  credentials: RazorpayCredentials & { mode?: "simulator" | "razorpay_test" }
): RazorpayGateway => credentials.mode === "simulator"
  ? paymentProviderSimulator
  : new RazorpaySdkGateway(new Razorpay({
      key_id: credentials.keyId,
      key_secret: credentials.keySecret,
    }));
