import type { ReactNode } from "react";
import { Link } from "react-router";
import { useStoreStore } from "@/features/store";
import { useAvailableOffers } from "../api/offers.queries";
import type { PublicOffer } from "../model/offers.types";
import { CardGridSkeleton } from "@/shared/ui";

export function OffersRegion({ featured = false, children }: { featured?: boolean; children: (offers: PublicOffer[], storeId: number) => ReactNode }) {
  const store = useStoreStore((s) => s.resolvedStore);
  const resolved = useStoreStore((s) => s.isStoreResolved);
  const loading = useStoreStore((s) => s.isLoading);
  const choose = useStoreStore((s) => s.openPincodeModal);
  const storeId = resolved && !loading ? store?.id : undefined;
  const query = useAvailableOffers(storeId, featured);
  if (loading || (storeId !== undefined && query.isPending)) return <CardGridSkeleton count={2} height={220} className="grid gap-5 sm:grid-cols-2" label="Loading offers" />;
  if (storeId === undefined) return <div className="py-8"><p>Choose your delivery area to discover offers for your store.</p><button className="primary-button mt-3" onClick={choose}>Enter delivery pincode</button></div>;
  if (query.isError) return <div role="alert" className="py-8"><p>Offers could not be refreshed. Please try again.</p><button className="secondary-button mt-3" onClick={() => void query.refetch()}>Retry offers</button></div>;
  const refresh = <button type="button" className="tertiary-button mb-3" disabled={query.isFetching} onClick={() => void query.refetch()}>Refresh offers</button>;
  if (!query.data?.length) return <div className="py-8"><p>No {featured ? "featured " : ""}offers at this store right now. <Link to="/#menu">Explore the menu</Link> for your next pizza night.</p>{refresh}</div>;
  return <div aria-busy={query.isFetching}>{refresh}{query.isFetching && <p role="status">Refreshing offers…</p>}{children(query.data, storeId)}</div>;
}
