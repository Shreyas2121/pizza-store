import { useEffect, useState } from "react";
import { useMediaQuery } from "@mantine/hooks";
import { Link } from "react-router";
import type { PublicOffer } from "../model/offers.types";
import { HOMEPAGE_OFFER_LIMIT, OFFER_ROTATION_MS, REDUCED_MOTION_MEDIA } from "../model/offers.constants";
import { nextSlide, orderOffers } from "../model/offers.helpers";
import { OfferCard } from "./offer-card";
import { OffersRegion } from "./offers-region";

export function OfferSlider({ offers }: { offers: PublicOffer[] }) {
  const slides = orderOffers(offers).slice(0, HOMEPAGE_OFFER_LIMIT);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [hidden, setHidden] = useState(false);
  const reducedMotion = useMediaQuery(REDUCED_MOTION_MEDIA, true);
  const currentIndex = index < slides.length ? index : 0;
  const rotating = playing && !hovered && !hidden && !reducedMotion && slides.length > 1;
  useEffect(() => {
    const pause = () => { setHidden(document.hidden); if (document.hidden) setPlaying(false); };
    document.addEventListener("visibilitychange", pause);
    return () => document.removeEventListener("visibilitychange", pause);
  }, []);
  useEffect(() => {
    if (!rotating) return;
    const timer = window.setInterval(() => setIndex((i) => nextSlide(i, 1, slides.length)), OFFER_ROTATION_MS);
    return () => window.clearInterval(timer);
  }, [rotating, slides.length]);
  const move = (direction: number) => { setPlaying(false); setIndex(nextSlide(currentIndex, direction, slides.length)); };
  if (!slides.length) return null;
  return <div role="region" aria-roledescription="carousel" aria-label="Featured offers" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setPlaying(false)} onKeyDown={(event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); move(event.key === "ArrowLeft" ? -1 : 1); }
  }}>
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <button type="button" className="secondary-button" disabled={slides.length < 2} onClick={() => move(-1)} aria-label="Previous offer">Previous</button>
      <button type="button" className="secondary-button" disabled={slides.length < 2} onClick={() => move(1)} aria-label="Next offer">Next</button>
      {!reducedMotion && slides.length > 1 && <button type="button" className="secondary-button" aria-pressed={playing} onClick={() => setPlaying((p) => !p)}>{playing ? "Pause slideshow" : "Play slideshow"}</button>}
      <p aria-live={rotating ? "off" : "polite"} aria-atomic="true">Offer {currentIndex + 1} of {slides.length}</p>
    </div>
    <div role="group" aria-roledescription="slide" aria-label={`${currentIndex + 1} of ${slides.length}`}><OfferCard offer={slides[currentIndex]} /></div>
  </div>;
}
export default function HomepageOffersSlider() {
  return <section id="offers" className="mx-auto max-w-storefront px-5 py-8 sm:px-8 lg:px-12" aria-labelledby="featured-offers-title">
    <div className="mb-5 flex items-center justify-between gap-3"><h2 id="featured-offers-title" className="text-section-title-scale">Offers for your pizza night</h2><Link className="tertiary-button" to="/offers">View all offers</Link></div>
    <OffersRegion featured>{(offers, storeId) => <OfferSlider key={storeId} offers={offers} />}</OffersRegion>
  </section>;
}
