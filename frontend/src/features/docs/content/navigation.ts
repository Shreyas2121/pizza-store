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
  description: "PizzaStore's high-level design, checkout flow, financial outbox, state ownership, and architectural tradeoffs.",
  sections: [
    { id: "high-level-design", title: "High-level design" },
    { id: "system-context", title: "System context" },
    { id: "application-boundaries", title: "Application boundaries" },
    { id: "cod-request", title: "A COD request" },
    { id: "state-ownership", title: "State ownership" },
    { id: "architectural-tradeoffs", title: "Tradeoffs" },
    { id: "financial-posting", title: "Financial posting" },
    { id: "promotions-and-revenue", title: "Promotions & revenue" },
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

export const docsInventory: DocsEntry = {
  path: "/docs/inventory",
  title: "Inventory consistency",
  description: "See how PizzaStore combines availability, reservations, ordered row locks, stock movements, and expiry policy.",
  sections: [
    { id: "stock-model", title: "Stock model" },
    { id: "availability", title: "Availability calculation" },
    { id: "transaction-locks", title: "Transaction & lock paths" },
    { id: "movement-ledger", title: "Movement ledger" },
    { id: "last-item", title: "The last item" },
    { id: "scenario-explorer", title: "Scenario explorer" },
    { id: "expiry-and-operations", title: "Expiry & operations" },
  ],
};

export const docsDecisions: DocsEntry = {
  path: "/docs/decisions",
  title: "Engineering decisions",
  description: "Review PizzaStore's current architectural choices, alternatives, accepted costs, evidence, and triggers for revisiting them.",
  sections: [
    { id: "assessment", title: "How to read the records" },
    { id: "local-transactions", title: "Local transactions" },
    { id: "stock-allocation", title: "Stock allocation" },
    { id: "order-records", title: "Order records" },
    { id: "payment-recovery", title: "Payment recovery" },
    { id: "store-authority", title: "Store authority" },
    { id: "frontend-state", title: "Frontend state" },
  ],
};

export const docsReliability: DocsEntry = {
  path: "/docs/reliability",
  title: "Reliability & recovery",
  description: "Inspect PizzaStore's test evidence, failure handling, reconciliation commands, diagnostics, deployment limits, and proposed improvements.",
  sections: [
    { id: "evidence-levels", title: "Evidence levels" },
    { id: "failure-matrix", title: "Failure matrix" },
    { id: "reconciliation", title: "Reconciliation" },
    { id: "diagnostics", title: "Diagnostics" },
    { id: "deployment-limits", title: "Deployment limits" },
    { id: "proposed-improvements", title: "Proposed improvements" },
  ],
};

export const docsNavigation: readonly DocsEntry[] = [
  docsOverview,
  docsArchitecture,
  docsOrderLifecycle,
  docsInventory,
  docsDecisions,
  docsReliability,
];
