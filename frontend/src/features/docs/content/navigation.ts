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

export const docsOrderLifecycle: DocsEntry = {
  path: "/docs/order-lifecycle",
  title: "Orders & payments",
  description: "Follow PizzaStore's COD and online payment transactions, order states, cancellation effects, and recovery limits.",
  sections: [
    { id: "checkout-snapshot", title: "Checkout snapshot" },
    { id: "cod-flow", title: "Cash on delivery" },
    { id: "online-initiation", title: "Online initiation" },
    { id: "capture-and-deduplication", title: "Capture & repeat events" },
    { id: "order-and-payment-states", title: "Order & payment states" },
    { id: "cancellation-effects", title: "Cancellation effects" },
    { id: "failure-and-recovery", title: "Failure & recovery" },
  ],
};

export const docsNavigation: readonly DocsEntry[] = [docsOverview, docsArchitecture, docsOrderLifecycle];
