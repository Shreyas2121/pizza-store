import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import { DocsPage, DocsSection } from "../components/docs-page";
import { DiagramCard } from "../components/diagram-card";
import { EvidenceLinks } from "../components/evidence-links";
import { docsArchitecture } from "../content/navigation";
import { systemContext, containers, codRequest } from "../content/diagrams/architecture";
import { reviewedDate, reviewedRevision } from "../content/evidence";

const ownership = [
  ["Presentation and navigation", "React and React Router", "Feature pages, layouts, forms, and navigation."],
  ["Server data", "TanStack Query", "API fetching, caching, and mutation invalidation."],
  ["Client session and UI", "Zustand / local React state", "Persisted auth, shared support/modal state; local state for docs controls."],
  ["Business rules", "Express feature services", "Checkout, access checks, inventory, and payment orchestration."],
  ["Persistent truth", "PostgreSQL through Drizzle", "Transactions, relationships, stock records, and payment records."],
];

export default function ArchitecturePage() {
  const [context, applications, request, state, decisions] = docsArchitecture.sections;
  return <DocsPage title={docsArchitecture.title} description={docsArchitecture.description}>
    <header className="pb-10">
      <p className="docs-eyebrow mb-5">02 / Architecture</p>
      <h1 className="max-w-3xl font-display text-4xl font-normal leading-tight tracking-tight sm:text-5xl">Clear boundaries.<br /><span className="text-brand">One coherent application.</span></h1>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-ink-muted">PizzaStore keeps its business modules in one API application. That makes local transactions straightforward, while payments and notifications still need their own failure handling.</p>
      <p className="mt-5 text-xs leading-6 text-ink-muted">Source view: <code>{reviewedRevision.slice(0, 7)}</code> · reviewed {reviewedDate}. Diagrams describe the audited implementation; hosting and live payment behavior are not verified here.</p>
    </header>

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
      <p className="mt-5 text-sm leading-6 text-ink-muted">Webhook requests follow a different entry path: their raw-body handler is mounted before normal JSON parsing, CORS, and request logging. Online payment creation happens outside the local checkout transaction. Financial work is under revision and must be re-audited before stronger claims are published.</p>
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
    <div className="flex flex-wrap gap-3"><Link to="/docs/order-lifecycle" className="docs-button">Continue to orders & payments</Link><Link to="/docs" className="docs-button-secondary"><ArrowLeft size={16} aria-hidden="true" />Project overview</Link></div>
  </DocsPage>;
}
