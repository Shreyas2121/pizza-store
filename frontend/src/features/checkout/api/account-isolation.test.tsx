import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { API } from "@/shared/api";
import { useCheckoutQuote } from "./quote.queries";
import { useGetOrder, useGetOrders } from "@/features/orders";
import { useGetCartCheckout } from "@/features/cart";
import { useGetAddresses, useGetUser } from "@/features/account";

const session = vi.hoisted(() => ({ userId: 1 }));
vi.mock("@/features/auth/model/auth.store", () => ({ useUser: () => ({ user: { id: session.userId }, isLoggedIn: true }) }));
vi.mock("@/shared/api/api-client", () => ({ API: { get: vi.fn(), post: vi.fn() }, apiClient: {} }));
let client: QueryClient;
beforeEach(() => { session.userId = 1; client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); vi.clearAllMocks(); });
afterEach(() => client.clear());
const renderHook = <T,>(hook: () => T): T => {
  let result: T | undefined;
  function Harness() { result = hook(); return null; }
  renderToString(createElement(QueryClientProvider, { client }, createElement(Harness)));
  if (result === undefined) throw new Error("Hook did not render");
  return result;
};
it("does not reuse another account's quote for the same public cart request", async () => {
  vi.mocked(API.post).mockResolvedValue({ data: { data: { grandTotalPaise: 100 } } });
  const request = { storeId: 10, items: [{ productId: 2, quantity: 1 }] };
  await renderHook(() => useCheckoutQuote(request)).refetch();
  session.userId = 2;
  expect(renderHook(() => useCheckoutQuote(request)).data).toBeUndefined();
});
it("does not reuse another account's private order detail", async () => {
  vi.mocked(API.get).mockResolvedValue({ data: { data: { id: 7 } } });
  await renderHook(() => useGetOrder(7)).refetch();
  session.userId = 2;
  expect(renderHook(() => useGetOrder(7)).data).toBeUndefined();
});
it("does not reuse another account's order history", async () => {
  vi.mocked(API.get).mockResolvedValue({ data: { data: [{ id: 7 }] } });
  await renderHook(() => useGetOrders()).refetch();
  session.userId = 2;
  expect(renderHook(() => useGetOrders()).data).toBeUndefined();
});
it.each(["cart", "addresses", "profile"] as const)("does not reuse another account's checkout %s", async (resource) => {
  vi.mocked(API.get).mockResolvedValue({ data: { data: { id: 1 } } });
  const useResource = resource === "cart" ? useGetCartCheckout : resource === "addresses" ? useGetAddresses : useGetUser;
  await renderHook(() => useResource()).refetch();
  session.userId = 2;
  expect(renderHook(() => useResource()).data).toBeUndefined();
});
