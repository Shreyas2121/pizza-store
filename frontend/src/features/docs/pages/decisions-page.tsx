import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";
import { DecisionRecord } from "../components/decision-record";
import { DocsPage, DocsSection } from "../components/docs-page";
import { decisionRecords } from "../content/decisions";
import { reviewedDate, reviewedRevision } from "../content/evidence";
import { docsDecisions } from "../content/navigation";

export default function DecisionsPage() {
  const [assessment, ...decisionSections] = docsDecisions.sections;
  return <DocsPage title={docsDecisions.title} description={docsDecisions.description}>
    <header className="pb-10">
      <p className="docs-eyebrow mb-5">05 / Engineering decisions</p>
      <h1 className="max-w-3xl font-display text-4xl font-normal leading-tight tracking-tight sm:text-5xl">The implementation chose.<br /><span className="text-brand">The costs came with it.</span></h1>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-ink-muted">These records connect the current design to its constraints, alternatives, tradeoffs, and concrete signals for changing course.</p>
      <p className="mt-5 text-xs leading-6 text-ink-muted">Source snapshot: <code>{reviewedRevision.slice(0, 7)}</code>, reviewed {reviewedDate}. Historical design notes were not found, so every record is labelled as a present-day assessment rather than an invented account of original intent.</p>
    </header>

    <DocsSection section={assessment}>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="rounded-card border border-border bg-surface p-6"><h3 className="mb-3 font-semibold">How to read these records</h3><p className="text-sm leading-7 text-ink-muted">“Chosen” describes source that exists at the reviewed revision. “Alternative” is a useful comparison, not proof that the original author rejected it at the time.</p></div>
        <div className="rounded-card border border-border bg-surface p-6"><h3 className="mb-3 font-semibold">A decision remains conditional</h3><p className="text-sm leading-7 text-ink-muted">Each record names a cost and an observable trigger for reconsideration. No production scale, historical motive, or measured performance benefit is inferred.</p></div>
      </div>
    </DocsSection>

    {decisionRecords.map((decision, index) => <DocsSection key={decision.number} section={decisionSections[index]}><DecisionRecord decision={decision} /></DocsSection>)}

    <div className="flex flex-wrap gap-3"><Link to="/docs/reliability" className="docs-button">Continue to reliability evidence</Link><Link to="/docs/inventory" className="docs-button-secondary"><ArrowLeft size={16} aria-hidden="true" />Back to inventory</Link></div>
  </DocsPage>;
}
