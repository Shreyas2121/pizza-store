import { useState } from "react";
import { imageUrl } from "@/shared/config";
import { OFFER_MOBILE_MEDIA } from "../model/offers.constants";
import type { PublicOffer } from "../model/offers.types";

export function OfferImage({ offer }: { offer: PublicOffer }) {
  const [failed, setFailed] = useState(false);
  if (!offer.display.imageUrl || failed) return <div className="flex aspect-[2/1] items-center justify-center bg-brand-soft p-6 font-display text-2xl text-brand" role="img" aria-label={`${offer.name} — offer artwork unavailable`}>{offer.name}</div>;
  return <picture>
    {offer.display.mobileImageUrl && <source media={OFFER_MOBILE_MEDIA} srcSet={imageUrl(offer.display.mobileImageUrl)} />}
    <img className="aspect-square w-full object-contain sm:aspect-[3/1]" src={imageUrl(offer.display.imageUrl)} alt={offer.display.imageAlt || offer.name} onError={() => setFailed(true)} />
  </picture>;
}
