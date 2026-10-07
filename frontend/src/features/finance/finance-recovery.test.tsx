import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { API } from "@/shared/api";
import { financeKeys, useRefunds, useStuckRefunds, useReconcileRefunds, useUpdateExpense } from "./api/finance.queries";
import { buildExpenseUpdate, expenseDraftFromDetail } from "./model/expense-draft";
import type { ExpenseDetail } from "./model/finance.types";
import { RefundsPanel } from "./components/refunds-panel";
import { ExpenseDraftForm } from "./components/expense-draft-form";

vi.spyOn(API, "get"); vi.spyOn(API, "post"); vi.spyOn(API, "put");
let client: QueryClient;
beforeEach(() => { vi.resetAllMocks(); client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } }); });
afterEach(() => client.clear());
const render = (element: ReactElement) => renderToStaticMarkup(<QueryClientProvider client={client}><MantineProvider env="test"><MemoryRouter>{element}</MemoryRouter></MantineProvider></QueryClientProvider>);
function capture<T>(hook: () => T): T { let result: T | undefined; function Harness() { result = hook(); return null; } render(createElement(Harness)); if (!result) throw new Error("Hook did not render"); return result; }
const emptyList = { data: [], meta: { total: 0, page: 1, limit: 25, totalPages: 0, hasNextPage: false } };
const detail = (): ExpenseDetail => ({ expense: { id: 7, storeId: 1, vendorId: 2, vendorName: "Supplier", expenseDate: "2026-10-07", description: "Pizza supplies", subtotalPaise: 10001, taxPaise: 199, totalPaise: 10200, status: "rejected", version: 3 } as ExpenseDetail["expense"], allocations: [{ id: 1, expenseId: 7, storeId: 1, categoryId: 3, categoryName: "Ingredients", categoryClassification: "variable", ledgerAccountId: 8, costCenter: "Kitchen", amountPaise: 5200 }, { id: 2, expenseId: 7, storeId: 9, categoryId: 4, categoryName: "Other store ingredients", categoryClassification: "variable", ledgerAccountId: 8, costCenter: null, amountPaise: 5000 }] });

describe("refund investigation", () => {
  it("loads the dedicated queue with store, age, pagination and cancellation", async () => {
    vi.mocked(API.get).mockResolvedValue({ data: emptyList });
    await capture(() => useStuckRefunds(1, 30, 2)).refetch();
    expect(API.get).toHaveBeenCalledWith("/finance/refunds/stuck", { params: { storeId: 1, olderThanMinutes: 30, page: 2, limit: 25 }, signal: expect.any(AbortSignal) });
    expect(capture(() => useStuckRefunds(2, 30, 2)).data).toBeUndefined();
    expect(capture(() => useStuckRefunds(1, 60, 2)).data).toBeUndefined();
    expect(capture(() => useRefunds(1)).data).toBeUndefined();
  });
  it("forwards status filters and pagination to the full refund list", async () => {
    vi.mocked(API.get).mockResolvedValue({ data: emptyList });
    await capture(() => useRefunds(1, "failed", 3)).refetch();
    expect(API.get).toHaveBeenCalledWith("/finance/refunds", { params: { storeId: 1, status: "failed", page: 3, limit: 25 }, signal: expect.any(AbortSignal) });
  });
  it("aborts an obsolete investigation request", async () => {
    let signal: AbortSignal | undefined;
    vi.mocked(API.get).mockImplementation((_url, config) => { signal = config?.signal as AbortSignal; return new Promise(() => {}); });
    const pending = capture(() => useStuckRefunds(1, 15)).refetch();
    await client.cancelQueries({ queryKey: financeKeys.stuckRefunds(1, 15, 1) });
    expect(signal?.aborted).toBe(true); await pending;
  });
  it("reconciles only the selected store and refreshes finance and order caches", async () => {
    const outcome = { checked: 2, processed: 1, failed: 0, processing: 0, unchanged: 0, errors: 1, results: [{ refundId: 10, orderId: 4, status: "processed" }, { refundId: 11, orderId: 5, status: "error", error: "Provider unavailable" }] };
    client.setQueryData(financeKeys.stuckRefunds(1, 15, 1), emptyList);
    client.setQueryData(["order-single", 4], {});
    vi.mocked(API.post).mockResolvedValue({ data: { data: outcome, message: "Completed" } });
    const response = await capture(useReconcileRefunds).mutateAsync({ storeId: 1, olderThanMinutes: 15, limit: 50 });
    expect(API.post).toHaveBeenCalledWith("/finance/refunds/reconcile", { storeId: 1, olderThanMinutes: 15, limit: 50 });
    expect(response.data.errors).toBe(1);
    expect(client.getQueryState(financeKeys.stuckRefunds(1, 15, 1))?.isInvalidated).toBe(true);
    expect(client.getQueryState(["order-single", 4])?.isInvalidated).toBe(true);
  });
  it("restricts reconciliation controls while keeping investigation available", () => {
    client.setQueryData(financeKeys.refunds(1), emptyList);
    const readonly = render(<RefundsPanel storeId={1} canApprove={false} />);
    expect(readonly).toContain("Stuck refunds"); expect(readonly).not.toContain("Reconcile refunds");
    expect(render(<RefundsPanel storeId={1} canApprove />)).toContain("Reconcile refunds");
  });
});

describe("expense draft corrections", () => {
  it("round-trips money, category and cross-store allocation evidence without metadata", () => {
    const payload = buildExpenseUpdate(expenseDraftFromDetail(1, detail()));
    expect(payload.subtotalPaise).toBe(10001); expect(payload.taxPaise).toBe(199); expect(payload.totalPaise).toBe(10200);
    expect(payload.allocations.map((item) => item.storeId)).toEqual([1, 9]);
    expect(payload.allocations.map((item) => item.categoryId)).toEqual([3, 4]);
    expect(payload).not.toHaveProperty("storeId"); expect(payload).not.toHaveProperty("status"); expect(payload).not.toHaveProperty("version");
  });
  it("rejects imbalanced allocations and duplicate dimensions", () => {
    const draft = expenseDraftFromDetail(1, detail());
    draft.allocations[0].amount = 53;
    expect(() => buildExpenseUpdate(draft)).toThrow("exactly");
    draft.allocations = [{ ...draft.allocations[0], amount: 51 }, { ...draft.allocations[0], amount: 51 }];
    expect(() => buildExpenseUpdate(draft)).toThrow("unique");
  });
  it("rejects blank, negative, over-limit or sub-paise amounts", () => {
    for (const subtotal of ["", -1, 500001, "100.001"]) expect(() => buildExpenseUpdate({ ...expenseDraftFromDetail(1, detail()), subtotal })).toThrow();
  });
  it("updates the expense with PUT and refreshes detail and lists", async () => {
    client.setQueryData(financeKeys.expense(7), detail()); client.setQueryData(financeKeys.expenses(1), emptyList);
    vi.mocked(API.put).mockResolvedValue({ data: { data: { ...detail(), expense: { ...detail().expense, status: "draft", version: 4 } } } });
    const data = buildExpenseUpdate(expenseDraftFromDetail(1, detail()));
    const updated = await capture(useUpdateExpense).mutateAsync({ expenseId: 7, data });
    expect(API.put).toHaveBeenCalledWith("/finance/expenses/7", data);
    expect(updated.expense.status).toBe("draft");
    expect(client.getQueryState(financeKeys.expense(7))?.isInvalidated).toBe(true);
    expect(client.getQueryState(financeKeys.expenses(1))?.isInvalidated).toBe(true);
  });
  it("prefills the shared form and explains resubmission for rejected expenses", () => {
    client.setQueryData(financeKeys.vendors(1), [{ id: 2, name: "Supplier", isActive: true }]);
    client.setQueryData(financeKeys.categories(1), [{ id: 3, name: "Ingredients", isActive: true }]);
    const html = render(<ExpenseDraftForm storeId={1} initial={detail()} saving={false} onCancel={() => {}} onSave={async () => {}} />);
    expect(html).toContain("returns this expense to draft"); expect(html).toContain("Pizza supplies"); expect(html).toContain('value="100.01"'); expect(html).toContain("Store #9"); expect(html).toContain("Other store ingredients"); expect(html).toContain("Save expense changes");
  });
});
