import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import { DocsPage, DocsSection } from "../components/docs-page";
import { DiagramCard } from "../components/diagram-card";
import { EvidenceLinks } from "../components/evidence-links";
import { docsArchitecture } from "../content/navigation";
import { highLevelDesign, financialPosting, systemContext, containers, codRequest } from "../content/diagrams/architecture";
import { reviewedDate, reviewedRevision } from "../content/evidence";
import { promotionsLifecycle } from "../content/diagrams/promotions";

const ownership = [
  ["Presentation and navigation", "React and React Router", "Feature pages, layouts, forms, and navigation."],
  ["Server data", "TanStack Query", "API fetching, caching, and mutation invalidation."],
  ["Client session and UI", "Zustand / local React state", "Persisted auth, shared support/modal state; local state for docs controls."],
  ["Business rules", "Express feature services", "Checkout, access checks, inventory, and payment orchestration."],
  ["Persistent truth", "PostgreSQL through Drizzle", "Transactions, relationships, stock records, and payment records."],
];

export default function ArchitecturePage() {
  const [overview, context, applications, request, state, decisions, financial, promotions] = docsArchitecture.sections;
  return <DocsPage title={docsArchitecture.title} description={docsArchitecture.description}>
    <header className="pb-10">
      <p className="docs-eyebrow mb-5">02 / Architecture</p>
      <h1 className="max-w-3xl font-display text-4xl font-normal leading-tight tracking-tight sm:text-5xl">Clear boundaries.<br /><span className="text-brand">One coherent application.</span></h1>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-ink-muted">PizzaStore keeps its business modules in one API application. That makes local transactions straightforward, while payments and notifications still need their own failure handling.</p>
      <div className="mt-7 flex flex-wrap gap-3">
        <a href="#high-level-design" className="docs-button">Start with the HLD</a>
        <a href="#financial-posting" className="docs-button-secondary">How accounting stays consistent</a>
      </div>
      <p className="mt-5 text-xs leading-6 text-ink-muted">Architecture reviewed against the working tree on {reviewedDate}, based on <code>{reviewedRevision.slice(0, 7)}</code> with uncommitted changes. Source links resolve the published repository HEAD.</p>
    </header>

    <DocsSection section={overview}>
      <p className="mb-6 leading-7 text-ink-muted">This is the overview to start with: who uses the product, where business rules run, and where data is stored. Solid arrows show application and storage paths; dashed arrows show notifications and optional external payment paths.</p>
      <DiagramCard diagram={highLevelDesign} />
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          ["Why one backend?", "Checkout spans orders, promotions, payments, and stock. One database transaction coordinates their local changes."],
          ["Who owns the price?", "The server calculates the quote and saves price and tax snapshots. Browser totals are for presentation."],
          ["Where are the failure boundaries?", "Provider calls and socket delivery sit outside SQL transactions. Accounting uses a persisted outbox and idempotent posting."],
        ].map(([title, detail]) => <div key={title} className="rounded-card border border-border bg-surface p-5"><h3 className="font-semibold">{title}</h3><p className="mt-3 text-sm leading-7 text-ink-muted">{detail}</p></div>)}
      </div>
    </DocsSection>

    <DocsSection section={context}>
      <p className="mb-6 leading-7 text-ink-muted">Start with who uses the system and what sits outside it. Customers, store staff, and platform admins interact with the same product through different capabilities.</p>
      <DiagramCard diagram={systemContext} />
    </DocsSection>

    <DocsSection section={applications}>
      <p className="mb-6 leading-7 text-ink-muted">The browser, API, and database have distinct responsibilities. The C4 term “container” refers to an application or data store here; it does not imply Docker or a particular deployment.</p>
      <DiagramCard diagram={containers} />
      <EvidenceLinks id="ARCH-01" />
    </DocsSection>

    <DocsSection section={request}>
      <p className="mb-6 leading-7 text-ink-muted">This traces the implemented customer COD endpoint. It does not insert a staff permission guard into customer checkout: the quote checks address ownership and store eligibility instead.</p>
      <DiagramCard diagram={codRequest} />
      <EvidenceLinks id="ORDER-01" />
      <p className="mt-5 text-sm leading-6 text-ink-muted">Webhook requests follow a different entry path: their raw-body handler is mounted before normal JSON parsing, CORS, and request logging. Online payment creation happens outside the local checkout transaction. Delivery financial events are committed locally and posted through the outbox; browser and PostgreSQL concurrency evidence remains pending.</p>
    </DocsSection>

    <DocsSection section={state}>
      <div className="overflow-x-auto rounded-card border border-border" tabIndex={0} role="region" aria-label="State ownership table">
        <table className="w-full min-w-[580px] text-left text-sm leading-6">
          <caption className="sr-only">Who owns each kind of application state and behavior</caption>
          <thead className="bg-surface-muted"><tr>{["Concern", "Owner", "Responsibility"].map((heading) => <th key={heading} scope="col" className="px-5 py-4 font-semibold">{heading}</th>)}</tr></thead>
          <tbody>{ownership.map(([concern, owner, responsibility]) => <tr key={concern} className="border-t border-border bg-surface"><th scope="row" className="px-5 py-4 font-medium">{concern}</th><td className="px-5 py-4">{owner}</td><td className="px-5 py-4 text-ink-muted">{responsibility}</td></tr>)}</tbody>
        </table>
      </div>
      <EvidenceLinks id="ARCH-02" />
    </DocsSection>

    <DocsSection section={decisions}>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="rounded-card border border-border bg-surface p-6"><h3 className="mb-3 font-semibold">Why a modular monolith fits</h3><p className="text-sm leading-7 text-ink-muted">Checkout coordinates several domains. Keeping them in one application and database permits a local transaction and keeps deployment coordination manageable. This is a present-day assessment of the design, not an invented historical decision record.</p></div>
        <div className="rounded-card border border-border bg-surface p-6"><h3 className="mb-3 font-semibold">The costs remain visible</h3><p className="text-sm leading-7 text-ink-muted">Modules share a process and release boundary. External provider work cannot roll back with SQL, and a committed order can outlive its notification. Splitting services would introduce additional consistency and operational work.</p></div>
      </div>
      <p className="mt-6 text-sm leading-7 text-ink-muted">Consider changing these boundaries when measured bottlenecks, independent release needs, or operational requirements justify it. No production scale, durable event delivery, global deadlock freedom, or performance improvement is claimed by these diagrams.</p>
      <p className="mt-5 text-sm leading-6 text-ink-muted">Diagram conventions: <a className="underline underline-offset-4" href="https://c4model.com/diagrams/container">C4 container diagrams</a>. Rendering: <a className="underline underline-offset-4" href="https://mermaid.js.org/config/usage.html">Mermaid’s asynchronous API</a>, with <a className="underline underline-offset-4" href="https://mermaid.js.org/config/schema-docs/config-properties-securitylevel.html">strict security</a> and links outside the diagrams.</p>
    </DocsSection>
    <DocsSection section={financial}>
      <p className="mb-6 leading-7 text-ink-muted">Taking an order and recognizing revenue happen at different points. The financial outbox preserves business events for a separately invoked posting command, which converts them into journals for reporting.</p>
      <DiagramCard diagram={financialPosting} />
      <p className="mt-5 text-sm leading-7 text-ink-muted">Implementation: <code>backend/src/features/finance-events/posting-worker.ts</code>, <code>backend/src/features/ledger/ledger.repository.ts</code>, and <code>backend/migrations/0023_balanced_posting_kernel.sql</code>.</p>
    </DocsSection>
    <DocsSection section={promotions}>
      <DiagramCard diagram={promotionsLifecycle} />
      <p className="mt-5 text-sm leading-7 text-ink-muted">Reviewed against the current working tree on 2026-10-10. Platform admins manage definitions, media and analytics. Store managers only toggle their own participation; finance managers, operators, inventory staff and customers cannot toggle. Global deactivation overrides store choices. Hidden coupon codes never appear in public offer discovery.</p>
      <p className="mt-3 text-sm leading-7 text-ink-muted">Displayed item, delivery and bundle savings are separate from payable. Refunds use paid post-discount allocations; compare-at markdown and waived delivery are never refundable. Existing provider orders keep their saved prices after a promotion edit or store opt-out.</p>
    </DocsSection>
    <div className="flex flex-wrap gap-3"><Link to="/docs/order-lifecycle" className="docs-button">Continue to orders & payments</Link><Link to="/docs" className="docs-button-secondary"><ArrowLeft size={16} aria-hidden="true" />Project overview</Link></div>
  </DocsPage>;
}
