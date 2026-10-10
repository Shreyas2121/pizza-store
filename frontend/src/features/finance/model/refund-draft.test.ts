import { describe, expect, it } from "vitest";
import { buildRefundDraft } from "./refund-draft";

const order = {
  items: [{ id: 12, quantity: 1, lineTotalPaise: 24900 }],
  chargedDeliveryFeePaise: 4000,
  grandTotalPaise: 28900,
};
const draft = {
  orderItemId: "12", quantity: 1, itemAmountRupees: "249.00",
  includeDelivery: true, deliveryAmountRupees: "40.00",
};

describe("refund request allocation", () => {
  it("allocates the full ₹289 refund as ₹249 item plus ₹40 delivery", () => {
    expect(buildRefundDraft(order, draft)).toEqual({ amountPaise: 28900, allocations: [
      { orderItemId: 12, quantity: 1, allocatedPaise: 24900 },
      { type: "delivery_fee", allocatedPaise: 4000 },
    ] });
  });
  it("supports item-only refunds and ignores a disabled delivery amount", () => {
    expect(buildRefundDraft(order, { ...draft, includeDelivery: false, deliveryAmountRupees: 999 }))
      .toEqual({ amountPaise: 24900, allocations: [{ orderItemId: 12, quantity: 1, allocatedPaise: 24900 }] });
  });
  it("supports delivery-only and partial delivery refunds without an item", () => {
    expect(buildRefundDraft(order, { ...draft, orderItemId: null, deliveryAmountRupees: "20.50" }))
      .toEqual({ amountPaise: 2050, allocations: [{ type: "delivery_fee", allocatedPaise: 2050 }] });
  });
  it("rejects putting the full order amount into a single item allocation", () => {
    expect(() => buildRefundDraft(order, { ...draft, itemAmountRupees: "289", includeDelivery: false })).toThrow("Refund delivery separately");
  });
  it("rejects delivery above the paid fee and a refund of free delivery", () => {
    expect(() => buildRefundDraft(order, { ...draft, deliveryAmountRupees: "40.01" })).toThrow("charged delivery fee");
    expect(() => buildRefundDraft({ ...order, chargedDeliveryFeePaise: 0 }, draft)).toThrow("charged delivery fee");
  });
  it("uses paid discounted item amounts rather than catalogue prices", () => {
    const discounted = { ...order, items: [{ ...order.items[0], lineTotalPaise: 20000 }], grandTotalPaise: 24000 };
    expect(() => buildRefundDraft(discounted, draft)).toThrow("paid amount");
    expect(buildRefundDraft(discounted, { ...draft, itemAmountRupees: "200" }).amountPaise).toBe(24000);
  });
  it("bounds item amounts by purchased quantity with integer paise rounding", () => {
    const multi = { ...order, items: [{ ...order.items[0], quantity: 2, lineTotalPaise: 24901 }] };
    expect(buildRefundDraft(multi, { ...draft, itemAmountRupees: "124.50", includeDelivery: false }).amountPaise).toBe(12450);
    expect(() => buildRefundDraft(multi, { ...draft, itemAmountRupees: "124.51" })).toThrow("paid amount");
  });
  it.each([0, 2, 0.5, "1"])("rejects invalid quantity %s", (quantity) => {
    expect(() => buildRefundDraft(order, { ...draft, quantity })).toThrow("valid purchased item and quantity");
  });
  it.each(["", "-1", "0", "invalid"])("rejects invalid money %s", (amount) => {
    expect(() => buildRefundDraft(order, { ...draft, itemAmountRupees: amount })).toThrow();
  });
  it("rejects an unknown item and an empty refund", () => {
    expect(() => buildRefundDraft(order, { ...draft, orderItemId: "999" })).toThrow("valid purchased item");
    expect(() => buildRefundDraft(order, { ...draft, orderItemId: null, includeDelivery: false })).toThrow("Select an item or delivery");
  });
});
