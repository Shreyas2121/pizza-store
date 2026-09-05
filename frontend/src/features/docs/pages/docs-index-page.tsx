import { ArrowDown, ArrowRight, Layers3, PackageCheck, ShieldCheck } from "lucide-react";
import { Link } from "react-router";
import { DocsPage, DocsSection } from "../components/docs-page";
import { EvidenceLinks } from "../components/evidence-links";
import { docsOverview } from "../content/navigation";
import { repositoryUrl, reviewedDate, reviewedRevision } from "../content/evidence";

const highlights = [
  { id: "ORDER-01", icon: Layers3, number: "01", title: "A checkout that commits together", problem: "An order is more than a row in a table.", detail: "COD checkout creates the payment and order, copies item prices, deducts tracked stock, records coupon use, and clears the cart within one database transaction.", tradeoff: "A shared transaction simplifies local consistency. It does not make external payment calls atomic.", to: "/docs/order-lifecycle", linkLabel: "Follow the order lifecycle" },
  { id: "INV-02", icon: PackageCheck, number: "02", title: "Stock belongs to a store", problem: "Two customers can ask for the last item.", detail: "Allocation locks store-product rows in ascending ID order before checking reserved stock. Customized cart lines share the demand for their base product.", tradeoff: "Ordered allocation is one part of the design. Global deadlock freedom and live contention still need stronger evidence.", to: "/docs/inventory#scenario-explorer", linkLabel: "Try the last-item explorer" },
  { id: "ACCESS-02", icon: ShieldCheck, number: "03", title: "Authority follows the store", problem: "Working at one store should not grant access to every store.", detail: "Store memberships carry manager, operator, or inventory-staff permissions. Platform authority stays separate, and backend policy evaluates the requested capability.", tradeoff: "Explicit permissions keep the boundary inspectable. Hidden UI controls are not an authorization guarantee.", to: "/docs/decisions#store-authority", linkLabel: "Review the authority decision" },
] as const;

const technology = [
  { title: "Interface", stack: "React · TypeScript · Mantine", detail: "Feature pages and reusable UI, styled with the existing Tailwind design tokens." },
  { title: "Application state", stack: "TanStack Query · Zustand", detail: "Server data and client state have separate owners. Docs content needs neither an account nor API data." },
  { title: "Business logic", stack: "Node.js · Express · Zod", detail: "Routes, services, validation, and store permissions live in domain modules." },
  { title: "Persistence & events", stack: "PostgreSQL · Drizzle · Socket.IO", detail: "Database transactions own persistent changes; realtime notifications are a separate delivery step." },
];

export default function DocsIndexPage() {
  const [product, engineering, stack, limits] = docsOverview.sections;
  return <DocsPage title={docsOverview.title} description={docsOverview.description}>
    <header className="pb-12">
      <p className="docs-eyebrow mb-6 flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-basil" aria-hidden="true" />A full-stack engineering case study</p>
      <h1 className="max-w-3xl font-display text-5xl font-normal leading-[1.08] tracking-tight sm:text-6xl">Good food.<br /><span className="text-brand">Considered engineering.</span></h1>
      <p className="mt-7 max-w-2xl text-lg leading-8 text-ink-muted">PizzaStore is a multi-store ordering application. This notebook looks behind the storefront: how orders become durable, how stock is allocated, and where staff authority begins and ends.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/docs/architecture" className="docs-button">Explore the architecture <ArrowDown size={16} aria-hidden="true" /></Link>
        <Link to="/" className="docs-button-secondary">Open storefront</Link>
        {repositoryUrl && <a href={repositoryUrl} className="docs-button-secondary">View repository</a>}
      </div>
      <div className="mt-9 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-5 text-xs text-ink-muted"><span>01 / Project overview</span><span>Suggested reading: 4 minutes</span><span>Source reviewed {reviewedDate}</span></div>
    </header>

    <DocsSection section={product}>
      <div className="grid gap-7 sm:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4 leading-7 text-ink-muted"><p>Customers browse a store’s menu, customize products, build a cart, and place an order. Staff work with fulfillment, inventory, and store-specific operations.</p><p>The interesting engineering is in the boundaries between those actions: preserving checkout data, coordinating reservations with payments, and checking who can change a store’s resources.</p></div>
        <div className="rounded-card border border-border bg-surface p-6"><p className="docs-eyebrow mb-3">A short reading path</p><ol className="list-decimal space-y-3 pl-4 text-sm leading-6"><li>Read the three highlights below.</li><li><Link className="underline underline-offset-4" to="/docs/architecture">Follow a request through the architecture.</Link></li><li><Link className="underline underline-offset-4" to="/docs/inventory">Walk through contention for the last item.</Link></li><li><Link className="underline underline-offset-4" to="/docs/decisions">Compare choices, alternatives, and costs.</Link></li><li><Link className="underline underline-offset-4" to="/docs/reliability">Inspect failure handling and evidence limits.</Link></li></ol></div>
      </div>
    </DocsSection>

    <DocsSection section={engineering}>
      <p className="mb-7 max-w-2xl leading-7 text-ink-muted">A decision is easier to assess when its problem, implementation, and limits are visible together.</p>
      <div className="space-y-5">{highlights.map(({ id, icon: Icon, number, title, problem, detail, tradeoff, to, linkLabel }) => <div key={id} className="rounded-card border border-border bg-surface p-6 sm:p-8">
        <div className="mb-5 flex items-center justify-between"><Icon size={24} className="text-basil" aria-hidden="true" /><span className="font-mono text-sm text-ink-muted">{number}</span></div>
        <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
        <p className="mt-3 font-medium">{problem}</p><p className="mt-2 leading-7 text-ink-muted">{detail}</p>
        <p className="mt-5 border-l-2 border-basil pl-4 text-sm leading-6 text-ink-muted">{tradeoff}</p>
        <Link to={to} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-control text-sm font-semibold text-brand underline-offset-4 hover:underline">{linkLabel}<ArrowRight size={16} aria-hidden="true" /></Link>
        <EvidenceLinks id={id} />
      </div>)}</div>
    </DocsSection>

    <DocsSection section={stack}>
      <p className="mb-7 leading-7 text-ink-muted">One browser application, one API application, and PostgreSQL. Razorpay sits outside the local transaction boundary.</p>
      <div className="grid gap-4 sm:grid-cols-2">{technology.map((item) => <div key={item.title} className="rounded-card border border-border p-6"><p className="docs-eyebrow mb-3">{item.title}</p><h3 className="text-base font-semibold leading-6">{item.stack}</h3><p className="mt-3 text-sm leading-6 text-ink-muted">{item.detail}</p></div>)}</div>
    </DocsSection>

    <DocsSection section={limits}>
      <div className="rounded-card bg-surface-muted p-6 sm:p-8">
        <p className="mb-5 text-lg font-medium">An implementation record, with its limits included.</p>
        <ul className="list-disc space-y-3 pl-5 leading-7 text-ink-muted">
          <li>The reviewed tests mostly exercise pure logic and mocked services. They do not establish real database contention, live payment recovery, or deployed reliability.</li>
          <li>Payments and financial behavior are under rework. Cancellation, retry, and notification handling must be reviewed again before making stronger claims.</li>
          <li>No production traffic, availability figures, or performance benchmarks are claimed here.</li>
        </ul>
        <p className="mt-6 border-t border-border pt-5 text-sm leading-6 text-ink-muted">Evidence refers to revision <code className="font-mono">{reviewedRevision.slice(0, 7)}</code>, reviewed {reviewedDate}. The detailed audit lives in <code className="break-words">docs/case-study-evidence.md</code> in the repository. Source paths above remain readable when a public repository link is not configured.</p>
      </div>
    </DocsSection>
  </DocsPage>;
}
