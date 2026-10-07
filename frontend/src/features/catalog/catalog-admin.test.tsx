import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router";
import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { API } from "@/shared/api";
import { storeKeys } from "@/features/store";
import { catalogKeys } from "./model/catalog.keys";
import { useCreateCategory, useGetCategories } from "./api/category.queries";
import { useAdminBundle, usePublicBundle, useSaveBundle } from "./api/bundle.queries";
import { bundleWriteSchema, type BundleWrite } from "./model/bundle.schemas";
import AdminCategoriesPage from "./pages/admin-categories-page";
import AdminBundlePage from "./pages/admin-bundle-page";
import { useCreateProduct } from "./api/product.queries";

const actualPost = API.post.bind(API);
vi.spyOn(API, "get");
vi.spyOn(API, "post");
vi.spyOn(API, "put");
let client: QueryClient;
const input: BundleWrite = { components: [{ productId: 2, quantityPerBundle: 2 }], storePrices: [{ storeId: 1, sellingPricePaise: 30000, compareAtPricePaise: 36000, isAvailable: true }] };
const definition = { ...input, bundleProductId: 10, bundleName: "Dinner combo", components: [{ ...input.components[0], name: "Pizza", isAvailable: true }] };
const render = (element: React.ReactElement, path = "/") => renderToStaticMarkup(<QueryClientProvider client={client}><MantineProvider env="test"><MemoryRouter initialEntries={[path]}>{element}</MemoryRouter></MantineProvider></QueryClientProvider>);
function capture<T>(hook: () => T): T {
  let result: T | undefined;
  function Harness() { result = hook(); return null; }
  render(createElement(Harness));
  if (!result) throw new Error("Hook did not render");
  return result;
}
beforeEach(() => { vi.resetAllMocks(); client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } }); });
afterEach(() => client.clear());

describe("category and bundle API integration", () => {
  it("keeps bundle product uploads as multipart data through Axios", async () => {
    const originalAdapter = API.defaults.adapter;
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => ({ data: { data: { id: 10, productType: "bundle" } }, status: 201, statusText: "Created", headers: {}, config }));
    API.defaults.adapter = adapter;
    vi.mocked(API.post).mockImplementation(actualPost);
    try {
      const payload = new FormData();
      payload.append("productType", "bundle");
      payload.append("image", new Blob(["image"], { type: "image/png" }), "combo.png");
      expect((await capture(useCreateProduct).mutateAsync(payload)).data.id).toBe(10);
      const request = adapter.mock.calls[0][0];
      expect(request.data).toBe(payload);
      expect(request.headers.get("Content-Type")).toContain("multipart/form-data");
      expect(request.data.get("productType")).toBe("bundle");
      expect(request.data.get("image").name).toBe("combo.png");
    } finally { API.defaults.adapter = originalAdapter; }
  });
  it("loads category entities and refreshes both list and selectors after creation", async () => {
    vi.mocked(API.get).mockResolvedValue({ data: { data: [{ id: 1, name: "Sides" }] } });
    expect((await capture(useGetCategories).refetch()).data?.[0].name).toBe("Sides");
    expect(API.get).toHaveBeenCalledWith("/category", expect.objectContaining({ signal: expect.any(AbortSignal) }));
    client.setQueryData(catalogKeys.category.select(), []);
    vi.mocked(API.post).mockResolvedValue({ data: { data: { id: 1, name: "Sides" } } });
    await capture(useCreateCategory).mutateAsync({ name: "Sides" });
    expect(API.post).toHaveBeenCalledWith("/category", { name: "Sides" });
    expect(client.getQueryState(catalogKeys.category.all())?.isInvalidated).toBe(true);
    expect(client.getQueryState(catalogKeys.category.select())?.isInvalidated).toBe(true);
  });
  it("treats an absent definition as a new bundle but surfaces other lookup failures", async () => {
    const absent = (message: string) => new AxiosError("Not found", "404", undefined, undefined, { status: 404, data: { message } } as never);
    vi.mocked(API.get).mockRejectedValueOnce(absent("Bundle definition not found"));
    expect((await capture(() => useAdminBundle(10)).refetch()).data).toBeNull();
    vi.mocked(API.get).mockRejectedValue(absent("Bundle not found"));
    await capture(() => useAdminBundle(11)).refetch();
    expect(client.getQueryState(catalogKeys.bundles.admin(11))?.status).toBe("error");
  });
  it("creates with POST, updates with PUT, and refreshes catalogue and store caches", async () => {
    client.setQueryData(storeKeys.products(1), []);
    client.setQueryData(catalogKeys.products.admin(), []);
    vi.mocked(API.post).mockResolvedValue({ data: { data: definition } });
    vi.mocked(API.put).mockResolvedValue({ data: { data: definition } });
    await capture(() => useSaveBundle(10, false)).mutateAsync(input);
    expect(API.post).toHaveBeenCalledWith("/bundles/admin/10", input);
    expect(client.getQueryData(catalogKeys.bundles.admin(10))).toEqual(definition);
    await capture(() => useSaveBundle(10, true)).mutateAsync(input);
    expect(API.put).toHaveBeenCalledWith("/bundles/admin/10", input);
    expect(client.getQueryState(storeKeys.products(1))?.isInvalidated).toBe(true);
    expect(client.getQueryState(catalogKeys.products.admin())?.isInvalidated).toBe(true);
  });
  it("loads public previews with the selected store", async () => {
    vi.mocked(API.get).mockResolvedValue({ data: { data: { productId: 10 } } });
    await capture(() => usePublicBundle(10, 1, true)).refetch();
    expect(API.get).toHaveBeenCalledWith("/bundles/10", { params: { storeId: 1 }, signal: expect.any(AbortSignal) });
    expect(client.getQueryData(catalogKeys.bundles.public(10, 2))).toBeUndefined();
  });
  it("rejects duplicate components, duplicate stores, fractional quantities and invalid discounts", () => {
    expect(bundleWriteSchema.safeParse(input).success).toBe(true);
    expect(bundleWriteSchema.safeParse({ ...input, components: [input.components[0], input.components[0]] }).success).toBe(false);
    expect(bundleWriteSchema.safeParse({ ...input, storePrices: [input.storePrices[0], input.storePrices[0]] }).success).toBe(false);
    expect(bundleWriteSchema.safeParse({ ...input, components: [{ productId: 2, quantityPerBundle: 1.5 }] }).success).toBe(false);
    expect(bundleWriteSchema.safeParse({ ...input, storePrices: [{ ...input.storePrices[0], compareAtPricePaise: 30000 }] }).success).toBe(false);
  });
});

describe("catalogue admin screens", () => {
  it("renders category creation and the full category list", () => {
    client.setQueryData(catalogKeys.category.all(), [{ id: 1, name: "Sides", isActive: true }]);
    const html = render(<AdminCategoriesPage />);
    expect(html).toContain("Create category"); expect(html).toContain("Sides"); expect(html).toContain("Active");
  });
  it("renders an existing bundle's quantities, prices and saved preview control", () => {
    client.setQueryData(catalogKeys.products.admin(), [{ id: 10, name: "Dinner combo", productType: "bundle" }, { id: 2, name: "Pizza", productType: "single" }]);
    client.setQueryData(storeKeys.list(), [{ id: 1, name: "Main store" }]);
    client.setQueryData(catalogKeys.bundles.admin(10), definition);
    const html = render(<Routes><Route path="/admin/bundles/:id" element={<AdminBundlePage />} /></Routes>, "/admin/bundles/10");
    expect(html).toContain("Dinner combo"); expect(html).toContain("Pizza"); expect(html).toContain('value="300"'); expect(html).toContain("Save changes"); expect(html).toContain("Preview store");
  });
});
