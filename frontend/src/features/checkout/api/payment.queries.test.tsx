import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { API } from "@/shared/api";
import { paymentKeys, shouldPollPayment, usePaymentOrderStatus, useReconcilePayments } from "./payment.queries";
import type { RazorpayCheckoutData } from "../model/checkout.types";
import { PendingPaymentCard } from "../components/pending-payment-card";
import AdminPaymentsPage from "../pages/admin-payments-page";

const session = vi.hoisted(() => ({ userId: 1 }));
vi.mock("@/features/auth", () => ({ useUser: () => ({ user: { id: session.userId }, isLoggedIn: true }) }));
vi.spyOn(API, "get"); vi.spyOn(API, "post");
let client: QueryClient;
beforeEach(() => { vi.resetAllMocks(); session.userId = 1; client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } }); });
afterEach(() => client.clear());
const render = (element: ReactElement) => renderToStaticMarkup(<QueryClientProvider client={client}><MantineProvider env="test"><MemoryRouter>{element}</MemoryRouter></MantineProvider></QueryClientProvider>);
function capture<T>(hook: () => T): T { let result: T | undefined; function Harness() { result = hook(); return null; } render(createElement(Harness)); if (!result) throw new Error("Hook did not render"); return result; }
const status = (paymentStatus: RazorpayCheckoutData["paymentStatus"] = "processing", orderStatus: RazorpayCheckoutData["orderStatus"] = "awaiting_payment") => ({ localOrderId: 9, paymentStatus, orderStatus, failure: null } as RazorpayCheckoutData);

describe("payment status recovery", () => {
  it("requests a private order status with cancellation and isolates accounts", async () => {
    vi.mocked(API.get).mockResolvedValue({ data: { data: status() } });
    await capture(() => usePaymentOrderStatus(9)).refetch();
    expect(API.get).toHaveBeenCalledWith("/payments/razorpay/orders/9", { signal: expect.any(AbortSignal) });
    expect(client.getQueryData(paymentKeys.status(9, 1))).toEqual(status());
    session.userId = 2;
    expect(capture(() => usePaymentOrderStatus(9)).data).toBeUndefined();
  });
  it("polls pending payments and stops on failed, confirmed, refunded or cancelled orders", () => {
    expect(shouldPollPayment(status())).toBe(true);
    expect(shouldPollPayment(status("pending"))).toBe(true);
    for (const payment of [status("failed"), status("completed", "pending"), status("refunded", "cancelled"), status("processing", "cancelled")]) expect(shouldPollPayment(payment)).toBe(false);
  });
  it("shows a manual status refresh and blocks retries after confirmation", () => {
    client.setQueryData(["payment-methods"], { cash: true, razorpay: true, providerMode: "razorpay_test" });
    client.setQueryData(paymentKeys.status(9, 1), status("completed", "pending"));
    const html = render(<PendingPaymentCard localOrderId={9} amountPaise={30000} />);
    expect(html).toContain("Payment updated"); expect(html).toContain("Refresh payment status");
    expect(html).toMatch(/<button[^>]*disabled=""[\s\S]*?Retry secure payment/);
  });
  it("surfaces a failed attempt while keeping status refresh available", () => {
    client.setQueryData(["payment-methods"], { cash: true, razorpay: true, providerMode: "razorpay_test" });
    client.setQueryData(paymentKeys.status(9, 1), { ...status("failed"), failure: { description: "Bank declined the payment" } });
    expect(render(<PendingPaymentCard localOrderId={9} amountPaise={30000} />)).toContain("Bank declined the payment");
  });
});

describe("admin payment reconciliation", () => {
  it("posts bounded batch settings and refreshes orders, finance and payment status", async () => {
    client.setQueryData(["order-adminAll", "pending"], []);
    client.setQueryData(["finance", "overview"], {});
    client.setQueryData(paymentKeys.status(9, 1), status());
    vi.mocked(API.post).mockResolvedValue({ data: { data: { checked: 1, finalized: 1, failed: 0, errors: 0, results: [{ status: "finalized", localOrderId: 9 }] }, message: "Completed" } });
    await capture(useReconcilePayments).mutateAsync({ olderThanMinutes: 15, limit: 25 });
    expect(API.post).toHaveBeenCalledWith("/payments/razorpay/reconcile", { olderThanMinutes: 15, limit: 25 });
    expect(client.getQueryState(["order-adminAll", "pending"])?.isInvalidated).toBe(true);
    expect(client.getQueryState(["finance", "overview"])?.isInvalidated).toBe(true);
    expect(client.getQueryState(paymentKeys.status(9, 1))?.isInvalidated).toBe(true);
  });
  it("renders batch controls and explains the operational effect", () => {
    const html = render(<AdminPaymentsPage />);
    expect(html).toContain("Minimum age (minutes)"); expect(html).toContain("Maximum payments"); expect(html).toContain("Reconcile payments"); expect(html).toContain("notify the kitchen");
  });
});
