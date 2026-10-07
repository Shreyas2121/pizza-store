import type { EvidenceId } from "./evidence";

export interface DecisionRecord {
  number: string;
  title: string;
  context: string;
  constraints: readonly string[];
  chosenApproach: string;
  alternative: string;
  cost: string;
  revisit: string;
  evidence: readonly EvidenceId[];
}

export const decisionRecords: readonly DecisionRecord[] = [
  {
    number: "01",
    title: "Keep coordinated local work in one application",
    context: "Checkout crosses cart, catalogue, stock, promotion applications, orders, and payments. Those local records need a clear commit boundary.",
    constraints: [
      "COD creation should either persist all related local changes or none of them.",
      "Razorpay remains outside the database transaction regardless of application shape.",
    ],
    chosenApproach: "Use feature modules inside one Express application and one PostgreSQL database. Services collaborate through a local transaction for COD and online-attempt creation.",
    alternative: "Split commerce, inventory, and payments into independently deployed services with messages and compensating workflows.",
    cost: "Modules share a process and release boundary. External provider work and post-commit notifications still require recovery outside the local transaction.",
    revisit: "Reassess when measured scaling bottlenecks, fault-isolation requirements, or independently owned release cadences outweigh the added distributed-consistency work.",
    evidence: ["ARCH-01", "ORDER-01"],
  },
  {
    number: "02",
    title: "Serialize stock checks, then persist online holds",
    context: "Two checkouts can request the final tracked item, while an online payment needs stock to remain allocated after its creation transaction commits.",
    constraints: [
      "Demand must combine customized lines that consume the same base product.",
      "A transaction lock cannot remain held while a customer completes provider Checkout.",
    ],
    chosenApproach: "Lock store-product rows in ascending ID order, validate aggregate demand against active reservations, and persist reservations for online attempts. Capture later consumes the hold and deducts on-hand stock.",
    alternative: "Use an unlocked read-then-write flow, or deduct stock immediately and rely on compensation after every failed payment.",
    cost: "Locking can block and requires cross-path deadlock analysis. Reservations add expiry and reconciliation work, and current tests do not exercise live competing transactions.",
    revisit: "Reassess after measured lock waits, deadlocks, larger multi-item baskets, or a requirement for stronger allocation proof. Add disposable-database concurrency tests before strengthening the claim.",
    evidence: ["INV-02", "INV-03", "INV-04"],
  },
  {
    number: "03",
    title: "Snapshot charged values, retain domain references",
    context: "Catalogue prices and customization prices can change after checkout, but an order must preserve the values used to calculate its total.",
    constraints: [
      "Historical financial values must not be recomputed from the current catalogue.",
      "The existing schema continues to reference products, customizations, and the delivery address.",
    ],
    chosenApproach: "Copy item quantity and price, customization price, order total, discount, and payment amount into order/payment records while retaining entity references.",
    alternative: "Render the entire order from mutable catalogue/address rows, or copy every descriptive field into a fully denormalized receipt snapshot.",
    cost: "The current record preserves money but not every historical label or address field. It is a price snapshot rather than a complete immutable receipt.",
    revisit: "Expand the snapshot when legal, customer-service, or reporting requirements demand an immutable record of names, options, tax details, or delivery address text.",
    evidence: ["ORDER-03"],
  },
  {
    number: "04",
    title: "Verify provider state and reconcile interrupted flows",
    context: "A provider call, browser callback, webhook, and local database commit cannot share one atomic boundary. Any of them can arrive late, repeat, or stop midway.",
    constraints: [
      "Completion requires verified provider identity, association, amount, currency, and captured state.",
      "Repeated callbacks and webhook deliveries must not deduct stock twice.",
    ],
    chosenApproach: "Create the local attempt first, verify callbacks and signed webhooks, funnel capture through a locked finalizer, and provide one-shot stale-payment and reservation reconciliation commands.",
    alternative: "Trust the browser's success callback as final, or depend only on provider webhook delivery without a local recovery scan.",
    cost: "Intermediate states, conflict handling, external scheduling, and operational review remain necessary. Reconciliation and realtime delivery are separate concerns.",
    revisit: "Before relying on online payments in production, complete route/retry recovery, define refund handling, schedule both commands, and add alerts. Consider durable jobs when backlog or missed-event evidence appears.",
    evidence: ["PAY-03", "PAY-05", "REC-02", "REC-03", "RT-02"],
  },
  {
    number: "05",
    title: "Authorize capabilities at the store boundary",
    context: "A person can work at one store without gaining equivalent authority at every store. Platform administration is a separate scope.",
    constraints: [
      "Backend checks must use current active membership rather than trusting hidden controls or stale token roles.",
      "Orders, inventory, staff changes, audit data, and socket audiences have different capabilities.",
    ],
    chosenApproach: "Keep platform role and store membership separate, map store roles to named permissions, check resource ownership on the server, and derive socket rooms from active memberships.",
    alternative: "Use one global admin flag or treat frontend navigation visibility as the authorization boundary.",
    cost: "The permission matrix, membership lifecycle, audit trail, and socket invalidation must evolve together. Membership-change socket eviction currently reaches only the local process.",
    revisit: "Consider stored/custom roles when fixed roles stop matching operations, and distributed socket invalidation before running multiple application instances.",
    evidence: ["ACCESS-02", "ACCESS-03", "ACCESS-04", "RT-01"],
  },
  {
    number: "06",
    title: "Give remote and local interface state different owners",
    context: "API data has caching and invalidation needs, while authentication, modal/socket state, and page-local controls have different lifecycles.",
    constraints: [
      "Server data should refresh through shared query rules.",
      "Persisted session state and transient page controls should have explicit, different lifecycles.",
    ],
    chosenApproach: "Use TanStack Query for remote server state, Zustand for persisted auth and selected shared client state, and local React state for page interactions.",
    alternative: "Place fetched records, authentication, transient UI state, and documentation controls in one global store.",
    cost: "Developers must understand several ownership models and keep query invalidation, persisted state, and effect boundaries explicit.",
    revisit: "Reassess when offline editing, cross-tab synchronization, or complex multi-page drafts require a broader client-state protocol.",
    evidence: ["ARCH-02"],
  },
];
