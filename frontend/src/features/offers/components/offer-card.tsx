import { Link } from "react-router";
import { formatPaise } from "@/shared/lib";
import type { PublicOffer } from "../model/offers.types";
import { offerProductLink } from "../model/offers.helpers";
import { OfferImage } from "./offer-image";
import { describeDiscount, WEEKDAY_LABELS } from "@/features/promotions";

export function OfferCard({ offer }: { offer: PublicOffer }) {
  const summary = offer.eligibilitySummary;
  return <article className="overflow-hidden rounded-card border border-border bg-surface">
    <OfferImage key={`${offer.id}:${offer.display.imageUrl}:${offer.display.mobileImageUrl}`} offer={offer} />
    <div className="p-5">
      <p className="text-sm font-semibold text-brand">Automatic offer</p>
      <h2 className="mt-2 text-section-title-scale">{offer.name}</h2>
      <p className="mt-2 font-semibold text-basil">{describeDiscount(offer.discount)}</p>
      {offer.description && <p className="mt-2 text-ink-muted">{offer.description}</p>}
      <ul className="my-3 space-y-1 text-sm text-ink-muted" aria-label="Offer conditions">
        {summary.minimumOrderPaise > 0 && <li>Item subtotal from {formatPaise(summary.minimumOrderPaise)}</li>}
        {summary.minimumCartQuantity > 0 && <li>At least {summary.minimumCartQuantity} items</li>}
        {summary.firstOrderOnly && <li>First order only</li>}
        <li>Valid until {new Intl.DateTimeFormat("en-IN", { timeZone: summary.timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(summary.endsAt))} ({summary.timezone})</li>
        {summary.activeDaysOfWeek && <li>Days: {summary.activeDaysOfWeek.map((day) => WEEKDAY_LABELS[day]).join(", ")}</li>}
        {summary.activeStartTime && <li>{summary.activeStartTime}–{summary.activeEndTime} in store local time</li>}
        {offer.rules.map((rule, index) => rule.type === "tier" ? <li key={index}>From {formatPaise(rule.minimumSubtotalPaise)}: {describeDiscount(rule.discount)}</li> : rule.type === "buy_x_get_y" ? <li key={index}>Buy {rule.buyQuantity}, get {rule.getQuantity} eligible items free</li> : null)}
      </ul>
      <p className="my-3 text-sm text-ink-muted">Eligible savings appear automatically in your checkout quote. Offers cannot be combined with a coupon.</p>
      <Link to={offerProductLink(offer)} className="secondary-button">View eligible products</Link>
    </div>
  </article>;
}
