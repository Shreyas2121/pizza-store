import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { API } from "@/shared/api";
import { CheckoutPricingSetup } from "./components/admin/checkout-pricing-setup";
import { storeKeys, useCheckoutPricing, useInitializeCheckoutPricing, type CheckoutPricingStatus } from "./api/store.queries";

vi.spyOn(API, "get");
vi.spyOn(API, "post");
let client: QueryClient;
beforeEach(() => {
  vi.resetAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false, staleTime: Infinity } } });
});
afterEach(() => client.clear());
const missing: CheckoutPricingStatus = { businessDate: "2026-10-10", timezone: "Asia/Kolkata", ready: false,
  defaults: { deliveryFeePaise: 4000, freeDeliveryThresholdPaise: 50000, itemTaxRateBps: 500, deliveryTaxRateBps: 500 },
  deliveryRules: [], itemTaxRules: [], deliveryTaxRules: [],
};
const tax = { id: 1, version: 1, rateBps: 500, effectiveFrom: "2026-10-10", effectiveTo: null };
const ready: CheckoutPricingStatus = { ...missing, ready: true,
  deliveryRules: [{ id: 1, version: 1, deliveryFeePaise: 2500, freeDeliveryThresholdPaise: null, effectiveFrom: "2026-10-10", effectiveTo: null }],
  itemTaxRules: [tax], deliveryTaxRules: [{ ...tax, id: 2 }],
};
const render = (element: ReactElement) => renderToStaticMarkup(<QueryClientProvider client={client}><MantineProvider env="test">{element}</MantineProvider></QueryClientProvider>);
function capture<T>(hook: () => T): T {
  let result: T | undefined;
  function Harness() { result = hook(); return null; }
  render(createElement(Harness));
  if (!result) throw new Error("Hook did not render");
  return result;
}
const page = () => render(<CheckoutPricingSetup storeId={17} />);

it("loads pricing from the store-specific admin endpoint with request cancellation", async () => {
  vi.mocked(API.get).mockResolvedValue({ data: { data: missing } });
  expect((await capture(() => useCheckoutPricing(17)).refetch()).data).toEqual(missing);
  expect(API.get).toHaveBeenCalledWith("/stores/17/checkout-pricing", { signal: expect.any(AbortSignal) });
});
it("shows all three missing components, date and explicit initialization action", () => {
  client.setQueryData(storeKeys.checkoutPricing(17), missing);
  const html = page();
  expect(html).toContain("2026-10-10"); expect(html).toContain("Asia/Kolkata");
  expect(html).toContain("Delivery pricing"); expect(html).toContain("Item demo tax"); expect(html).toContain("Delivery demo tax");
  expect(html).toContain("Initialize missing demo rules"); expect(html).toContain("Existing applicable rules will be preserved");
});
it("shows existing values and readiness without offering initialization", () => {
  client.setQueryData(storeKeys.checkoutPricing(17), ready);
  const html = page();
  expect(html).toContain("Checkout pricing ready"); expect(html).toContain("25.00"); expect(html).toContain("no free delivery threshold");
  expect(html).not.toContain("Initialize missing demo rules");
});
it("disables initialization and explains overlapping rules", () => {
  client.setQueryData(storeKeys.checkoutPricing(17), { ...ready, ready: false, itemTaxRules: [tax, { ...tax, id: 3 }] });
  const html = page();
  expect(html).toContain("Overlapping rules need to be resolved"); expect(html).toContain("disabled");
});
it("updates readiness only for the selected store after initialization", async () => {
  client.setQueryData(storeKeys.checkoutPricing(18), missing);
  vi.mocked(API.post).mockResolvedValue({ data: { data: ready } });
  await capture(() => useInitializeCheckoutPricing(17)).mutateAsync();
  expect(API.post).toHaveBeenCalledWith("/stores/17/checkout-pricing/initialize");
  expect(client.getQueryData(storeKeys.checkoutPricing(17))).toEqual(ready);
  expect(client.getQueryData(storeKeys.checkoutPricing(18))).toEqual(missing);
});
it("shows loading then provides retry on a failed read", async () => {
  expect(page()).toContain("Loading checkout pricing");
  vi.mocked(API.get).mockRejectedValue(new Error("Unavailable"));
  await capture(() => useCheckoutPricing(17)).refetch();
  expect(page()).toContain("Checkout pricing unavailable"); expect(page()).toContain("Retry");
});
