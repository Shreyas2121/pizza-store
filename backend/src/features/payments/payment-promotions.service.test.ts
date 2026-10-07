import { afterEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "crypto";
import { db } from "../../db";
import { ordersTable, paymentsTable, paymentWebhookEventsTable } from "../../db/schema";
import { AppError } from "../../utils/error";
import type { TransactionType } from "../../utils/types";
import inventoryService from "../inventory/inventory.service";
import checkoutService from "../checkout/checkout-snapshot.service";
import cartService from "../cart/cart.service";
import financialEventService from "../finance-events/financial-event.service";
import { promotionApplicationService, PromotionApplicationService, PromotionApplicationRepository } from "../promotions/applications";
import type { ApplicationRow, AllocationWrite } from "../promotions/promotion-application.repository";
import type { PromotionRow } from "../promotions/promotion.mapper";
import type { DiscountMode } from "../promotions/promotion.types";
import { snapshotQuote } from "../promotions/promotion-application.test-fixtures";
import paymentService from "./payment.service";
import paymentFinalizationService from "./payment-finalization.service";
import paymentStaleRecoveryService from "./payment-stale-recovery.service";
import paymentRepository from "./payment.repository";
import { toCheckoutResponse } from "./payment.helpers";
import * as config from "./razorpay.config";
import * as gateway from "./razorpay.gateway";
import { DeterministicPaymentProviderSimulator } from "./payment-provider-simulator";
import type { LocalRazorpayAttempt } from "./payment.types";
import razorpayWebhookService from "./razorpay.webhook";

const now = new Date("2026-10-07T10:00:00Z");
afterEach(() => vi.restoreAllMocks());
async function harness(mode: DiscountMode, seeded = true) {
  const quote = snapshotQuote();
  quote.discountMode = mode;
  if (mode !== "automatic_deals") {
    quote.promotions = mode === "none" ? [] : [{ ...quote.promotions[0], kind: "coupon", code: "SAVE" }];
    quote.itemDiscountPaise = mode === "none" ? 0 : 200;
    quote.deliveryDiscountPaise = 0;
    quote.chargedDeliveryFeePaise = 500;
    quote.promotionSavingsPaise = quote.itemDiscountPaise;
    quote.grandTotalPaise = 2500 - quote.itemDiscountPaise;
    quote.items[0].itemDiscountPaise = quote.itemDiscountPaise;
    quote.items[0].lineTotalPaise = 2000 - quote.itemDiscountPaise;
    quote.items[0].taxPaise = mode === "none" ? 95 : 86;
    quote.items[0].taxableAmountPaise = quote.items[0].lineTotalPaise - quote.items[0].taxPaise;
    quote.tax.deliveryRule.taxPaise = 76;
    quote.tax.deliveryRule.taxableAmountPaise = 424;
    quote.taxPaise = quote.items[0].taxPaise + 76;
    quote.taxableAmountPaise = quote.grandTotalPaise - quote.taxPaise;
    quote.totalDisplayedSavingsPaise = quote.promotionSavingsPaise;
    quote.deliveryPricing.chargedFeePaise = 500;
    quote.couponEligibility = { eligible: true, reasonCode: null, conflictingLineIds: [] };
  }
  const owner = { id: 42, userId: 7, storeId: 1, discountMode: mode,
    discountPaise: quote.itemDiscountPaise, deliveryFeePaise: quote.chargedDeliveryFeePaise, grandTotalPaise: quote.grandTotalPaise };
  const order = { ...owner, status: "awaiting_payment", pricingTimezone: "UTC" };
  const payment = { id: 8, provider: "razorpay", providerOrderId: "order_saved" as string | null, providerPaymentId: null as string | null,
    amountPaise: quote.grandTotalPaise, currency: "INR", status: "processing", providerStatus: "created",
    failureCode: null, failureDescription: null };
  const writes: Array<{ table: unknown; values: unknown }> = [];
  const txDouble = {
    select: () => ({ from: (table: unknown) => {
      let joined = false;
      const query = { innerJoin: () => { joined = true; return query; }, where: () => query, for: () => query,
        limit: async () => table === paymentWebhookEventsTable
          ? [{ id: 1, eventType: "payment.captured", status: "processed", updatedAt: now }]
          : table === ordersTable ? joined ? [{ order, payment }] : [order] : [payment] };
      return query;
    } }),
    update: (table: unknown) => ({ set: (values: Record<string, unknown>) => ({ where: () => {
      writes.push({ table, values });
      if (table === ordersTable && typeof values.status === "string") order.status = values.status;
      return Object.assign(Promise.resolve([]), { returning: async () => [{ id: 9, method: "upi" }] });
    } }) }),
    insert: (table: unknown) => ({ values: (values: Record<string, unknown> | unknown[]) => ({ returning: async () => {
      if (table === ordersTable) return [{ ...owner, ...values, id: 42 }];
      if (table === paymentsTable) return [{ ...payment, ...values, id: 8 }];
      return [{ ...values, id: 501 }];
    } }) }),
  };
  // Partial transaction query double: every DB call in this test is intercepted.
  const tx = txDouble as unknown as TransactionType;
  vi.spyOn(db, "transaction").mockImplementation(async (callback) => callback(tx));
  vi.spyOn(paymentRepository, "lockLifecycleOwner").mockImplementation(async () => {
    if (order.status === "pending") return "pending";
    if (order.status === "cancelled") return "cancelled";
    return "awaiting_payment";
  });
  vi.spyOn(paymentRepository, "updatePayment").mockImplementation(async (values) => {
    if (values.status) payment.status = values.status;
    if (values.providerPaymentId) payment.providerPaymentId = values.providerPaymentId;
    if (values.providerOrderId) payment.providerOrderId = values.providerOrderId;
  });
  vi.spyOn(inventoryService, "restoreReservationsForOrder").mockResolvedValue(undefined);
  vi.spyOn(inventoryService, "consumeReservationsForOrder").mockResolvedValue({ consumedCount: 0, alreadyConsumed: false });
  vi.spyOn(inventoryService, "releaseReservations").mockResolvedValue(undefined);
  vi.spyOn(financialEventService, "write").mockResolvedValue({} as never);
  const repository = new PromotionApplicationRepository();
  let rows: ApplicationRow[] = [];
  let allocations: Array<AllocationWrite & { id: number; createdAt: Date }> = [];
  const definitions: PromotionRow[] = quote.promotions.map((p) => ({
    id: p.id, definitionVersion: p.definitionVersion, kind: p.kind, name: p.name, description: "Snapshot test", code: p.code,
    discountType: p.discountType, discountRateBps: null, discountAmountPaise: p.itemDiscountPaise || null, maxDiscountPaise: null,
    scope: p.deliveryDiscountPaise ? "delivery" : "cart", includeCustomizationValue: false, minimumOrderPaise: 0, minimumCartQuantity: 0,
    firstOrderOnly: false, startsAt: new Date("2026-01-01"), endsAt: new Date("2027-01-01"), activeDaysOfWeek: null,
    activeStartTime: null, activeEndTime: null, perUserRedemptionLimit: null, maxRedemptions: null, totalDiscountBudgetPaise: null,
    displayPriority: 0, imageUrl: null, mobileImageUrl: null, imageAlt: null, showOnHomepage: false, isActive: true, createdAt: now, updatedAt: now,
  }));
  vi.spyOn(repository, "lockOwner").mockResolvedValue(owner);
  vi.spyOn(repository, "lockDefinitions").mockResolvedValue({ promotions: definitions, settings: [] });
  vi.spyOn(repository, "applications").mockImplementation(async () => rows);
  vi.spyOn(repository, "allocations").mockImplementation(async () => allocations.map((a) => ({ ...a, orderItemId: a.orderItemId ?? null, unitIndex: a.unitIndex ?? null })));
  vi.spyOn(repository, "usage").mockResolvedValue([]);
  vi.spyOn(repository, "insert").mockImplementation(async (values) => {
    rows = values.map((v, index) => ({ ...v, id: index + 1, promotionCode: v.promotionCode ?? null,
      reservedAt: v.reservedAt ?? null, consumedAt: v.consumedAt ?? null, releasedAt: v.releasedAt ?? null, createdAt: now, updatedAt: now }));
    return rows;
  });
  vi.spyOn(repository, "insertAllocations").mockImplementation(async (values) => {
    allocations = values.map((v, index) => ({ ...v, id: index + 1, createdAt: now }));
  });
  vi.spyOn(repository, "transition").mockImplementation(async (ids, from, to) => {
    rows = rows.map((row) => ids.includes(row.id) && row.status === from ? { ...row, status: to } : row);
  });
  const applications = new PromotionApplicationService(repository, () => now);
  if (seeded) await applications.record(42, quote, new Map([[101, 501]]), "reserved", tx, now);
  vi.spyOn(promotionApplicationService, "record").mockImplementation((...args) => applications.record(...args));
  vi.spyOn(promotionApplicationService, "restore").mockImplementation((...args) => applications.restore(...args));
  vi.spyOn(promotionApplicationService, "consume").mockImplementation((...args) => applications.consume(...args));
  vi.spyOn(promotionApplicationService, "release").mockImplementation((...args) => applications.release(...args));
  const attempt: LocalRazorpayAttempt = { localOrderId: 42, localPaymentId: 8, userId: 7, storeId: 1, storeName: "Store",
    grandTotalPaise: quote.grandTotalPaise, amountPaise: quote.grandTotalPaise, currency: "INR", provider: "razorpay",
    status: "processing", providerStatus: "created", providerOrderId: "order_saved", failureCode: null, failureDescription: null,
    discountMode: mode, orderStatus: "awaiting_payment", promotions: quote.promotions };
  vi.spyOn(paymentRepository, "getAttemptByOrderId").mockImplementation(async () => ({ ...attempt,
    status: payment.status === "failed" ? "failed" : payment.status === "completed" ? "completed" : "processing" }));
  vi.spyOn(config, "isRazorpayCheckoutEnabled").mockReturnValue(true);
  vi.spyOn(config, "getRazorpayConfig").mockReturnValue({ keyId: "test", keySecret: "test", webhookSecret: "test", mode: "simulator" });
  const capture = () => paymentFinalizationService.finalizeCapturedPayment({ localOrderId: 42, userId: 7,
    providerOrderId: "order_saved", providerPaymentId: "pay_captured", amountPaise: quote.grandTotalPaise, currency: "INR", providerStatus: "captured" });
  const fail = () => paymentFinalizationService.markProviderPaymentFailed(attempt,
    { id: "pay_failed", orderId: "order_saved", amountPaise: quote.grandTotalPaise, currency: "INR", status: "failed" }, {});
  return { quote, attempt, order, payment, rows: () => rows, repository, definitions, writes, tx, capture, fail };
}

describe.each<DiscountMode>(["none", "coupon", "automatic_deals"])("online %s application collection", (mode) => {
  it("accepts a signed capture webhook and acknowledges its duplicate without another collection transition", async () => {
    const h = await harness(mode);
    vi.mocked(config.getRazorpayConfig).mockReturnValue({ keyId: "test", keySecret: "test", webhookSecret: "webhook", mode: "razorpay_test" });
    let claimed = false;
    // Partial Drizzle builder doubles expose only the methods used by the raw
    // event receiver; the payment transaction uses the separate typed harness.
    vi.spyOn(db, "insert").mockImplementation(() => ({ values: () => ({ onConflictDoNothing: () => ({ returning: async () => {
      if (claimed) return []; claimed = true; return [{ id: 1 }];
    } }) }) }) as unknown as ReturnType<typeof db.insert>);
    vi.spyOn(db, "update").mockImplementation(() => ({ set: () => ({ where: async () => [] }) }) as unknown as ReturnType<typeof db.update>);
    vi.spyOn(paymentService, "reconcileProviderPayment").mockImplementation(() => h.capture());
    const body = Buffer.from(JSON.stringify({ event: "payment.captured", payload: { payment: { entity: {
      id: "pay_captured", order_id: "order_saved", amount: h.quote.grandTotalPaise, currency: "INR", status: "captured",
    } } } }));
    const signature = createHmac("sha256", "webhook").update(body).digest("hex");
    expect((await razorpayWebhookService.handle(body, signature, "event_saved")).duplicate).toBe(false);
    expect(h.rows().every((row) => row.status === "consumed")).toBe(true);
    expect((await razorpayWebhookService.handle(body, signature, "event_saved")).duplicate).toBe(true);
    expect(paymentService.reconcileProviderPayment).toHaveBeenCalledOnce();
    expect(financialEventService.write).toHaveBeenCalledOnce();
  });
  it("initiates with the shared snapshot writer and returns the original amount on a repeated client request", async () => {
    const h = await harness(mode, false);
    h.payment.providerOrderId = null;
    h.payment.status = "pending";
    vi.spyOn(gateway, "createRazorpayGateway").mockReturnValue(new DeterministicPaymentProviderSimulator());
    const getAttempt = vi.spyOn(paymentRepository, "getAttemptByClientRequestId").mockResolvedValue(undefined);
    const createAttempt = vi.spyOn(paymentRepository, "createPaymentAttempt");
    vi.spyOn(cartService, "clearCart").mockResolvedValue(undefined);
    vi.spyOn(inventoryService, "reserveStockForOrder").mockResolvedValue([]);
    vi.spyOn(checkoutService, "buildQuote").mockResolvedValue({
      cart: { storeId: 1, items: [{ id: 101, productId: 11, quantity: 2, customizationOptionIds: [5] }] },
      store: { id: 1, name: "Store", slug: "store", address: "Street", city: "City", state: "Karnataka", pincode: "123456",
        phone: "1234567890", email: null, latitude: null, longitude: null, opensAt: "00:00", closesAt: "23:59", timezone: "UTC", isActive: true, createdAt: now, updatedAt: now },
      address: { id: 2, userId: 7, type: "Home", street: "Street", city: "City", state: "Karnataka", pincode: "123456", phone: "1234567890", createdAt: now, updatedAt: now },
      now, pricingQuote: h.quote, totalPaise: h.quote.grandTotalPaise, stockAllocations: [],
    });
    const request = { userId: 7, addressId: 2, clientRequestId: "c7c7f5f4-4079-4b9f-8ebf-f740322e1d53", couponCode: mode === "coupon" ? "SAVE" : null };
    const first = await paymentService.initiateRazorpayOrder(request);
    expect(first.amountPaise).toBe(h.quote.grandTotalPaise);
    expect(first.discountMode).toBe(mode);
    expect(createAttempt).toHaveBeenCalledWith(expect.objectContaining({ expiresAt: new Date("2026-10-07T10:30:00Z") }), h.tx);
    expect(h.rows()).toHaveLength(mode === "none" ? 0 : mode === "coupon" ? 1 : 2);
    expect(h.rows().every((row) => row.status === "reserved")).toBe(true);
    expect(financialEventService.write).not.toHaveBeenCalled();
    getAttempt.mockResolvedValue({ ...h.attempt, providerOrderId: first.razorpayOrderId });
    expect((await paymentService.initiateRazorpayOrder(request)).amountPaise).toBe(first.amountPaise);
    expect(checkoutService.buildQuote).toHaveBeenCalledOnce();
    expect(cartService.clearCart).toHaveBeenCalledExactlyOnceWith(7, h.tx);
  });
  it("reserves exact rows, restores unchanged snapshots after edits, and consumes once despite out-of-order failure", async () => {
    const h = await harness(mode);
    const count = mode === "none" ? 0 : mode === "coupon" ? 1 : 2;
    expect(h.rows()).toHaveLength(count);
    expect(h.rows().every((row) => row.status === "reserved")).toBe(true);
    expect(financialEventService.write).not.toHaveBeenCalled();
    await h.fail();
    expect(h.rows().every((row) => row.status === "released")).toBe(true);
    for (const definition of h.definitions) { definition.isActive = false; definition.definitionVersion++; definition.name = "Edited"; }
    const response = await paymentService.retryRazorpayOrder(42, 7);
    expect(response.amountPaise).toBe(h.quote.grandTotalPaise);
    expect(response.promotions).toEqual(h.attempt.promotions);
    expect(h.rows().every((row) => row.status === "reserved" && row.promotionName !== "Edited")).toBe(true);
    expect(inventoryService.restoreReservationsForOrder).toHaveBeenCalledWith(42, h.tx);
    expect((await h.capture()).finalizedNow).toBe(true);
    expect(h.rows().every((row) => row.status === "consumed")).toBe(true);
    expect((await h.capture()).finalizedNow).toBe(false);
    expect((await h.fail()).finalizedNow).toBe(false);
    expect(financialEventService.write).toHaveBeenCalledOnce();
    expect(financialEventService.write).toHaveBeenCalledWith(h.tx, expect.objectContaining({ eventType: "payment_attempt.captured" }));
    expect(h.repository.transition).toHaveBeenLastCalledWith(h.rows().map((row) => row.id), "reserved", "consumed", expect.any(Date), h.tx);
  });
  it("releases promotion collections when a failed hold without tracked stock expires", async () => {
    const h = await harness(mode);
    await h.fail();
    h.payment.providerOrderId = null;
    vi.spyOn(paymentRepository, "getAttemptByOrderId").mockResolvedValue({ ...h.attempt, status: "failed", providerOrderId: null });
    vi.spyOn(inventoryService, "getExpiredActiveReservationOrderIds").mockResolvedValue([]);
    vi.spyOn(paymentRepository, "getExpiredAwaitingOrderIds").mockResolvedValue([42]);
    const result = await paymentStaleRecoveryService.reconcileExpiredReservations(25, { reconcileProviderPayment: vi.fn() });
    expect(result.released).toBe(1);
    expect(h.order.status).toBe("cancelled");
    expect(h.rows().every((row) => row.status === "released")).toBe(true);
    await expect(paymentService.retryRazorpayOrder(42, 7)).rejects.toMatchObject({ code: "PAYMENT_ORDER_NOT_PAYABLE" });
    expect(financialEventService.write).not.toHaveBeenCalled();
  });
});

describe("payment recovery capacity and snapshot boundaries", () => {
  it("recovers an unattached provider order by receipt before retry can create another", async () => {
    const h = await harness("automatic_deals");
    await h.fail();
    h.payment.providerOrderId = null;
    vi.spyOn(paymentRepository, "getAttemptByOrderId").mockResolvedValue({ ...h.attempt, status: "failed", providerOrderId: null });
    const simulator = new DeterministicPaymentProviderSimulator();
    const saved = await simulator.createOrder({ amountPaise: h.quote.grandTotalPaise, currency: "INR", receipt: "order_42_payment_8" });
    vi.spyOn(simulator, "createOrder");
    vi.spyOn(simulator, "findOrderByReceipt");
    vi.spyOn(gateway, "createRazorpayGateway").mockReturnValue(simulator);
    const result = await paymentService.retryRazorpayOrder(42, 7);
    expect(result.razorpayOrderId).toBe(saved.id);
    expect(simulator.findOrderByReceipt).toHaveBeenCalledExactlyOnceWith("order_42_payment_8");
    expect(simulator.createOrder).not.toHaveBeenCalled();
    expect(h.rows().every((row) => row.status === "reserved")).toBe(true);
  });
  it("attaches provider identity without restoring released budget or erasing failed state", async () => {
    const h = await harness("coupon");
    await h.fail();
    h.payment.providerOrderId = null;
    const simulator = new DeterministicPaymentProviderSimulator();
    const saved = await simulator.createOrder({ amountPaise: h.quote.grandTotalPaise, currency: "INR", receipt: "order_42_payment_8" });
    await paymentStaleRecoveryService.attachRecoveredProviderOrder({ ...h.attempt, providerOrderId: null, status: "failed" }, saved);
    expect(h.payment.status).toBe("failed");
    expect(h.rows()[0].status).toBe("released");
    expect(promotionApplicationService.restore).not.toHaveBeenCalled();
  });
  it("does not expire an order finalized after candidate discovery", async () => {
    const h = await harness("automatic_deals");
    await h.capture();
    vi.spyOn(paymentRepository, "getAttemptByOrderId").mockResolvedValue({ ...h.attempt, providerOrderId: null, status: "pending" });
    vi.spyOn(inventoryService, "getExpiredActiveReservationOrderIds").mockResolvedValue([42]);
    vi.spyOn(paymentRepository, "getExpiredAwaitingOrderIds").mockResolvedValue([]);
    const result = await paymentStaleRecoveryService.reconcileExpiredReservations(25, { reconcileProviderPayment: vi.fn() });
    expect(result.skipped).toBe(1);
    expect(h.order.status).toBe("pending");
    expect(h.rows().every((row) => row.status === "consumed")).toBe(true);
  });
  it("preserves a provider identity attached after the expiry observation", async () => {
    const h = await harness("coupon");
    await h.fail();
    vi.spyOn(paymentRepository, "getAttemptByOrderId").mockResolvedValue({ ...h.attempt, providerOrderId: null, status: "failed" });
    vi.spyOn(inventoryService, "getExpiredActiveReservationOrderIds").mockResolvedValue([42]);
    vi.spyOn(paymentRepository, "getExpiredAwaitingOrderIds").mockResolvedValue([]);
    const result = await paymentStaleRecoveryService.reconcileExpiredReservations(25, { reconcileProviderPayment: vi.fn() });
    expect(result.skipped).toBe(1);
    expect(h.order.status).toBe("awaiting_payment");
  });
  it("checks capacity for retries but accepts an authoritative capture against saved amounts", async () => {
    const h = await harness("automatic_deals");
    await h.fail();
    h.definitions[0].maxRedemptions = 1;
    vi.mocked(h.repository.usage).mockResolvedValue([{ promotionId: 10, count: "1", userCount: "0", budget: "200" }]);
    await expect(paymentService.retryRazorpayOrder(42, 7)).rejects.toMatchObject({ code: "PROMOTION_CAPACITY_EXHAUSTED" });
    expect(h.rows().every((row) => row.status === "released")).toBe(true);
    expect((await h.capture()).finalizedNow).toBe(true);
    expect(h.rows().every((row) => row.status === "consumed")).toBe(true);
  });
  it("rejects payment/order amount drift before consuming or posting", async () => {
    const h = await harness("coupon");
    h.order.grandTotalPaise++;
    await expect(h.capture()).rejects.toMatchObject({ code: "PAYMENT_PROVIDER_MISMATCH" });
    expect(promotionApplicationService.consume).not.toHaveBeenCalled();
    expect(financialEventService.write).not.toHaveBeenCalled();
  });
  it("rejects a stock shortage without promoting a retry to processing", async () => {
    const h = await harness("automatic_deals");
    await h.fail();
    vi.mocked(inventoryService.restoreReservationsForOrder).mockRejectedValue(new AppError("Stock unavailable", 409, "INSUFFICIENT_STOCK"));
    await expect(paymentService.retryRazorpayOrder(42, 7)).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
    expect(h.payment.status).toBe("failed");
    expect(h.rows().every((row) => row.status === "released")).toBe(true);
  });
  it("does not advertise checkout on cancelled provider orders", async () => {
    const h = await harness("none");
    expect(toCheckoutResponse({ ...h.attempt, orderStatus: "cancelled" }, "key").checkoutReady).toBe(false);
  });
});
