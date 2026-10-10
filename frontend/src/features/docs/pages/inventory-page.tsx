import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";
import { DocsPage, DocsSection } from "../components/docs-page";
import { DiagramCard } from "../components/diagram-card";
import { EvidenceLinks } from "../components/evidence-links";
import { reviewedDate, reviewedRevision } from "../content/evidence";
import { inventoryLedgerExample, lockPaths, operationalInteractions } from "../content/inventory";
import { inventoryStateModel, lastItemSequence } from "../content/diagrams/inventory";
import { docsInventory } from "../content/navigation";
import { InventorySimulator } from "../simulations/inventory-simulator";

const availabilityTerms = [
  ["On-hand", "Physical tracked quantity stored on the store-product row. null means inventory is untracked."],
  ["Active reserved", "The sum of reservation rows whose status is reserved. A past expiresAt timestamp still counts until processing changes the status."],
  ["Displayed available", "For tracked stock: max(0, on-hand - active reserved). For untracked stock: null."],
  ["Demand", "The requested quantity summed by base product across cart lines, including differently customized versions."],
] as const;

export default function InventoryPage() {
  const [model, availability, locks, ledger, contention, explorer, operations] = docsInventory.sections;
  return <DocsPage title={docsInventory.title} description={docsInventory.description}>
    <header className="pb-10">
      <p className="docs-eyebrow mb-5">04 / Inventory consistency</p>
      <h1 className="max-w-3xl font-display text-4xl font-normal leading-tight tracking-tight sm:text-5xl">The lock is temporary.<br /><span className="text-brand">The reservation persists.</span></h1>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-ink-muted">Inventory is store-specific state coordinated across checkout, payment, cancellation, expiry, and staff operations. The core rule is simple; transaction boundaries keep the related local changes together.</p>
      <div className="mt-7 rounded-control border border-border bg-surface-muted p-5 text-sm leading-6 text-ink-muted">
        <p>Working-tree baseline: <code>{reviewedRevision.slice(0, 7)}</code>, reviewed {reviewedDate}. The tests cited here cover pure arithmetic and mocked query orchestration. No live PostgreSQL contention test is claimed.</p>
      </div>
    </header>

    <DocsSection section={model}>
      <div className="mb-6 grid gap-5 sm:grid-cols-2">
        <div className="rounded-card border border-border bg-surface p-6"><h3 className="mb-3 font-semibold">Stock belongs to a store product</h3><p className="text-sm leading-7 text-ink-muted">The same product can have a different price, manual availability flag, and stock balance at each store. Reservations therefore point to the store-product mapping.</p></div>
        <div className="rounded-card border border-border bg-surface p-6"><h3 className="mb-3 font-semibold">Customization does not create another stock item</h3><p className="text-sm leading-7 text-ink-muted">Two cart lines can choose different toppings while consuming the same base pizza. Checkout sums their quantities by product before it checks the store's stock.</p></div>
      </div>
      <DiagramCard diagram={inventoryStateModel} />
      <p className="mt-5 text-sm leading-7 text-ink-muted">Final checkout stabilizes catalogue and store-product state under its lock/revalidation policy. Stock deductions and restocks do not automatically toggle those flags, so “can this be sold?” and “how many are numerically available?” remain separate controls.</p>
      <EvidenceLinks id="INV-01" />
    </DocsSection>

    <DocsSection section={availability}>
      <div className="rounded-card border border-border bg-surface p-6 sm:p-8">
        <p className="docs-eyebrow mb-4">Tracked stock formula</p>
        <p className="break-words font-mono text-lg sm:text-2xl">displayed = max(0, on_hand - active_reserved)</p>
        <p className="mt-4 text-sm leading-7 text-ink-muted">The clamp keeps a negative number out of the interface. It does not prove the stored quantities are consistent. Allocation still checks the aggregated requested quantity inside the checkout transaction.</p>
      </div>
      <div className="mt-6 overflow-x-auto rounded-card border border-border" tabIndex={0} role="region" aria-label="Inventory quantity definitions">
        <table className="w-full min-w-[620px] text-left text-sm leading-6"><caption className="sr-only">Definitions for on-hand, reserved, available, and demand quantities</caption>
          <thead className="bg-surface-muted"><tr><th scope="col" className="px-5 py-4 font-semibold">Term</th><th scope="col" className="px-5 py-4 font-semibold">Meaning in the audited implementation</th></tr></thead>
          <tbody>{availabilityTerms.map(([term, meaning]) => <tr key={term} className="border-t border-border bg-surface"><th scope="row" className="px-5 py-4 font-medium">{term}</th><td className="px-5 py-4 text-ink-muted">{meaning}</td></tr>)}</tbody>
        </table>
      </div>
      <EvidenceLinks id="INV-01" />
      <EvidenceLinks id="INV-03" />
    </DocsSection>

    <DocsSection section={locks}>
      <p className="mb-6 leading-7 text-ink-muted">Each write transaction locks an owning row before it changes inventory state, then takes the other locks it needs. Several inventory helpers sort store-product locks by ascending ID, but the complete sequence differs by path.</p>
      <div className="overflow-x-auto rounded-card border border-border" tabIndex={0} role="region" aria-label="Lock sequences by inventory operation, scroll horizontally">
        <table className="w-full min-w-[960px] text-left text-sm leading-6"><caption className="border-b border-border bg-surface px-5 py-4 text-left text-xs text-ink-muted">Audited ordering at the reviewed revision. Arrows show the observed sequence, including reads that are not row locks.</caption>
          <thead className="bg-surface-muted"><tr>{["Operation", "Observed sequence", "Transactional result"].map((heading) => <th key={heading} scope="col" className="px-5 py-4 font-semibold">{heading}</th>)}</tr></thead>
          <tbody>{lockPaths.map((path) => <tr key={path.operation} className="border-t border-border bg-surface align-top"><th scope="row" className="px-5 py-4 font-medium">{path.operation}</th><td className="px-5 py-4 font-mono text-xs text-ink-muted">{path.sequence}</td><td className="px-5 py-4 text-ink-muted">{path.result}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="mt-6 rounded-card bg-surface-muted p-6"><h3 className="mb-3 font-semibold">What this evidence supports</h3><p className="text-sm leading-7 text-ink-muted">Checkout and capture deliberately order their stock-row locks, and capture also orders reservation locks. Cancellation releases reservation rows before it locks stock; safe expiry and staff operations start from different owning rows. This supports a concrete lock-order explanation, not a claim of global deadlock freedom.</p></div>
      <EvidenceLinks id="INV-02" />
      <EvidenceLinks id="INV-04" />
      <EvidenceLinks id="INV-06" />
    </DocsSection>

    <DocsSection section={ledger}>
      <p className="mb-6 leading-7 text-ink-muted">Tracked stock writes append a movement alongside the quantity change. The database checks the arithmetic invariant <code>new_quantity = previous_quantity + quantity_change</code> and rejects negative previous or new quantities.</p>
      <div className="overflow-x-auto rounded-card border border-border" tabIndex={0} role="region" aria-label="Synthetic inventory movement ledger example">
        <table className="w-full min-w-[760px] text-left text-sm leading-6"><caption className="border-b border-border bg-surface px-5 py-4 text-left text-xs text-ink-muted"><strong className="text-ink">Synthetic example.</strong> These entries illustrate valid arithmetic; they are not production records.</caption>
          <thead className="bg-surface-muted"><tr>{["Movement", "Example reason", "Change", "Previous", "New", "Arithmetic"].map((heading) => <th key={heading} scope="col" className="px-4 py-4 font-semibold">{heading}</th>)}</tr></thead>
          <tbody>{inventoryLedgerExample.map((entry, index) => <tr key={`${entry.change}-${index}`} className="border-t border-border bg-surface"><th scope="row" className="px-4 py-4 font-medium">{entry.change}</th><td className="px-4 py-4 text-ink-muted">{entry.reason}</td><td className="px-4 py-4 font-mono">{entry.quantityChange}</td><td className="px-4 py-4 font-mono">{entry.previousQuantity}</td><td className="px-4 py-4 font-mono">{entry.newQuantity}</td><td className="px-4 py-4 font-mono text-xs text-ink-muted">{entry.previousQuantity} {entry.quantityChange} = {entry.newQuantity}</td></tr>)}</tbody>
        </table>
      </div>
      <p className="mt-5 text-sm leading-7 text-ink-muted">Sale and cancellation movements use unique operation keys so the same order/store-product effect cannot be appended twice. Staff restock and adjustment records identify the actor; adjustments require a reason. The maintenance clear operation can truncate the ledger, so it is an operational history rather than an immutable audit archive.</p>
      <EvidenceLinks id="INV-05" />
    </DocsSection>

    <DocsSection section={contention}>
      <p className="mb-6 leading-7 text-ink-muted">This walkthrough stays useful without interaction. It shows the state transition that the teaching explorer below replays, while keeping database evidence and simulation claims separate.</p>
      <DiagramCard diagram={lastItemSequence} />
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-card border border-border p-5"><p className="docs-eyebrow mb-3">During A's transaction</p><p className="text-sm leading-7 text-ink-muted">A owns the row lock. B waits. On-hand remains 1 while A prepares a reservation.</p></div>
        <div className="rounded-card border border-border p-5"><p className="docs-eyebrow mb-3">After A commits</p><p className="text-sm leading-7 text-ink-muted">The row lock is gone. The reservation remains: on-hand 1, reserved 1, displayed 0.</p></div>
        <div className="rounded-card border border-border p-5"><p className="docs-eyebrow mb-3">When B continues</p><p className="text-sm leading-7 text-ink-muted">B validates current state and is rejected. A future release permits a new B attempt; it does not resume this rejected one.</p></div>
      </div>
      <EvidenceLinks id="INV-02" />
      <EvidenceLinks id="INV-03" />
    </DocsSection>

    <DocsSection section={explorer}>
      <p className="mb-6 leading-7 text-ink-muted">Step through the fixed capture, payment-failure, and safe-expiry sequences. The actor cards and transcript explain each outcome in text, including why Customer B's rejected request needs a new attempt after stock is released.</p>
      <InventorySimulator />
    </DocsSection>

    <DocsSection section={operations}>
      <div className="space-y-5">{operationalInteractions.map((interaction) => <div key={interaction.title} className="rounded-card border border-border bg-surface p-6"><h3 className="font-semibold">{interaction.title}</h3><p className="mt-3 text-sm leading-7 text-ink-muted">{interaction.behavior}</p><p className="mt-4 border-l-2 border-basil pl-4 text-sm leading-7 text-ink-muted">{interaction.limit}</p></div>)}</div>
      <div className="mt-7 rounded-card bg-surface-muted p-6"><h3 className="mb-3 font-semibold">Evidence boundary</h3><p className="text-sm leading-7 text-ink-muted">Pure tests verify aggregation, availability, movement arithmetic, and the adjustment guard. Mocked service tests inspect ordered query calls, reservation lifecycle orchestration, and repeated capture behavior. They do not execute two overlapping PostgreSQL transactions, so this case study does not claim observed lock contention or absence of overselling under a live race.</p></div>
      <EvidenceLinks id="REC-01" />
      <EvidenceLinks id="INV-06" />
    </DocsSection>

    <div className="flex flex-wrap gap-3"><Link to="/docs/decisions" className="docs-button">Continue to engineering decisions</Link><Link to="/docs/order-lifecycle" className="docs-button-secondary"><ArrowLeft size={16} aria-hidden="true" />Back to orders & payments</Link></div>
  </DocsPage>;
}
