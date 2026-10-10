import { Link, useParams } from "react-router";
import { OffersRegion } from "../components/offers-region";
import { OfferCard } from "../components/offer-card";
import { useOfferProducts } from "../api/offers.queries";
import { isOfferTarget } from "../model/offers.helpers";
import type { PublicOffer } from "../model/offers.types";
import { ProductCard } from "@/features/catalog";
import { ProductGridSkeleton } from "@/shared/ui";

function OfferProducts({ offer, storeId }: { offer: PublicOffer; storeId: number }) {
  const query = useOfferProducts(storeId, offer.id, true);
  const products = [...new Map((query.data?.pages.flatMap((p) => p.data) ?? []).filter((p) => isOfferTarget(offer, p)).map((p) => [p.id, p])).values()];
  return <div>
    <h2 className="text-section-title-scale">Products for {offer.name}</h2>
    <p className="my-4">Browse the offer’s product and category targets. Checkout confirms eligibility and the best available saving.</p>
    {query.isPending && <ProductGridSkeleton count={6} />}
    {query.isError ? <div role="alert"><p>Products could not be loaded.</p><button className="secondary-button" onClick={() => void (query.isFetchNextPageError ? query.fetchNextPage() : query.refetch())}>Retry products</button></div> : <>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{products.map((p) => <ProductCard key={p.id} product={p} />)}</div>
      {!query.isPending && !products.length && <p>No matching products on the menu pages loaded so far.</p>}
      {query.hasNextPage && <button className="secondary-button mt-5" disabled={query.isFetching} onClick={() => void query.fetchNextPage()}>{query.isFetchingNextPage ? "Loading…" : "Load more menu products"}</button>}
      {!query.isPending && !query.hasNextPage && !products.length && <p>This offer’s products are currently unavailable at this store.</p>}
    </>}
    <Link className="tertiary-button mt-5" to="/offers">Back to offers</Link>
  </div>;
}
export default function OffersPage() {
  const { id } = useParams();
  return <section className="mx-auto max-w-storefront px-5 py-10 sm:px-8 lg:px-12" aria-labelledby="offers-title">
    <h1 id="offers-title" className="text-page-title-scale">Offers</h1><p className="my-4 text-ink-muted">Automatic deals for your selected store. Final savings are confirmed at checkout.</p>
    <OffersRegion>{(offers, storeId) => {
      if (id) { const offer = offers.find((o) => String(o.id) === id); return offer ? <OfferProducts key={`${storeId}:${id}`} offer={offer} storeId={storeId} /> : <p role="status">This offer is no longer available at your store. <Link to="/offers">Browse current offers</Link></p>; }
      return <div className="grid gap-5 sm:grid-cols-2">{offers.map((offer) => <OfferCard key={offer.id} offer={offer} />)}</div>;
    }}</OffersRegion>
  </section>;
}
