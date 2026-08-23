import { Link } from "react-router";
import { Clock3, Mail, MapPin, Phone } from "lucide-react";
import BrandLockup from "./brand-lockup";
import { useStoreStore } from "@/features/store";
import { formatStoreHours } from "@/shared/lib";

export function StorefrontFooter() {
  const store = useStoreStore((state) => state.resolvedStore);
  return (
    <footer className="mt-16 bg-ink text-surface-muted">
      <div className="mx-auto grid max-w-storefront gap-10 px-5 py-12 sm:grid-cols-2 sm:px-8 lg:grid-cols-[1.35fr_0.8fr_0.9fr_1.1fr] lg:px-12 lg:py-16">
        <section aria-labelledby="footer-brand">
          <h2 id="footer-brand" className="sr-only">About PizzaStore</h2>
          <BrandLockup inverse />
          <p className="mt-5 max-w-sm text-sm leading-6 text-surface-muted/75">
            Neighborhood pizza, made fresh and delivered with care. Good dough,
            generous toppings, no fuss.
          </p>
        </section>

        <section aria-labelledby="footer-ordering">
          <h2 id="footer-ordering" className="text-sm font-bold uppercase tracking-[0.14em] text-white">Ordering</h2>
          <ul className="mt-4 space-y-3 text-sm text-surface-muted/75">
            <li><Link to="/#menu" className="hover:text-white">Browse menu</Link></li>
            <li><Link to="/cart" className="hover:text-white">Your cart</Link></li>
            <li><Link to="/orders" className="hover:text-white">Track an order</Link></li>
          </ul>
        </section>

        <section aria-labelledby="footer-help">
          <h2 id="footer-help" className="text-sm font-bold uppercase tracking-[0.14em] text-white">Good to know</h2>
          <ul className="mt-4 space-y-3 text-sm text-surface-muted/75">
            <li>Cash on delivery</li>
            <li>Freshly made to order</li>
            <li><a href="mailto:support@pizzastore.com" className="hover:text-white">Order support</a></li>
          </ul>
        </section>

        <section aria-labelledby="footer-contact">
          <h2 id="footer-contact" className="text-sm font-bold uppercase tracking-[0.14em] text-white">Contact & hours</h2>
          <ul className="mt-4 space-y-3 text-sm text-surface-muted/75">
            <li className="flex gap-2.5"><Clock3 className="mt-0.5 shrink-0" size={17} aria-hidden="true" /><span>{store ? <>Open daily<br />{formatStoreHours(store.opensAt, store.closesAt)} IST</> : "Select a delivery area to view store hours"}</span></li>
            <li><a href="tel:+919876543210" className="flex gap-2.5 hover:text-white"><Phone className="shrink-0" size={17} aria-hidden="true" />+91 98765 43210</a></li>
            <li><a href="mailto:support@pizzastore.com" className="flex gap-2.5 hover:text-white"><Mail className="mt-0.5 shrink-0" size={17} aria-hidden="true" /><span className="break-all">support@pizzastore.com</span></a></li>
            <li className="flex gap-2.5"><MapPin className="mt-0.5 shrink-0" size={17} aria-hidden="true" /><span>Serving your neighborhood</span></li>
          </ul>
        </section>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-storefront flex-col gap-2 px-5 py-5 text-xs text-surface-muted/60 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
          <p>© {new Date().getFullYear()} PizzaStore. All rights reserved.</p>
          <p>Made fresh. Delivered warm.</p>
        </div>
      </div>
    </footer>
  );
}

export default StorefrontFooter;
