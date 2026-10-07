import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { API } from "@/shared/api";
import { inventoryKeys, useProductInventory, useRestockInventory } from "./api/inventory.queries";
import { InventoryDetailContent } from "./components/inventory-detail-drawer";
import { InventoryTable } from "./components/inventory-table";
import type { InventoryItem } from "./model/inventory.types";

vi.spyOn(API, "get"); vi.spyOn(API, "post"); let client: QueryClient;
beforeEach(() => { vi.resetAllMocks(); client = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false, staleTime: Infinity }, mutations: { retry: false } } }); });
afterEach(() => client.clear());
const render = (element: ReactElement) => renderToStaticMarkup(<QueryClientProvider client={client}><MantineProvider env="test">{element}</MantineProvider></QueryClientProvider>);
function capture<T>(hook: () => T): T { let result: T | undefined; function Harness() { result = hook(); return null; } render(createElement(Harness)); if (!result) throw new Error("Hook did not render"); return result; }
const item: InventoryItem = { storeProductId: 12, storeId: 1, productId: 3, productName: "Margherita", productImage: "/uploads/pizza.jpg", pricePaise: 12345, isAvailable: true, productIsAvailable: true, onHandQuantity: 20, reservedQuantity: 4, availableQuantity: 16, lowStockThreshold: 5, lastRestockedAt: null, stockStatus: "in_stock" };
const content = () => render(<InventoryDetailContent storeId={1} productId={3} onHistory={() => {}} />);

it("loads a single product with store scope and an abort signal", async () => {
  vi.mocked(API.get).mockResolvedValue({ data: { data: item } });
  const result = await capture(() => useProductInventory(1, 3)).refetch();
  expect(result.data).toEqual(item);
  expect(API.get).toHaveBeenCalledWith("/inventory/store/1/product/3", { signal: expect.any(AbortSignal) });
  expect(capture(() => useProductInventory(2, 3)).data).toBeUndefined();
  expect(capture(() => useProductInventory(1, 4)).data).toBeUndefined();
});
it("cancels an obsolete product lookup", async () => {
  let signal: AbortSignal | undefined;
  vi.mocked(API.get).mockImplementation((_url, config) => { signal = config?.signal as AbortSignal; return new Promise(() => {}); });
  const pending = capture(() => useProductInventory(1, 3)).refetch();
  await client.cancelQueries({ queryKey: inventoryKeys.detail(1, 3) });
  expect(signal?.aborted).toBe(true); await pending;
});
it("shows stock evidence, refresh and history controls", () => {
  client.setQueryData(inventoryKeys.detail(1, 3), item);
  const html = content();
  for (const label of ["Margherita", "On-hand", "Reserved", "Available", "Low-stock threshold", "Refresh stock", "Movement history", "Never"]) expect(html).toContain(label);
  expect(html).toContain("20"); expect(html).toContain("16");
});
it("distinguishes untracked stock from zero and displays manual unavailability", () => {
  client.setQueryData(inventoryKeys.detail(1, 3), { ...item, onHandQuantity: null, availableQuantity: null, stockStatus: "untracked", isAvailable: false });
  expect(content()).toContain("Stock is untracked"); expect(content()).toContain("Manually unavailable");
  client.setQueryData(inventoryKeys.detail(1, 3), { ...item, onHandQuantity: 0, availableQuantity: 0, stockStatus: "out_of_stock" });
  expect(content()).not.toContain("Stock is untracked"); expect(content()).toContain("out of stock");
});
it("offers retry and explains missing store mappings", async () => {
  vi.mocked(API.get).mockRejectedValue({ isAxiosError: true, response: { status: 404 } });
  await capture(() => useProductInventory(1, 3)).refetch();
  expect(content()).toContain("Product inventory not found"); expect(content()).toContain("Retry");
});
it("refreshes the detail cache after stock mutations", async () => {
  client.setQueryData(inventoryKeys.detail(1, 3), item);
  vi.mocked(API.post).mockResolvedValue({ data: { data: {} } });
  await capture(() => useRestockInventory(1)).mutateAsync({ productId: 3, values: { quantityAdded: 2, reason: "Received stock" } });
  expect(client.getQueryState(inventoryKeys.detail(1, 3))?.isInvalidated).toBe(true);
});
it("makes product details accessible from mobile and desktop inventory rows", () => {
  const html = render(<InventoryTable items={[item]} meta={{ total: 1, page: 1, limit: 20, totalPages: 1, hasNextPage: false }} isRefreshing={false} onPageChange={() => {}} onAction={() => {}} onHistory={() => {}} onDetails={() => {}} selectedProductIds={new Set()} onToggleSelection={() => {}} onTogglePage={() => {}} />);
  expect(html.match(/View inventory for Margherita/g)).toHaveLength(2);
});
