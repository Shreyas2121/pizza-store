import { Menu } from "@/components/main";
import { Button, Card, Badge } from "@mantine/core";
import {
  ArrowRight,
  Flame,
  ShieldCheck,
  Sparkles,
  Truck,
  Utensils,
} from "lucide-react";

const Home = () => {
  return (
    <div className="space-y-12 sm:space-y-16 pb-12">
      {/* 1. High-Impact Hero Banner */}
      <section className="relative overflow-hidden bg-gradient-to-b from-canvas via-surface to-canvas border-b border-border/60 py-12 sm:py-20">
        <div className="max-w-storefront mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Hero Left Content */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-pill bg-brand-soft border border-brand/20 text-brand text-xs font-bold uppercase tracking-wider">
                <Sparkles size={14} />
                <span>Wood-Fired & Handcrafted Daily</span>
              </div>
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-ink font-serif tracking-tight leading-[1.15]">
                Artisanal Pizza, Baked to{" "}
                <span className="text-brand">Perfection</span>
              </h1>
              <p className="text-base sm:text-lg text-ink-muted max-w-2xl mx-auto lg:mx-0 leading-relaxed font-sans">
                Hand-stretched dough fermented for 48 hours, vine-ripened tomato
                sauce, and creamy 100% real mozzarella cheese. Delivered piping
                hot to your doorstep.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
                <Button
                  component="a"
                  href="#menu"
                  size="lg"
                  color="brand"
                  rightSection={<ArrowRight size={18} />}
                  className="w-full sm:w-auto shadow-subtle hover:shadow-subtle-hover transition-all"
                >
                  Browse Menu
                </Button>
                <Button
                  component="a"
                  href="#promotions"
                  size="lg"
                  variant="outline"
                  color="dark"
                  className="w-full sm:w-auto"
                >
                  View Special Deals
                </Button>
              </div>

              {/* Value Micro-Pills */}
              <div className="pt-6 flex flex-wrap justify-center lg:justify-start gap-4 text-xs font-semibold text-ink-muted border-t border-border/60">
                <span className="flex items-center gap-1.5">
                  <Truck size={16} className="text-brand" /> 30-Min Fast
                  Delivery
                </span>
                <span className="flex items-center gap-1.5">
                  <Flame size={16} className="text-brand" /> Fresh Wood-Fired
                  Oven
                </span>
                <span className="flex items-center gap-1.5">
                  <ShieldCheck size={16} className="text-basil" /> Cash on
                  Delivery
                </span>
              </div>
            </div>

            {/* Hero Right Visual */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="relative w-full max-w-md aspect-square rounded-panel overflow-hidden border border-border shadow-panel group">
                <img
                  src="https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80"
                  alt="Delicious artisanal wood-fired pepperoni pizza"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-transparent flex items-end p-6">
                  <div className="text-surface space-y-1">
                    <Badge color="brand" variant="filled" size="sm">
                      BESTSELLER
                    </Badge>
                    <h3 className="text-lg font-bold font-sans">
                      Classic Signature Pepperoni
                    </h3>
                    <p className="text-xs text-surface/80">
                      Double pepperoni & smoked mozzarella
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Value Proposition Section: Why PizzaStore */}
      <section className="max-w-storefront mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-2 mb-8 sm:mb-12">
          <span className="text-xs font-bold text-brand uppercase tracking-wider">
            The PizzaStore Difference
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-ink font-serif">
            Why Food Lovers Choose Us
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card
            shadow="subtle"
            padding="lg"
            className="border border-border bg-surface rounded-card hover:border-brand/40 transition-colors space-y-3"
          >
            <div className="w-12 h-12 rounded-control bg-brand-soft text-brand flex items-center justify-center">
              <Utensils size={24} />
            </div>
            <h3 className="text-lg font-bold text-ink font-sans">
              Hand-Stretched Dough
            </h3>
            <p className="text-sm text-ink-muted leading-relaxed">
              Made fresh every morning using Italian Tipo 00 flour and aged 48
              hours for ideal crust texture.
            </p>
          </Card>

          <Card
            shadow="subtle"
            padding="lg"
            className="border border-border bg-surface rounded-card hover:border-brand/40 transition-colors space-y-3"
          >
            <div className="w-12 h-12 rounded-control bg-basil/10 text-basil flex items-center justify-center">
              <Sparkles size={24} />
            </div>
            <h3 className="text-lg font-bold text-ink font-sans">
              100% Real Mozzarella
            </h3>
            <p className="text-sm text-ink-muted leading-relaxed">
              No artificial blends or processed cheese—only rich, creamy
              mozzarella melted to golden perfection.
            </p>
          </Card>

          <Card
            shadow="subtle"
            padding="lg"
            className="border border-border bg-surface rounded-card hover:border-brand/40 transition-colors space-y-3"
          >
            <div className="w-12 h-12 rounded-control bg-brand-soft text-brand flex items-center justify-center">
              <Truck size={24} />
            </div>
            <h3 className="text-lg font-bold text-ink font-sans">
              Piping Hot Delivery
            </h3>
            <p className="text-sm text-ink-muted leading-relaxed">
              Dispatched in thermal insulated bags to ensure your pizza arrives
              hot, crisp, and ready to enjoy.
            </p>
          </Card>

          <Card
            shadow="subtle"
            padding="lg"
            className="border border-border bg-surface rounded-card hover:border-brand/40 transition-colors space-y-3"
          >
            <div className="w-12 h-12 rounded-control bg-gold/10 text-gold flex items-center justify-center">
              <ShieldCheck size={24} />
            </div>
            <h3 className="text-lg font-bold text-ink font-sans">
              Cash on Delivery
            </h3>
            <p className="text-sm text-ink-muted leading-relaxed">
              Simple, hassle-free ordering with zero advance payment needed. Pay
              when your fresh food arrives.
            </p>
          </Card>
        </div>
      </section>

      {/* 3. Promotional Offer Banner */}
      <section
        id="promotions"
        className="max-w-storefront mx-auto px-4 sm:px-6 lg:px-8"
      >
        <div className="bg-ink text-surface rounded-panel p-8 sm:p-12 shadow-panel relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-3 max-w-xl text-center md:text-left">
            <span className="px-3 py-1 rounded-pill bg-brand text-white text-xs font-bold uppercase tracking-wider">
              LIMITED TIME OFFER
            </span>
            <h2 className="text-2xl sm:text-4xl font-bold font-serif leading-tight">
              Get 20% Off Your First Wood-Fired Pizza Order
            </h2>
            <p className="text-sm sm:text-base text-surface-muted/80">
              Use promo code{" "}
              <span className="font-mono font-bold text-gold bg-white/10 px-2 py-0.5 rounded">
                PIZZA20
              </span>{" "}
              at checkout to claim your welcome discount.
            </p>
          </div>

          <Button
            component="a"
            href="#menu"
            size="lg"
            color="brand"
            rightSection={<ArrowRight size={18} />}
            className="shrink-0 shadow-subtle hover:shadow-subtle-hover transition-all"
          >
            Order Now & Save
          </Button>
        </div>
      </section>

      {/* 4. Menu & Category Section */}
      <section
        id="menu"
        className="max-w-storefront mx-auto px-4 sm:px-6 lg:px-8 pt-4"
      >
        <Menu />
      </section>
    </div>
  );
};

export default Home;
