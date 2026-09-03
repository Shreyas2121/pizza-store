import { beforeEach, describe, expect, it } from "vitest";
import { DeterministicPaymentProviderSimulator } from "./payment-provider-simulator";

const input = {
  amountPaise: 52_500,
  currency: "INR" as const,
  receipt: "order_42_payment_17",
};

describe("DeterministicPaymentProviderSimulator", () => {
  let simulator: DeterministicPaymentProviderSimulator;

  beforeEach(() => {
    simulator = new DeterministicPaymentProviderSimulator();
  });

  it("implements deterministic, idempotent provider order creation", async () => {
    const first = await simulator.createOrder(input);
    const second = await simulator.createOrder(input);

    expect(second).toEqual(first);
    expect(first.id).toMatch(/^order_sim[A-Fa-f0-9]+$/);
    expect(await simulator.findOrderByReceipt(input.receipt)).toEqual(first);
  });

  it("scripts a successful captured payment", async () => {
    const order = await simulator.createOrder(input);
    const event = simulator.advance(order.id);

    expect(event?.eventType).toBe("payment.captured");
    expect((await simulator.fetchOrder(order.id)).status).toBe("paid");
    expect((await simulator.fetchPayment(event!.providerPaymentId)).status).toBe(
      "captured"
    );
  });

  it("scripts a failed payment without marking the order paid", async () => {
    const order = await simulator.createOrder(input);
    simulator.script(order.id, "failed");
    const event = simulator.advance(order.id);

    expect(event?.eventType).toBe("payment.failed");
    expect((await simulator.fetchOrder(order.id)).status).toBe("attempted");
    expect((await simulator.fetchPayment(event!.providerPaymentId)).status).toBe(
      "failed"
    );

    simulator.restart(order.id);
    expect(simulator.advance(order.id)?.eventType).toBe("payment.captured");
  });

  it("keeps delayed payments authorized until the next deterministic step", async () => {
    const order = await simulator.createOrder(input);
    simulator.script(order.id, "delayed");

    expect(simulator.advance(order.id)?.eventType).toBe("payment.authorized");
    expect((await simulator.fetchOrder(order.id)).status).toBe("attempted");
    expect(simulator.advance(order.id)?.eventType).toBe("payment.captured");
    expect((await simulator.fetchOrder(order.id)).status).toBe("paid");
  });

  it("replays a duplicate with the same immutable event ID", async () => {
    const order = await simulator.createOrder(input);
    simulator.script(order.id, "duplicate");
    const first = simulator.advance(order.id);
    const duplicate = simulator.advance(order.id);

    expect(duplicate).toMatchObject({
      eventId: first?.eventId,
      eventType: "payment.captured",
      duplicate: true,
    });
    expect(simulator.advance(order.id)).toBeNull();
  });

  it("delivers order.paid before payment.captured for the out-of-order script", async () => {
    const order = await simulator.createOrder(input);
    simulator.script(order.id, "out_of_order");

    expect(simulator.advance(order.id)?.eventType).toBe("order.paid");
    const [authorized] = await simulator.fetchOrderPayments(order.id);
    expect(authorized.status).toBe("authorized");
    expect(simulator.advance(order.id)?.eventType).toBe("payment.captured");
  });

  it("creates one deterministic refund for a stable receipt", async () => {
    const order = await simulator.createOrder(input);
    const paymentId = simulator.advance(order.id)!.providerPaymentId;
    const refundInput = {
      paymentId,
      amountPaise: 10_000,
      receipt: "refund_77",
    };

    const first = await simulator.createRefund(refundInput);
    const replay = await simulator.createRefund(refundInput);

    expect(replay).toEqual(first);
    expect(first).toMatchObject({ status: "processed", amountPaise: 10_000 });
    expect(await simulator.findRefundByReceipt(paymentId, "refund_77")).toEqual(first);
  });
});
