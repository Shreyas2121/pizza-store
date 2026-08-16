import { ArrowRight, Banknote, Check, Clock3, Flame, Wheat } from "lucide-react";
import { Link } from "react-router";
import MenuCategoryRail from "../components/customer/menu-category-rail";

const trustPoints = ["Hand-stretched dough", "Made fresh to order", "Cash on delivery"];

export const HomePage = () => (
  <>
    <section className="relative isolate min-h-[440px] overflow-hidden bg-ink lg:min-h-[470px]" aria-labelledby="hero-title">
      <img
        src="/pizzastore-hero.png"
        alt="Fresh wood-fired margherita pizza with basil"
        className="absolute inset-0 -z-20 h-full w-full object-cover object-[64%_center] sm:object-center"
        fetchPriority="high"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ink via-ink/85 to-ink/5 sm:via-ink/65" />
      <div className="mx-auto flex min-h-[440px] max-w-storefront items-center px-5 py-12 sm:px-8 lg:min-h-[470px] lg:px-12">
        <div className="max-w-xl text-white">
          <p className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-[#F2C36E]">Wood-fired warmth, delivered</p>
          <h1 id="hero-title" className="max-w-lg font-display text-[2.6rem] leading-[1.04] tracking-tight sm:text-5xl lg:text-[3.5rem]">
            Your neighborhood pizza night starts here.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-white/80 sm:text-lg">
            Handcrafted pizzas with blistered crusts, generous toppings, and the comfort of ordering from your sofa.
          </p>

          <div className="mt-7 flex flex-col gap-3 min-[420px]:flex-row">
            <Link to="/#menu" className="primary-button min-h-12 gap-2 px-6 text-base">
              Order now <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link to="/#menu" className="inline-flex min-h-12 items-center justify-center rounded-control border border-white/40 bg-white/10 px-6 font-semibold text-white backdrop-blur-sm transition-colors hover:border-white/70 hover:bg-white/15 hover:text-white">
              View menu
            </Link>
          </div>

          <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/80" aria-label="Ordering benefits">
            {trustPoints.map((point) => (
              <li key={point} className="flex items-center gap-1.5"><Check className="text-[#F2C36E]" size={16} strokeWidth={2.5} aria-hidden="true" />{point}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>

    <section id="offers" className="border-b border-border bg-surface" aria-label="Why order from PizzaStore">
      <div className="mx-auto grid max-w-storefront divide-y divide-border px-5 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-8 lg:px-12">
        <div className="flex items-center gap-3 py-5 sm:px-5 sm:first:pl-0">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand"><Wheat size={20} aria-hidden="true" /></span>
          <div><p className="font-semibold text-ink">Fresh dough daily</p><p className="text-sm text-ink-muted">Mixed for a light, crisp crust</p></div>
        </div>
        <div className="flex items-center gap-3 py-5 sm:px-5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-basil-soft text-basil"><Flame size={20} aria-hidden="true" /></span>
          <div><p className="font-semibold text-ink">Made to order</p><p className="text-sm text-ink-muted">Hot from our oven to your door</p></div>
        </div>
        <div className="flex items-center gap-3 py-5 sm:px-5 sm:last:pr-0">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-800"><Banknote size={20} aria-hidden="true" /></span>
          <div><p className="font-semibold text-ink">Easy payment</p><p className="text-sm text-ink-muted">Cash on delivery available</p></div>
        </div>
      </div>
    </section>

    <MenuCategoryRail />

    <section className="mx-auto max-w-storefront px-5 pb-4 pt-6 sm:px-8 lg:px-12" aria-label="Delivery reassurance">
      <div className="flex items-center justify-center gap-2 rounded-card border border-border bg-surface-muted px-5 py-4 text-center text-sm font-medium text-ink-muted">
        <Clock3 size={18} className="text-brand" aria-hidden="true" /> Made fresh after you order—never left waiting under a heat lamp.
      </div>
    </section>
  </>
);

export default HomePage;
