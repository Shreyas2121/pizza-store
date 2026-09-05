export interface DocsSection {
  id: string;
  title: string;
}

export interface DocsEntry {
  path: string;
  title: string;
  description: string;
  sections: readonly DocsSection[];
}

// Register only published pages. Section IDs are stable shared-link targets.
export const docsOverview: DocsEntry = {
  path: "/docs",
  title: "Project overview",
  description: "Explore PizzaStore's architecture, inventory decisions, and engineering tradeoffs.",
  sections: [
    { id: "the-product", title: "The product" },
    { id: "engineering-highlights", title: "Engineering highlights" },
    { id: "technology", title: "Technology & boundaries" },
    { id: "limitations", title: "Limits & evidence" },
  ],
};

export const docsArchitecture: DocsEntry = {
  path: "/docs/architecture",
  title: "Architecture",
  description: "PizzaStore's system boundaries, COD request lifecycle, state ownership, and architectural tradeoffs.",
  sections: [
    { id: "system-context", title: "System context" },
    { id: "application-boundaries", title: "Application boundaries" },
    { id: "cod-request", title: "A COD request" },
    { id: "state-ownership", title: "State ownership" },
    { id: "architectural-tradeoffs", title: "Tradeoffs" },
  ],
};

export const docsNavigation: readonly DocsEntry[] = [docsOverview, docsArchitecture];
