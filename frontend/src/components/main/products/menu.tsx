import { Skeleton } from "@mantine/core";
import { Pizza, RotateCcw } from "lucide-react";
import { BASE_URL } from "../../../lib/constants";
import { useSearchParams } from "react-router";
import Products from "./products";
import { MENU_API_HOOKS } from "@/hooks";

const Menu = () => {
  const { data: menu, isLoading, error, refetch } = MENU_API_HOOKS.useGetMenuItems();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedSlug = searchParams.get("menu");
  const activeItem = menu?.find((item) => item.slug === selectedSlug);

  const selectCategory = (slug?: string) => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      if (slug) next.set("menu", slug);
      else next.delete("menu");
      next.delete("page");
      return next;
    });
  };

  if (isLoading) {
    return (
      <section id="menu" className="mx-auto max-w-storefront scroll-mt-28 px-5 py-12 sm:px-8 lg:px-12 lg:py-16">
        <Skeleton height={34} width={220} mb={10} />
        <Skeleton height={20} width={340} mb={28} />
        <div className="flex gap-3 overflow-hidden">{[...Array(6)].map((_, index) => <Skeleton key={index} height={52} width={132} radius="xl" className="shrink-0" />)}</div>
        <div className="mt-8 grid grid-cols-1 gap-5 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">{[...Array(8)].map((_, index) => <Skeleton key={index} height={330} radius="lg" />)}</div>
      </section>
    );
  }

  if (error) {
    return (
      <section id="menu" className="mx-auto max-w-storefront scroll-mt-28 px-5 py-12 sm:px-8 lg:px-12">
        <div className="empty-state">
          <Pizza size={38} className="mb-3 text-brand" aria-hidden="true" />
          <h2 className="text-section-title-scale">We couldn’t load the menu</h2>
          <p className="mt-2 max-w-md text-supporting-scale">Please check your connection and try again.</p>
          <button type="button" onClick={() => refetch()} className="secondary-button mt-5 gap-2"><RotateCcw size={17} /> Try again</button>
        </div>
      </section>
    );
  }

  return (
    <section id="menu" className="scroll-mt-28 py-12 lg:py-16" aria-labelledby="menu-title">
      <div className="mx-auto max-w-storefront px-5 sm:px-8 lg:px-12">
        <div className="max-w-2xl">
          <p className="mb-2 text-sm font-bold uppercase tracking-[0.16em] text-brand">Pick your favorite</p>
          <h2 id="menu-title" className="font-display text-4xl tracking-tight text-ink sm:text-5xl">Explore our menu</h2>
          <p className="mt-3 text-ink-muted">Start with everything, or jump straight to the craving that brought you here.</p>
        </div>
      </div>

      <div className="sticky top-[104px] z-30 mt-7 border-y border-border bg-canvas/95 py-3 backdrop-blur-md md:static md:border-0 md:bg-transparent md:py-0 md:backdrop-blur-none">
        <div className="mx-auto flex max-w-storefront gap-2.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:px-8 lg:px-12 [&::-webkit-scrollbar]:hidden" role="group" aria-label="Menu categories">
          <button
            type="button"
            onClick={() => selectCategory()}
            aria-pressed={!selectedSlug}
            className={`inline-flex min-h-12 shrink-0 items-center gap-2 rounded-pill border px-4 text-sm font-semibold transition-colors ${!selectedSlug ? "border-brand bg-brand text-white shadow-subtle" : "border-border bg-surface text-ink hover:border-brand hover:bg-brand-soft"}`}
          >
            <span className={`grid h-7 w-7 place-items-center rounded-full ${!selectedSlug ? "bg-white/15" : "bg-brand-soft text-brand"}`}><Pizza size={16} aria-hidden="true" /></span>
            All
          </button>
          {menu?.map((item) => {
            const active = selectedSlug === item.slug;
            return (
              <button
                type="button"
                key={item.id}
                onClick={() => selectCategory(item.slug)}
                aria-pressed={active}
                className={`inline-flex min-h-12 shrink-0 items-center gap-2 rounded-pill border py-1.5 pl-1.5 pr-4 text-sm font-semibold transition-colors ${active ? "border-brand bg-brand text-white shadow-subtle" : "border-border bg-surface text-ink hover:border-brand hover:bg-brand-soft"}`}
              >
                <img src={`${BASE_URL}${item.image}`} alt="" loading="lazy" className="h-9 w-9 rounded-full object-cover" />
                {item.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mx-auto max-w-storefront px-5 sm:px-8 lg:px-12">
        <Products activeCategoryName={activeItem?.name} />
      </div>
    </section>
  );
};

export default Menu;
