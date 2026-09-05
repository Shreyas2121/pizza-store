import { useEffect, type ReactNode } from "react";
import { useLocation } from "react-router";
import type { DocsSection as Section } from "../content/navigation";

export function DocsPage({ title, description, children }: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const { hash } = useLocation();
  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${title} | PizzaStore Engineering`;
    const existing = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const meta = existing ?? document.createElement("meta");
    const previousDescription = meta.getAttribute("content");
    meta.name = "description";
    meta.content = description;
    if (!existing) document.head.append(meta);
    return () => {
      document.title = previousTitle;
      if (!existing) meta.remove();
      else if (previousDescription === null) meta.removeAttribute("content");
      else meta.content = previousDescription;
    };
  }, [title, description]);

  useEffect(() => {
    // ScrollManager owns hash scrolling; focus only new pages without a hash.
    if (!hash) document.getElementById("docs-main")?.focus({ preventScroll: true });
  }, [title, hash]);

  return <article>{children}</article>;
}

export function DocsSection({ section, children }: { section: Section; children: ReactNode }) {
  return (
    <section id={section.id} aria-labelledby={`${section.id}-heading`} className="docs-section">
      <h2 id={`${section.id}-heading`} className="mb-5 font-display text-3xl font-normal">{section.title}</h2>
      {children}
    </section>
  );
}
