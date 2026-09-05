import { NavLink, Link, useLocation } from "react-router";
import { ArrowUpRight, BookOpen } from "lucide-react";
import { docsNavigation } from "../content/navigation";

export function DocsNav({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname, hash } = useLocation();
  const current = docsNavigation.find((page) => page.path.toLowerCase() === pathname.replace(/\/$/, "").toLowerCase());
  return (
    <nav aria-label="Engineering documentation" className="flex h-full flex-col gap-8">
      <div>
        <p className="docs-eyebrow mb-4">The case study</p>
        {docsNavigation.map((page) => (
          <NavLink key={page.path} to={page.path} end onClick={onNavigate}
            className={({ isActive }) => `docs-nav-link ${isActive ? "docs-nav-link-active" : ""}`}>
            <BookOpen size={17} aria-hidden="true" />{page.title}
          </NavLink>
        ))}
      </div>
      {current && <div>
        <p className="docs-eyebrow mb-4">On this page</p>
        <ul className="space-y-1 border-l border-border pl-4">
          {current.sections.map((section) => <li key={section.id}>
            <Link to={`${current.path}#${section.id}`} onClick={onNavigate}
              aria-current={hash === `#${section.id}` ? "location" : undefined}
              className="block rounded py-2 text-sm text-ink-muted hover:text-brand">
              {section.title}
            </Link>
          </li>)}
        </ul>
      </div>}
      <Link to="/" onClick={onNavigate} className="mt-auto flex items-center gap-2 border-t border-border pt-5 text-sm font-medium">
        Back to store <ArrowUpRight size={16} aria-hidden="true" />
      </Link>
    </nav>
  );
}
