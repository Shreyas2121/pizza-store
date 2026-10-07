import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { OrderItems } from "./order-items";
import { OrderPromotions } from "./order-promotions";
import type { OrderItemRes, OrderPromotion } from "../model/order.types";

const item = (): OrderItemRes => ({
  id: 41, createdAt: "2026-10-07", updatedAt: "2026-10-07", orderId: 9, productId: 2,
  quantity: 1, price: 200, unitPricePaise: 20_000, productName: "Saved pizza combo",
  productType: "bundle", compareAtUnitPricePaise: 25_000, bundleMarkdownPaise: 5_000,
  bundleComponents: [{ componentProductId: 3, name: "Saved drink", quantityPerBundle: 2, totalQuantity: 2 }],
  lineSubtotalPaise: 20_000, discountAllocationPaise: 1_000, lineTotalPaise: 19_000,
  taxableAmountPaise: 18_095, taxPaise: 905,
  product: { id: 2, name: "Changed current product name", image: null },
  options: [{ id: 1, name: "Saved cheese", pricePaise: 100, price: 1 }],
});
const promotion = (): OrderPromotion => ({
  id: 7, applicationId: 6, kind: "offer", name: "Saved pizza offer", code: null,
  discountType: "fixed_amount", definitionVersion: 1, status: "reserved",
  itemDiscountPaise: 1_000, deliveryDiscountPaise: 0, totalSavingsPaise: 1_000,
  standardDeliveryFeePaise: 5_000, chargedDeliveryFeePaise: 5_000,
  allocations: [{ orderItemId: 41, component: "item", unitIndex: 0, amountPaise: 1_000 }],
});
const render = (element: ReactElement) => renderToStaticMarkup(element);
it("uses saved product/customization/component names and post-discount line totals", () => {
  const html = render(<OrderItems items={[item()]} />);
  expect(html).toContain("Saved pizza combo"); expect(html).toContain("Saved cheese"); expect(html).toContain("Saved drink");
  expect(html).not.toContain("Changed current product name"); expect(html).toContain("Line total after discount"); expect(html).toContain("190.00");
  expect(html).toContain("<details"); expect(html).toContain("250.00"); expect(html).toContain('id="order-line-41"');
});
it("links saved offer allocations to immutable item lines and distinguishes reserved savings", () => {
  const html = render(<OrderPromotions promotions={[promotion()]} items={[item()]} />);
  expect(html).toContain("Saved pizza offer"); expect(html).toContain("Automatic offer"); expect(html).toContain("reserved");
  expect(html).toContain("captured"); expect(html).toContain('href="#order-line-41"'); expect(html).toContain("unit 1");
});
it("explains delivery allocations and released coupon snapshots", () => {
  const p = promotion(); p.kind = "coupon"; p.code = "SAVE10"; p.status = "released";
  p.discountType = "free_delivery"; p.itemDiscountPaise = 0; p.deliveryDiscountPaise = 5_000; p.totalSavingsPaise = 5_000; p.chargedDeliveryFeePaise = 0;
  p.allocations = [{ orderItemId: null, component: "delivery", unitIndex: null, amountPaise: 5_000 }];
  const html = render(<OrderPromotions promotions={[p]} />);
  expect(html).toContain("Manual coupon"); expect(html).toContain("SAVE10"); expect(html).toContain("released"); expect(html).toContain("Delivery");
});
it("does not invent a promotion when only bundle markdown exists", () => {
  expect(render(<OrderPromotions promotions={[]} items={[item()]} />)).toBe("");
});
