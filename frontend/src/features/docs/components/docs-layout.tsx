import { Suspense } from "react";
import { Drawer } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Link, Outlet, useLocation } from "react-router";
import { Menu, ArrowUpRight } from "lucide-react";
import { DocsNav } from "./docs-nav";
import { DocsContentBoundary } from "./docs-content-boundary";
import "../docs.css";

export default function DocsLayout() {
  const [opened, { open, close }] = useDisclosure(false);
  const { pathname } = useLocation();
  return (
    <div className="docs-shell min-h-screen bg-canvas text-ink">
      <a href="#docs-main" className="docs-skip">Skip to documentation</a>
      <header className="docs-header border-b border-border bg-surface">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-5 py-5 lg:px-10">
          <Link to="/docs" className="flex items-center gap-3" aria-label="PizzaStore engineering overview">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-ink font-display text-xl text-surface" aria-hidden="true">P.</span>
            <span><span className="block font-semibold">PizzaStore</span><span className="block text-xs text-ink-muted">Engineering notebook</span></span>
          </Link>
          <Link to="/" className="hidden items-center gap-2 text-sm font-medium lg:flex">Explore the store <ArrowUpRight size={16} aria-hidden="true" /></Link>
          <button type="button" onClick={open} aria-label="Open documentation navigation" aria-expanded={opened} aria-controls="docs-mobile-navigation" className="rounded-control border border-border p-3 lg:hidden"><Menu size={20} aria-hidden="true" /></button>
        </div>
      </header>
      <Drawer opened={opened} onClose={close} title="Engineering notebook" position="left" size="xs" returnFocus closeButtonProps={{ "aria-label": "Close documentation navigation" }}>
        <div id="docs-mobile-navigation" className="docs-shell min-h-[60vh]"><DocsNav onNavigate={close} /></div>
      </Drawer>
      <div className="mx-auto grid max-w-[1440px] lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="docs-sidebar hidden border-r border-border px-8 py-10 lg:block"><div className="sticky top-8"><DocsNav /></div></aside>
        <main id="docs-main" tabIndex={-1} className="min-w-0 px-5 py-10 focus:outline-none sm:px-10 lg:px-16 lg:py-14">
          <div className="mx-auto max-w-[900px]">
            <DocsContentBoundary key={pathname}>
              <Suspense fallback={<div role="status" className="py-16 text-ink-muted">Loading documentation…</div>}><Outlet /></Suspense>
            </DocsContentBoundary>
            <footer className="docs-footer mt-16 flex flex-wrap justify-between gap-3 border-t border-border pt-6 text-xs text-ink-muted"><span>PizzaStore / Engineering notebook</span><span>Decisions, evidence, and room to improve.</span></footer>
          </div>
        </main>
      </div>
    </div>
  );
}
