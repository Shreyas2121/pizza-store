import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";
import { DocsPage, DocsSection } from "../components/docs-page";
import { DiagramCard } from "../components/diagram-card";
import { EvidenceLinks } from "../components/evidence-links";
import { docsOrderLifecycle } from "../content/navigation";
import { reviewedDate, reviewedRevision } from "../content/evidence";
import { codLifecycle, onlineInitiation, captureLifecycle, orderTransitions } from "../content/diagrams/order-lifecycle";
import { cancellationRows, recoveryScenarios } from "../content/order-lifecycle";

const paymentStages = [
  ["Local creation", "pending", "COD order is pending; online order is awaiting_payment."],
  ["Online creation claim / attachment", "processing", "Order remains awaiting_payment while the provider attempt is prepared."],
  ["Verified online capture", "completed", "Finalization sets the order pending and consumes reservations."],
  ["COD delivered", "completed", "Status update completes the linked COD payment in its transaction."],
  ["Provider failure / safe expiry", "failed", "Provider failure leaves awaiting_payment; safe expiry cancels it."],
  ["Refund-related guards", "refunded", "Recognized by existing types/guards; no provider refund workflow is established."],
] as const;

export default function OrderLifecyclePage() {
  const [snapshot, cod, online, capture, states, cancellation, recovery] = docsOrderLifecycle.sections;
  return <DocsPage title={docsOrderLifecycle.title} description={docsOrderLifecycle.description}>
    <header className="pb-10">
      <p className="docs-eyebrow mb-5">03 / Orders & payments</p>
      <h1 className="max-w-3xl font-display text-4xl font-normal leading-tight tracking-tight sm:text-5xl">An order has a lifecycle.<br /><span className="text-brand">So does its payment.</span></h1>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-ink-muted">Checkout connects a cart, stock, coupon use, fulfillment, and payment. This page follows what commits together and what needs a separate recovery path.</p>
      <div className="mt-7 rounded-control border border-border bg-surface-muted p-5 text-sm leading-6 text-ink-muted">
        <p>Source snapshot: <code>{reviewedRevision.slice(0, 7)}</code>, reviewed {reviewedDate}. Financial work is in progress on another branch; these flows describe the audited main-branch implementation, not a claim that the full online UI works end to end.</p>
        <p className="mt-2">At this revision, frontend method-discovery and retry calls have no registered backend routes. Retry service code exists but does not restore released stock holds.</p>
      </div>
    </header>

    <DocsSection section={snapshot}>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="rounded-card border border-border bg-surface p-6"><h3 className="mb-3 font-semibold">The values that are copied</h3><p className="text-sm leading-7 text-ink-muted">Order items retain quantity and price; customization selections retain their prices. Order total and discount are also recorded. Both COD and online initiation clear the cart within the local creation transaction.</p></div>
        <div className="rounded-card border border-border bg-surface p-6"><h3 className="mb-3 font-semibold">The references that remain</h3><p className="text-sm leading-7 text-ink-muted">Product identities, customization identities, and the delivery address remain linked records. This is a price snapshot, not a complete immutable copy of product names or address text.</p></div>
      </div>
      <EvidenceLinks id="ORDER-03" />
    </DocsSection>

    <DocsSection section={cod}>
      <p className="mb-6 leading-7 text-ink-muted">COD begins with a pending order and pending payment. Quote validation, stock deduction, snapshots, coupon consumption, and cart clearing share a database transaction; delivery later completes the linked cash payment.</p>
      <DiagramCard diagram={codLifecycle} />
      <EvidenceLinks id="ORDER-01" />
    </DocsSection>

    <DocsSection section={online}>
      <p className="mb-6 leading-7 text-ink-muted">Online initiation reserves tracked stock rather than deducting on-hand quantity. The local order can exist before a provider order exists, which creates a recovery responsibility if the provider call or attachment fails.</p>
      <DiagramCard diagram={onlineInitiation} />
      <p className="mt-5 text-sm leading-7 text-ink-muted">An existing client request ID is reused only for the same user. Unique request and provider IDs constrain local duplication; they do not make Razorpay part of a SQL transaction. Untracked products do not create stock reservation rows.</p>
      <EvidenceLinks id="PAY-01" />
      <EvidenceLinks id="PAY-02" />
    </DocsSection>

    <DocsSection section={capture}>
      <div className="mb-6 grid gap-5 sm:grid-cols-2">
        <div className="rounded-card border border-border p-6"><h3 className="mb-3 font-semibold">Customer verification callback</h3><p className="text-sm leading-7 text-ink-muted">The authenticated callback checks local order ownership, provider order association, and checkout signature before fetching current provider state. A successful browser callback alone does not mark the order paid.</p></div>
        <div className="rounded-card border border-border p-6"><h3 className="mb-3 font-semibold">Provider webhook</h3><p className="text-sm leading-7 text-ink-muted">The webhook checks an HMAC over raw request bytes before claiming the event ID. It processes payment.captured, payment.failed, and order.paid through provider reconciliation.</p></div>
      </div>
      <DiagramCard diagram={captureLifecycle} />
      <div className="mt-6 rounded-card bg-surface-muted p-6"><h3 className="mb-3 font-semibold">Two different repeat checks</h3><ul className="list-disc space-y-3 pl-5 text-sm leading-7 text-ink-muted"><li>A processed webhook ID returns as a duplicate. A fresh processing claim returns an in-progress error. Failed claims can be reclaimed; processing claims become stale after five minutes.</li><li>Finalization separately checks the provider payment ID and completed state under row locks. Replaying the same completed payment returns without another stock deduction.</li><li>Event claiming, payment commit, webhook processed marking, and route-level notification are separate boundaries. They are not an end-to-end exactly-once guarantee.</li></ul></div>
      <EvidenceLinks id="PAY-03" /><EvidenceLinks id="PAY-04" /><EvidenceLinks id="PAY-05" />
    </DocsSection>

    <DocsSection section={states}>
      <DiagramCard diagram={orderTransitions} />
      <p className="mt-5 text-sm leading-7 text-ink-muted">The stored delivered value is spelled <code>delievered</code>; this documentation does not rename it. Staff status updates use the shared map plus authorization. The map allows awaiting_payment → pending, while the payment finalizer independently verifies capture before making that transition.</p>
      <EvidenceLinks id="ORDER-02" />
      <h3 className="mb-4 mt-8 text-lg font-semibold">Payment status is a separate record</h3>
      <div className="overflow-x-auto rounded-card border border-border" tabIndex={0} role="region" aria-label="Payment and order status comparison">
        <table className="w-full min-w-[650px] text-left text-sm leading-6"><caption className="sr-only">Payment status at each observed lifecycle stage</caption>
          <thead className="bg-surface-muted"><tr>{["Stage", "Payment status", "Order relationship"].map((heading) => <th key={heading} scope="col" className="px-5 py-4 font-semibold">{heading}</th>)}</tr></thead>
          <tbody>{paymentStages.map(([stage, status, relationship]) => <tr key={stage} className="border-t border-border bg-surface"><th scope="row" className="px-5 py-4 font-medium">{stage}</th><td className="px-5 py-4 font-mono text-xs">{status}</td><td className="px-5 py-4 text-ink-muted">{relationship}</td></tr>)}</tbody>
        </table>
      </div>
    </DocsSection>

    <DocsSection section={cancellation}>
      <p className="mb-6 leading-7 text-ink-muted">Cancellation is not synonymous with refund. Its inventory and coupon effects depend on whether stock was reserved or sold and whether coupon use was reserved or consumed.</p>
      <div className="overflow-x-auto rounded-card border border-border" tabIndex={0} role="region" aria-label="Cancellation and expiry effects, scroll horizontally">
        <table className="w-full min-w-[1150px] text-left text-sm leading-6"><caption className="border-b border-border bg-surface px-5 py-4 text-left text-xs text-ink-muted">Current cancellation effects. Scroll horizontally to compare reservations, stock, coupon use, local state, and recovery.</caption>
          <thead className="bg-surface-muted"><tr>{["Trigger", "Reservations", "On-hand stock", "Coupon", "Order / payment", "Recovery"].map((heading) => <th key={heading} scope="col" className="px-4 py-4 font-semibold">{heading}</th>)}</tr></thead>
          <tbody>{cancellationRows.map((row) => <tr key={row.trigger} className="border-t border-border bg-surface align-top"><th scope="row" className="px-4 py-4 font-medium">{row.trigger}</th>{[row.reservations, row.stock, row.coupon, row.payment, row.recovery].map((value, index) => <td key={index} className="px-4 py-4 text-ink-muted">{value}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <p className="mt-5 text-sm leading-7 text-ink-muted">Repeated same-status cancellation is an early no-op. Delivered-to-cancelled is rejected before restoration. Releasing a coupon reservation filters only reserved use, so it does not undo a consumed redemption or decrement its count.</p>
      <p className="mt-3 text-sm leading-7 text-ink-muted">A completed online payment remains completed when its order is cancelled through the status service. No provider refund operation exists in the reviewed gateway; the presence of a refunded status does not implement one.</p>
      <EvidenceLinks id="ORDER-02" /><EvidenceLinks id="REC-01" />
    </DocsSection>

    <DocsSection section={recovery}>
      <div className="space-y-5">{recoveryScenarios.map((scenario) => <div key={scenario.title} className="rounded-card border border-border bg-surface p-6"><h3 className="font-semibold">{scenario.title}</h3><p className="mt-3 text-sm leading-7 text-ink-muted">{scenario.behavior}</p><p className="mt-4 border-l-2 border-basil pl-4 text-sm leading-7 text-ink-muted">{scenario.limit}</p></div>)}</div>
      <div className="mt-7 rounded-card bg-surface-muted p-6"><h3 className="mb-3 font-semibold">Recovery is an operation, not a clock label</h3><p className="text-sm leading-7 text-ink-muted"><code>payments:reconcile</code> scans stale payments and can recover provider attachments. <code>inventory:reconcile-reservations</code> handles expired tracked reservations. They are separate one-shot backend commands; no deployed schedule was established. All-untracked orders are not discovered by the reservation-row scan.</p><p className="mt-3 text-sm leading-7 text-ink-muted">CLI reconciliation does not emit socket events. Some HTTP/webhook paths lack the store/user context required for full notification routing. Successful reconciliation is not proof that every audience received an event.</p></div>
      <EvidenceLinks id="PAY-06" /><EvidenceLinks id="REC-01" /><EvidenceLinks id="REC-02" /><EvidenceLinks id="RT-02" />
    </DocsSection>
    <div className="flex flex-wrap gap-3"><Link to="/docs/inventory" className="docs-button">Continue to inventory consistency</Link><Link to="/docs/architecture" className="docs-button-secondary"><ArrowLeft size={16} aria-hidden="true" />Back to architecture</Link></div>
  </DocsPage>;
}
