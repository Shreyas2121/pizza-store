import { MapPin, Phone } from "lucide-react";
import type { OrderRes } from "../model/order.types";

export const OrderAddress = ({ address }: { address: OrderRes["address"] }) => (
  <section className="rounded-card border border-border bg-surface p-5 shadow-subtle" aria-labelledby="delivery-address-title">
    <div className="flex items-center gap-2">
      <MapPin size={19} className="text-brand" aria-hidden="true" />
      <h2 id="delivery-address-title" className="font-semibold text-ink">Delivery address</h2>
    </div>
    {address ? (
      <address className="mt-3 not-italic text-sm leading-6 text-ink-muted">
        <p className="font-semibold text-ink">{address.type}</p>
        <p>{address.street}</p>
        <p>{address.city}, {address.state} · {address.pincode}</p>
        <p className="mt-2 flex items-center gap-2">
          <Phone size={15} aria-hidden="true" />
          {address.phone}
        </p>
      </address>
    ) : (
      <p className="mt-3 text-sm text-ink-muted">No delivery address is available.</p>
    )}
  </section>
);

export default OrderAddress;
