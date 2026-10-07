import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { API } from "@/shared/api";
import { offersKeys, offersQueryOptions, useOfferProducts } from "./api/offers.queries";
import { orderOffers, isOfferTarget, nextSlide } from "./model/offers.helpers";
import type { PublicOffer } from "./model/offers.types";
import { OfferCard } from "./components/offer-card";
import { OfferImage } from "./components/offer-image";
import { OffersRegion } from "./components/offers-region";
import { OfferSlider } from "./components/homepage-offers-slider";
import { ProductCard, type Product } from "@/features/catalog";
import { CartItemCard } from "@/features/cart";

const context = vi.hoisted(() => ({ store: { id: 10, name: "Main" }, resolved: true, loading: false, loggedIn: true, reducedMotion: false }));
vi.mock("@/shared/api", async (original) => ({ ...await original<typeof import("@/shared/api")>(), API: { get: vi.fn() } }));
vi.mock("@/features/auth", () => ({ useUser: () => ({ isLoggedIn: context.loggedIn }), Login: () => null }));
vi.mock("@/features/store", () => ({ useStoreStore: (selector: (s: unknown) => unknown) => selector({ resolvedStore: context.store, isStoreResolved: context.resolved, isLoading: context.loading, openPincodeModal: vi.fn() }) }));
vi.mock("@mantine/hooks", async (original) => ({ ...await original<typeof import("@mantine/hooks")>(), useMediaQuery: () => context.reducedMotion }));

const offer = (id = 1, priority = 0): PublicOffer => ({
  id, definitionVersion: 1, kind: "offer", name: `Pizza deal ${id}`, description: "Pizza night savings", discount: { type: "percentage", rateBps: 2000, maxDiscountPaise: 15000 }, scope: "product",
  eligibilitySummary: { minimumOrderPaise: 20000, minimumCartQuantity: 2, firstOrderOnly: true, startsAt: "2026-10-01T00:00:00Z", endsAt: "2026-11-01T00:00:00Z", activeDaysOfWeek: [5], activeStartTime: "22:00", activeEndTime: "02:00", timezone: "Asia/Kolkata" },
  targets: { productIds: [2], categoryIds: [3] }, rules: [], display: { priority, imageUrl: "/uploads/promotions/desktop.webp", mobileImageUrl: "/uploads/promotions/mobile.webp", imageAlt: "Pizza and drinks on a table" },
});
const product = (): Product => ({ id: 2, name: "Pizza + drink combo", description: "Dinner", slug: "combo", veg: true, hasCustomization: false, isAvailable: true, pricePaise: 30000, image: "/combo.webp", categoryId: 3, productType: "bundle", sellingPricePaise: 30000, compareAtPricePaise: 36000, markdownPaise: 6000, components: [{ productId: 4, name: "Pizza", quantityPerBundle: 1, isAvailable: true }, { productId: 5, name: "Drink", quantityPerBundle: 2, isAvailable: true }] });
let client: QueryClient;
const render = (element: ReactElement) => renderToStaticMarkup(<QueryClientProvider client={client}><MantineProvider env="test"><MemoryRouter>{element}</MemoryRouter></MantineProvider></QueryClientProvider>);
beforeEach(() => { vi.clearAllMocks(); client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); context.store = { id: 10, name: "Main" }; context.resolved = true; context.loading = false; context.loggedIn = true; context.reducedMotion = false; });
afterEach(() => client.clear());

describe("public discovery transport", () => {
  it("uses public endpoints, store parameters and deterministic priority", async () => {
    vi.mocked(API.get).mockResolvedValue({ data: { data: [offer(1), offer(2, 5)] } });
    expect((await client.fetchQuery(offersQueryOptions(10))).map((o) => o.id)).toEqual([2, 1]);
    expect(API.get).toHaveBeenCalledWith("/promotions/offers", { params: { storeId: 10 }, signal: expect.any(AbortSignal) });
    await client.fetchQuery(offersQueryOptions(20, true));
    expect(API.get).toHaveBeenLastCalledWith("/promotions/featured", { params: { storeId: 20 }, signal: expect.any(AbortSignal) });
    expect(client.getQueryData(offersKeys.list(20))).toBeUndefined();
    expect(offersQueryOptions(undefined).enabled).toBe(false);
  });
  it("aborts obsolete store requests", async () => {
    let signal: AbortSignal | undefined;
    vi.mocked(API.get).mockImplementation((_url, config) => { signal = config?.signal instanceof AbortSignal ? config.signal : undefined; return new Promise(() => {}); });
    const pending = client.fetchQuery(offersQueryOptions(10)).catch(() => undefined);
    await client.cancelQueries({ queryKey: offersKeys.list(10) });
    expect(signal?.aborted).toBe(true); await pending;
  });
  it("loads catalogue pages on demand with authoritative store pricing", async () => {
    let result: ReturnType<typeof useOfferProducts> | undefined;
    const Harness = () => { result = useOfferProducts(10, 1, true); return null; };
    render(createElement(Harness));
    vi.mocked(API.get).mockResolvedValueOnce({ data: { data: [product()], meta: { page: 1, hasNextPage: true } } }).mockResolvedValueOnce({ data: { data: [], meta: { page: 2, hasNextPage: false } } });
    if (!result) throw new Error("Hook did not render");
    await result.refetch(); await result.fetchNextPage();
    expect(API.get).toHaveBeenLastCalledWith("/product/menu", { params: { storeId: 10, page: 2, sortBy: "default" }, signal: expect.any(AbortSignal) });
    expect(client.getQueryData(offersKeys.products(20, 1))).toBeUndefined();
  });
});

describe("customer discovery presentation", () => {
  it("orders ties by ID without changing source data", () => { const source = [offer(3), offer(2, 4), offer(1)]; expect(orderOffers(source).map((o) => o.id)).toEqual([2, 1, 3]); expect(source[0].id).toBe(3); });
  it("matches product/category targets and unrestricted cart offers", () => { expect(isOfferTarget(offer(), product())).toBe(true); expect(isOfferTarget(offer(), { ...product(), id: 9, categoryId: 9 })).toBe(false); expect(isOfferTarget({ ...offer(), targets: { productIds: [], categoryIds: [] } }, product())).toBe(true); });
  it("wraps slider navigation in either direction", () => { expect(nextSlide(0, -1, 3)).toBe(2); expect(nextSlide(2, 1, 3)).toBe(0); expect(nextSlide(0, 1, 0)).toBe(0); });
  it("shows informational conditions and product links without apply controls", () => { const html = render(<OfferCard offer={offer()} />); expect(html).toContain('href="/offers/1/products"'); expect(html).toContain("20% off"); expect(html).toContain("First order only"); expect(html).toContain("Asia/Kolkata"); expect(html).toContain("22:00"); expect(html).not.toContain("<button"); });
  it("renders responsive media and meaningful alt text", () => { const html = render(<OfferImage offer={offer()} />); expect(html).toContain('media="(max-width: 639px)"'); expect(html).toContain("mobile.webp"); expect(html).toContain('alt="Pizza and drinks on a table"'); });
  it("uses readable fallback content for absent artwork", () => { const html = render(<OfferImage offer={{ ...offer(), display: { ...offer().display, imageUrl: null } }} />); expect(html).toContain("offer artwork unavailable"); expect(html).not.toContain("<img"); });
  it("starts paused, bounds slides and renders only the current slide", () => { const html = render(<OfferSlider offers={Array.from({ length: 7 }, (_, i) => offer(i + 1, i))} />); expect(html).toContain('aria-roledescription="carousel"'); expect(html).toContain('aria-label="Previous offer"'); expect(html).toContain('aria-label="Next offer"'); expect(html).toContain("Play slideshow"); expect(html).toContain("Offer 1 of 5"); expect(html).toContain("Pizza deal 7"); expect(html).not.toContain("Pizza deal 6"); });
  it("removes autoplay for reduced motion and disables single-slide navigation", () => { context.reducedMotion = true; const html = render(<OfferSlider offers={[offer()]} />); expect(html).not.toContain("Play slideshow"); expect(html).toMatch(/disabled=""[^>]*aria-label="Next offer"/); });
  it("keeps multi-slide navigation available with reduced motion", () => { context.reducedMotion = true; const html = render(<OfferSlider offers={[offer(), offer(2)]} />); expect(html).not.toContain("Play slideshow"); expect(html).toContain('aria-label="Next offer"'); expect(html).not.toContain('disabled=""'); });
  it("requires store resolution before discovery", () => { context.resolved = false; const html = render(<OffersRegion>{() => <p>Offers</p>}</OffersRegion>); expect(html).toContain("Enter delivery pincode"); expect(API.get).not.toHaveBeenCalled(); });
  it("shows loading while changing the delivery area", () => { context.loading = true; expect(render(<OffersRegion>{() => <p>Offers</p>}</OffersRegion>)).toContain("Loading offers"); });
  it("shows empty and error states without displaying stale cards", async () => {
    client.setQueryData(offersKeys.list(10), []);
    expect(render(<OffersRegion>{() => <p>Unexpected card</p>}</OffersRegion>)).toContain("No offers");
    vi.mocked(API.get).mockRejectedValue(new Error("offline"));
    await client.fetchQuery(offersQueryOptions(10)).catch(() => undefined);
    const html = render(<OffersRegion>{() => <p>Unexpected card</p>}</OffersRegion>); expect(html).toContain("Retry offers"); expect(html).not.toContain("Unexpected card");
  });
  it("never renders another store’s cached offers", () => { client.setQueryData(offersKeys.list(10), [offer()]); context.store = { id: 20, name: "Other" }; expect(render(<OffersRegion>{(offers) => <p>{offers[0].name}</p>}</OffersRegion>)).not.toContain("Pizza deal 1"); });
});

describe("bundle merchandising", () => {
  it("shows compare-at, selling price, supplied savings and one Add Combo action", () => { const html = render(<ProductCard product={product()} />); expect(html).toContain("<s>"); expect(html).toContain("360.00"); expect(html).toContain("300.00"); expect(html).toContain("Save"); expect(html).toContain("60.00"); expect(html).toContain("2 × Drink"); expect(html.match(/Add Combo/g)).toHaveLength(1); expect(html).not.toContain("From"); });
  it("disables unavailable bundles", () => { const html = render(<ProductCard product={{ ...product(), isAvailable: false }} />); expect(html).toContain("Sold out"); expect(html).toContain('disabled=""'); });
  it("renders one cart line with expandable per-combo contents and aggregate markdown", () => { const p = product(); const html = render(<CartItemCard item={{ id: 1, cartId: 1, createdAt: "", updatedAt: "", pricePaise: 30000, productId: 2, quantity: 2, product: p, customizations: [], compareAtUnitPricePaise: 36000, bundleMarkdownPaise: 12000, bundleComponents: (p.components ?? []).map((c) => ({ ...c, totalQuantity: c.quantityPerBundle * 2 })) }} onQuantityChange={() => {}} onRemove={() => {}} />); expect(html).toContain("<details"); expect(html).toContain("Combo contents (per combo)"); expect(html).toContain("120.00"); expect(html).toContain("2 × Drink"); expect(html.match(/<article/g)).toHaveLength(1); });
});
