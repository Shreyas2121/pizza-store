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

export const docsNavigation: readonly DocsEntry[] = [docsOverview];
