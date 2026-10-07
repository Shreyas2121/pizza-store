import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { MemoryRouter, Route, Routes } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { API } from "@/shared/api";
import { storeKeys, useStoreBySlug, useStoreSelect } from "./api/store.queries";
import StoreDetailsPage from "./pages/store-details-page";
import type { Store } from "./model/store.types";
import { useStoreStore } from "./model/store.store";

vi.spyOn(API, "get"); let client: QueryClient;
beforeEach(() => { vi.resetAllMocks(); client = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false, staleTime: Infinity } } }); });
afterEach(() => client.clear());
const render = (element: ReactElement) => renderToStaticMarkup(<QueryClientProvider client={client}><MantineProvider env="test"><MemoryRouter initialEntries={["/stores/main-store"]}>{element}</MemoryRouter></MantineProvider></QueryClientProvider>);
function capture<T>(hook: () => T): T { let result: T | undefined; function Harness() { result = hook(); return null; } render(createElement(Harness)); if (!result) throw new Error("Hook did not render"); return result; }
const store: Store = { id: 1, name: "Main store", slug: "main-store", address: "123 Main Street", city: "Mumbai", state: "Maharashtra", pincode: "400001", phone: "9876543210", email: null, latitude: null, longitude: null, opensAt: "09:00", closesAt: "22:00", isActive: true, createdAt: "", updatedAt: "" };
const page = () => render(<Routes><Route path="/stores/:slug" element={<StoreDetailsPage />} /></Routes>);

it("loads ready store selection options using the dedicated endpoint", async () => {
  const options = [{ value: "1", label: "Main store (Mumbai - 400001)" }]; vi.mocked(API.get).mockResolvedValue({ data: { data: options } });
  const result = await capture(() => useStoreSelect()).refetch();
  expect(result.data).toEqual(options); expect(API.get).toHaveBeenCalledWith("/stores/select", { signal: expect.any(AbortSignal) });
});
it("loads an encoded public slug with separate cache entries", async () => {
  vi.mocked(API.get).mockResolvedValue({ data: { data: store } });
  await capture(() => useStoreBySlug("main/store")).refetch();
  expect(API.get).toHaveBeenCalledWith("/stores/slug/main%2Fstore", { signal: expect.any(AbortSignal) });
  expect(capture(() => useStoreBySlug("other-store")).data).toBeUndefined();
});
it("cancels obsolete slug lookups", async () => {
  let signal: AbortSignal | undefined; vi.mocked(API.get).mockImplementation((_url, config) => { signal = config?.signal as AbortSignal; return new Promise(() => {}); });
  const pending = capture(() => useStoreBySlug("main-store")).refetch();
  await client.cancelQueries({ queryKey: storeKeys.bySlug("main-store") }); expect(signal?.aborted).toBe(true); await pending;
});
it("shows public details and requires delivery resolution without changing selected store", () => {
  client.setQueryData(storeKeys.bySlug("main-store"), store); const resolved = useStoreStore.getState().resolvedStore;
  const html = page(); expect(html).toContain("Main store"); expect(html).toContain("123 Main Street"); expect(html).toContain("Check delivery availability");
  expect(useStoreStore.getState().resolvedStore).toBe(resolved);
});
it("shows inactive stores as unavailable without an ordering action", () => {
  client.setQueryData(storeKeys.bySlug("main-store"), { ...store, isActive: false });
  const html = page(); expect(html).toContain("unavailable for orders"); expect(html).not.toContain("Check delivery availability");
});
it("shows a loading state before details arrive", () => {
  expect(page()).toContain("Loading store");
});
it("offers retry for request errors and a specific message for a missing store", async () => {
  vi.mocked(API.get).mockRejectedValue(new Error("Network unavailable"));
  await capture(() => useStoreBySlug("main-store")).refetch();
  expect(page()).toContain("Retry"); expect(page()).toContain("Store details unavailable");
  vi.mocked(API.get).mockRejectedValue({ isAxiosError: true, response: { status: 404 } });
  await capture(() => useStoreBySlug("main-store")).refetch();
  expect(page()).toContain("Store not found"); expect(page()).not.toContain("Retry");
});
