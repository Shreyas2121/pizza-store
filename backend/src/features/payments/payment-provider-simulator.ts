import { createHash } from "crypto";
import type {
  CreateRazorpayRefundInput,
  CreateRazorpayOrderInput,
  RazorpayGateway,
  RazorpayOrderSnapshot,
  RazorpayPaymentSnapshot,
  RazorpayRefundSnapshot,
} from "./razorpay.types";

export const simulatorScenarios = [
  "successful",
  "failed",
  "delayed",
  "duplicate",
  "out_of_order",
] as const;

export type SimulatorScenario = (typeof simulatorScenarios)[number];

export interface SimulatorEvent {
  eventId: string;
  eventType: "payment.authorized" | "payment.captured" | "payment.failed" | "order.paid";
  providerOrderId: string;
  providerPaymentId: string;
  duplicate: boolean;
}

type StoredOrder = {
  order: RazorpayOrderSnapshot;
  payment: RazorpayPaymentSnapshot;
  scenario: SimulatorScenario;
  nextEvent: number;
};

const stableId = (prefix: "order" | "pay" | "event" | "refund", source: string) =>
  `${prefix}_sim${createHash("sha256").update(source).digest("hex").slice(0, 20)}`;

const eventPlan = (scenario: SimulatorScenario) => {
  switch (scenario) {
    case "failed":
      return ["payment.failed"] as const;
    case "delayed":
      return ["payment.authorized", "payment.captured"] as const;
    case "duplicate":
      return ["payment.captured", "payment.captured"] as const;
    case "out_of_order":
      return ["order.paid", "payment.captured"] as const;
    default:
      return ["payment.captured"] as const;
  }
};

/**
 * Credential-free, in-memory adapter for deterministic local demonstrations.
 * It implements the production gateway contract; scenario control stays here,
 * outside payment domain policy.
 */
export class DeterministicPaymentProviderSimulator implements RazorpayGateway {
  private readonly orders = new Map<string, StoredOrder>();
  private readonly orderIdByReceipt = new Map<string, string>();
  private readonly refundsByReceipt = new Map<string, RazorpayRefundSnapshot>();

  async createOrder(input: CreateRazorpayOrderInput) {
    const existingId = this.orderIdByReceipt.get(input.receipt);
    if (existingId) return { ...this.requireOrder(existingId).order };

    const orderId = stableId("order", input.receipt);
    const paymentId = stableId("pay", input.receipt);
    const stored: StoredOrder = {
      order: {
        id: orderId,
        amountPaise: input.amountPaise,
        amountPaidPaise: 0,
        amountDuePaise: input.amountPaise,
        currency: input.currency,
        receipt: input.receipt,
        status: "created",
        attempts: 0,
      },
      payment: {
        id: paymentId,
        orderId,
        amountPaise: input.amountPaise,
        currency: input.currency,
        status: "created",
      },
      scenario: "successful",
      nextEvent: 0,
    };
    this.orders.set(orderId, stored);
    this.orderIdByReceipt.set(input.receipt, orderId);
    return { ...stored.order };
  }

  async findOrderByReceipt(receipt: string) {
    const orderId = this.orderIdByReceipt.get(receipt);
    return orderId ? { ...this.requireOrder(orderId).order } : null;
  }

  async fetchOrder(orderId: string) {
    return { ...this.requireOrder(orderId).order };
  }

  async fetchOrderPayments(orderId: string) {
    return [{ ...this.requireOrder(orderId).payment }];
  }

  async fetchPayment(paymentId: string) {
    for (const stored of this.orders.values()) {
      if (stored.payment.id === paymentId) return { ...stored.payment };
    }
    throw new Error("Simulator payment was not found");
  }

  async createRefund(input: CreateRazorpayRefundInput) {
    const existing = this.refundsByReceipt.get(input.receipt);
    if (existing) return { ...existing };
    const payment = await this.fetchPayment(input.paymentId);
    if (payment.status !== "captured" && payment.status !== "refunded") {
      throw new Error("Simulator payment is not captured");
    }
    const refund: RazorpayRefundSnapshot = {
      id: stableId("refund", input.receipt),
      paymentId: input.paymentId,
      amountPaise: input.amountPaise,
      currency: payment.currency,
      status: "processed",
      receipt: input.receipt,
    };
    this.refundsByReceipt.set(input.receipt, refund);
    return { ...refund };
  }

  async findRefundByReceipt(paymentId: string, receipt: string) {
    const refund = this.refundsByReceipt.get(receipt);
    return refund?.paymentId === paymentId ? { ...refund } : null;
  }

  async fetchRefund(refundId: string) {
    for (const refund of this.refundsByReceipt.values()) {
      if (refund.id === refundId) return { ...refund };
    }
    return null;
  }

  script(orderId: string, scenario: SimulatorScenario) {
    const stored = this.requireOrder(orderId);
    if (stored.nextEvent > 0) {
      if (stored.scenario === scenario) return;
      throw new Error("Simulator scenario has already started");
    }
    stored.scenario = scenario;
  }

  getScenario(orderId: string) {
    const stored = this.requireOrder(orderId);
    return { scenario: stored.scenario, nextEvent: stored.nextEvent };
  }

  restart(orderId: string) {
    const stored = this.requireOrder(orderId);
    stored.scenario = "successful";
    stored.nextEvent = 0;
    stored.order.status = "created";
    stored.order.amountPaidPaise = 0;
    stored.order.amountDuePaise = stored.order.amountPaise;
    stored.payment.status = "created";
  }

  advance(orderId: string): SimulatorEvent | null {
    const stored = this.requireOrder(orderId);
    const plan = eventPlan(stored.scenario);
    const eventType = plan[stored.nextEvent];
    if (!eventType) return null;

    const duplicate =
      stored.scenario === "duplicate" && stored.nextEvent === 1;
    const eventSequence = duplicate ? 0 : stored.nextEvent;
    const eventId = stableId(
      "event",
      `${stored.order.id}:${stored.scenario}:${eventSequence}`
    );
    stored.nextEvent += 1;
    stored.order.attempts = Math.max(stored.order.attempts, 1);

    if (eventType === "payment.failed") {
      stored.payment.status = "failed";
      stored.order.status = "attempted";
    } else if (eventType === "payment.authorized") {
      stored.payment.status = "authorized";
      stored.order.status = "attempted";
    } else if (eventType === "order.paid") {
      stored.payment.status = "authorized";
      stored.order.status = "paid";
      stored.order.amountPaidPaise = stored.order.amountPaise;
      stored.order.amountDuePaise = 0;
    } else {
      stored.payment.status = "captured";
      stored.order.status = "paid";
      stored.order.amountPaidPaise = stored.order.amountPaise;
      stored.order.amountDuePaise = 0;
    }

    return {
      eventId,
      eventType,
      providerOrderId: stored.order.id,
      providerPaymentId: stored.payment.id,
      duplicate,
    };
  }

  reset() {
    this.orders.clear();
    this.orderIdByReceipt.clear();
    this.refundsByReceipt.clear();
  }

  private requireOrder(orderId: string) {
    const stored = this.orders.get(orderId);
    if (!stored) throw new Error("Simulator order was not found");
    return stored;
  }
}

export const paymentProviderSimulator =
  new DeterministicPaymentProviderSimulator();
