import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { API } from "@/shared/api";
import { useCreateCustomizationGroup, useCreateCustomizationOption } from "./api/customization.queries";
import { catalogKeys } from "./model/catalog.keys";
import { AdminCustomizationsPage } from "./pages/admin-customizations-page";
import { CustomizationGroupForm, CustomizationOptionForm } from "./components/admin/customization-create-form";

vi.spyOn(API, "post");
let client: QueryClient;
beforeEach(() => { vi.resetAllMocks(); client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } }); });
afterEach(() => client.clear());
const render = (element: ReactElement) => renderToStaticMarkup(<QueryClientProvider client={client}><MantineProvider env="test"><MemoryRouter>{element}</MemoryRouter></MantineProvider></QueryClientProvider>);
function capture<T>(hook: () => T): T { let result: T | undefined; function Harness() { result = hook(); return null; } render(createElement(Harness)); if (!result) throw new Error("Hook did not render"); return result; }
it("creates groups and options using paise and refreshes customer customizations", async () => {
  client.setQueryData(catalogKeys.products.customizations(2), []);
  client.setQueryData(catalogKeys.customizations.admin(), []);
  vi.mocked(API.post).mockResolvedValue({ data: { data: { id: 1 } } });
  const group = { name: "Crust", type: "single" as const, required: true };
  await capture(useCreateCustomizationGroup).mutateAsync(group);
  expect(API.post).toHaveBeenCalledWith("/customize/group", group);
  const option = { groupId: 1, name: "Thin", pricePaise: 1250, isAvailable: true };
  await capture(useCreateCustomizationOption).mutateAsync(option);
  expect(API.post).toHaveBeenCalledWith("/customize/option", option);
  expect(client.getQueryState(catalogKeys.products.customizations(2))?.isInvalidated).toBe(true);
  expect(client.getQueryState(catalogKeys.customizations.admin())?.isInvalidated).toBe(true);
});
it("offers group creation even when the catalogue has no groups", () => {
  client.setQueryData(catalogKeys.customizations.admin(), []);
  expect(render(<AdminCustomizationsPage />)).toContain("Create your first group");
});
it("renders group type/required settings and included option pricing controls", () => {
  const group = render(<CustomizationGroupForm onSaved={() => {}} />);
  expect(group).toContain("Selection type"); expect(group).toContain("Selection required");
  const option = render(<CustomizationOptionForm groupId={1} onSaved={() => {}} />);
  expect(option).toContain("Additional price"); expect(option).toContain("Use zero for an included option"); expect(option).toContain("Available to customers");
});
