import type { Product } from "@/features/catalog";
import type { PublicOffer } from "./offers.types";

export const orderOffers = (offers: PublicOffer[]) => [...offers].sort((a, b) => b.display.priority - a.display.priority || a.id - b.id);
export const offerProductLink = (offer: PublicOffer) => `/offers/${offer.id}/products`;
// Targets describe discovery only; the quote decides eligibility and discounts.
export const isOfferTarget = (offer: PublicOffer, product: Product) =>
  (!offer.targets.productIds.length && !offer.targets.categoryIds.length) ||
  offer.targets.productIds.includes(product.id) || offer.targets.categoryIds.includes(product.categoryId);
export const nextSlide = (index: number, direction: number, count: number) => count > 0 ? (index + direction + count) % count : 0;
