import Razorpay from "razorpay";
import type { Orders } from "razorpay/dist/types/orders";
import type { Payments } from "razorpay/dist/types/payments";
import type {
  CreateRazorpayOrderInput,
  RazorpayCredentials,
  RazorpayGateway,
  RazorpayOrderSnapshot,
  RazorpayPaymentSnapshot,
} from "./razorpay.types";
import { paymentProviderSimulator } from "./payment-provider-simulator";

type RazorpaySdk = Pick<Razorpay, "orders" | "payments">;

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

const toPaymentSnapshot = (
  payment: Payments.RazorpayPayment
): RazorpayPaymentSnapshot => ({
  id: payment.id,
  orderId: payment.order_id,
  amountPaise: asSafeInteger(payment.amount, "payment amount"),
  currency: payment.currency,
  status: payment.status,
});

export class RazorpaySdkGateway implements RazorpayGateway {
  constructor(private readonly sdk: RazorpaySdk) {}

  async createOrder(input: CreateRazorpayOrderInput) {
    const order = await this.sdk.orders.create({
      amount: input.amountPaise,
      currency: input.currency,
      receipt: input.receipt,
      notes: input.notes,
      partial_payment: false,
    });

    return toOrderSnapshot(order);
  }

  async findOrderByReceipt(receipt: string) {
    const orders = await this.sdk.orders.all({ receipt, count: 2 });
    const matchingOrders = orders.items.filter(
      (order) => order.receipt === receipt
    );
    if (matchingOrders.length > 1) {
      throw new Error("Razorpay returned multiple orders for one receipt");
    }
    return matchingOrders[0] ? toOrderSnapshot(matchingOrders[0]) : null;
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
}

export const createRazorpayGateway = (
  credentials: RazorpayCredentials & { mode?: "simulator" | "razorpay_test" }
): RazorpayGateway =>
  credentials.mode === "simulator"
    ? paymentProviderSimulator
    : new RazorpaySdkGateway(
        new Razorpay({
          key_id: credentials.keyId,
          key_secret: credentials.keySecret,
        })
      );
