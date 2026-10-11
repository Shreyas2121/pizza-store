import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";
import { DocsPage, DocsSection } from "../components/docs-page";
import { EvidenceLinks } from "../components/evidence-links";
import { reviewedDate, reviewedRevision } from "../content/evidence";
import { failureRows, improvementPriorities, testCategories } from "../content/reliability";
import { docsReliability } from "../content/navigation";

const deploymentLimits = [
  ["Runtime shape", "The Render Free manifest runs one Node/Express process for HTTP and Socket.IO with PostgreSQL. Hosting configuration is supplied; actual deployed behavior remains unverified."],
  ["Runtime requirements", "The backend manifest requires Node.js 22.13.0 or newer. pnpm lockfiles define dependencies; migrations must match the connected PostgreSQL database."],
  ["Optional provider", "Razorpay starts disabled. Enabling new attempts requires the key ID, key secret, and webhook secret; in-flight verification/reconciliation still needs credentials after rollback."],
  ["File storage", "Existing public images are bundled at their original upload paths. Cloudinary stores new images and authenticated private receipts on the free deployment. Local logs and simulator state remain ephemeral."],
  ["Frontend delivery", "The app uses BrowserRouter. The Vercel configuration rewrites deep links to the SPA entry; no hosted refresh check has been performed."],
  ["Verification baseline", "Both package typechecks and production builds pass in the current workspace. A clean-clone install and actual-host browser checks remain separate release evidence."],
] as const;

const failureEvidence = ["PAY-01", "REC-02", "PAY-04", "PAY-05", "REC-01", "REC-03", "INV-03", "ORDER-02", "RT-02", "ACCESS-04", "RT-01"] as const;

export default function ReliabilityPage() {
  const [tests, failures, reconciliation, diagnostics, deployment, improvements] = docsReliability.sections;
  return <DocsPage title={docsReliability.title} description={docsReliability.description}>
    <header className="pb-10">
      <p className="docs-eyebrow mb-5">06 / Reliability & recovery</p>
      <h1 className="max-w-3xl font-display text-4xl font-normal leading-tight tracking-tight sm:text-5xl">Evidence has a scope.<br /><span className="text-brand">Recovery needs an owner.</span></h1>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-ink-muted">This page separates source behavior, executed checks, operational commands, and future improvements so each reliability claim remains reviewable.</p>
      <div className="mt-7 rounded-control border border-border bg-surface-muted p-5 text-sm leading-6 text-ink-muted"><p>Working tree based on <code>{reviewedRevision.slice(0, 7)}</code>, reviewed {reviewedDate}, including uncommitted changes. Source links resolve the published repository HEAD; browser/provider checks remain separate.</p></div>
    </header>

    <DocsSection section={tests}>
      <p className="mb-6 leading-7 text-ink-muted">A test's shape determines what it can support. Passing a pure function or mocked service test does not exercise PostgreSQL locks, network delivery, or browser behavior.</p>
      <div className="overflow-x-auto rounded-card border border-border" tabIndex={0} role="region" aria-label="Test evidence categories and limits, scroll horizontally">
        <table className="w-full min-w-[900px] text-left text-sm leading-6"><caption className="border-b border-border bg-surface px-5 py-4 text-left text-xs text-ink-muted">Current evidence categories. “Missing” identifies an unexecuted runtime check, not a failed automated test.</caption>
          <thead className="bg-surface-muted"><tr>{["Category", "Coverage", "What it establishes", "What remains outside it"].map((heading) => <th key={heading} scope="col" className="px-5 py-4 font-semibold">{heading}</th>)}</tr></thead>
          <tbody>{testCategories.map((category) => <tr key={category.category} className="border-t border-border bg-surface align-top"><th scope="row" className="px-5 py-4 font-medium">{category.category}</th><td className="px-5 py-4"><span className={category.status === "Present" ? "text-basil" : "text-brand"}>{category.status}</span></td><td className="px-5 py-4 text-ink-muted">{category.establishes}</td><td className="px-5 py-4 text-ink-muted">{category.limit}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-card border border-border p-5"><p className="docs-eyebrow mb-3">Recorded passes</p><p className="text-sm leading-7 text-ink-muted">951 backend and 245 frontend tests passed. Both typechecks and production builds passed. Offline reconciliation passed 12 reports, 12 CSV exports and six promotion journals.</p></div>
        <div className="rounded-card border border-border p-5"><p className="docs-eyebrow mb-3">Remaining checks</p><p className="text-sm leading-7 text-ink-muted">Lint passed with zero errors and existing warnings. Full migration-chain, coordinated PostgreSQL races, browser/provider and actual-host checks were not run by this audit.</p></div>
      </div>
      <EvidenceLinks id="TEST-01" />
    </DocsSection>

    <DocsSection section={failures}>
      <p className="mb-6 leading-7 text-ink-muted">The matrix connects a concrete trigger to current behavior, evidence, an operator action, and the boundary that remains unresolved.</p>
      <div className="overflow-x-auto rounded-card border border-border" tabIndex={0} role="region" aria-label="Failure handling and recovery matrix, scroll horizontally">
        <table className="w-full min-w-[1250px] text-left text-sm leading-6"><caption className="sr-only">Current failure behavior, evidence, operational action, and limitations</caption>
          <thead className="bg-surface-muted"><tr>{["Scenario", "Current behavior", "Evidence", "Operational action", "Known limit"].map((heading) => <th key={heading} scope="col" className="px-4 py-4 font-semibold">{heading}</th>)}</tr></thead>
          <tbody>{failureRows.map((row) => <tr key={row.scenario} className="border-t border-border bg-surface align-top"><th scope="row" className="px-4 py-4 font-medium">{row.scenario}</th><td className="px-4 py-4 text-ink-muted">{row.currentBehavior}</td><td className="px-4 py-4 font-mono text-xs">{row.evidence.join(" · ")}</td><td className="px-4 py-4 text-ink-muted">{row.operationalAction}</td><td className="px-4 py-4 text-ink-muted">{row.limit}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="mt-2">{failureEvidence.map((id) => <EvidenceLinks key={id} id={id} />)}</div>
    </DocsSection>

    <DocsSection section={reconciliation}>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="rounded-card border border-border bg-surface p-6"><p className="docs-eyebrow mb-3">Stale payments</p><h3 className="break-all font-mono text-sm">pnpm.cmd --dir backend run payments:reconcile</h3><p className="mt-4 text-sm leading-7 text-ink-muted">Scans processing/failed Razorpay attempts. It can attach an order found by deterministic receipt, fetch provider state, and finalize or record failure. Defaults: older than 15 minutes, limit 25; maximum limit 50.</p></div>
        <div className="rounded-card border border-border bg-surface p-6"><p className="docs-eyebrow mb-3">Expired reservations</p><h3 className="break-all font-mono text-sm">pnpm.cmd --dir backend run inventory:reconcile-reservations</h3><p className="mt-4 text-sm leading-7 text-ink-muted">Scans expired reserved rows, checks provider state, and finalizes, preserves, or safely releases. Default limit 25; maximum 100. Persisted payment-attempt deadlines also discover awaiting-payment orders without tracked-stock rows.</p></div>
      </div>
      <div className="mt-6 rounded-card bg-surface-muted p-6"><h3 className="mb-3 font-semibold">Recovery while the backend is awake</h3><p className="text-sm leading-7 text-ink-muted">One-shot commands print summary and per-item JSON and close the database connection. They exit non-zero when <code>errors &gt; 0</code>. A failed payment outcome, unchanged result, or reservation conflict is not included in that exit test, so operators must inspect the full result.</p><p className="mt-3 text-sm leading-7 text-ink-muted">The Render Free manifest enables maintenance at startup: posting every minute, reservation recovery every five minutes, and payment recovery every five minutes in Razorpay test mode. Timers pause when Render sleeps. Actual hosted schedules remain unverified.</p></div>
      <EvidenceLinks id="REC-01" /><EvidenceLinks id="REC-02" /><EvidenceLinks id="REC-03" />
    </DocsSection>

    <DocsSection section={diagnostics}>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="rounded-card border border-border p-6"><h3 className="mb-3 font-semibold">Identifiers that connect the flow</h3><ul className="list-disc space-y-2 pl-5 text-sm leading-7 text-ink-muted"><li>Local order and payment IDs</li><li>Client request ID and deterministic receipt</li><li>Provider order and payment IDs</li><li>Webhook event ID and event type</li><li>Failure code, description, and provider status</li></ul></div>
        <div className="rounded-card border border-border p-6"><h3 className="mb-3 font-semibold">Logs and command output</h3><p className="text-sm leading-7 text-ink-muted">Winston writes console output plus dated <code>error.log</code> and <code>combined.log</code> files. HTTP logs include method, URL, status, and duration. Payment errors add relevant local/provider IDs; webhook logs add event ID/type. Reconciliation returns per-item JSON.</p></div>
      </div>
      <p className="mt-6 text-sm leading-7 text-ink-muted">Request middleware retains a valid caller UUID or generates X-Request-ID for safe audit correlation. Protected finance metrics and local/provider identifiers support diagnosis; centralized aggregation, retention and complete distributed tracing are not supplied.</p>
      <EvidenceLinks id="OPS-01" />
    </DocsSection>

    <DocsSection section={deployment}>
      <div className="overflow-x-auto rounded-card border border-border" tabIndex={0} role="region" aria-label="Deployment assumptions and current limits">
        <table className="w-full min-w-[720px] text-left text-sm leading-6"><caption className="sr-only">Current runtime assumptions and unverified deployment behavior</caption>
          <thead className="bg-surface-muted"><tr><th scope="col" className="px-5 py-4 font-semibold">Concern</th><th scope="col" className="px-5 py-4 font-semibold">Established source or limitation</th></tr></thead>
          <tbody>{deploymentLimits.map(([concern, detail]) => <tr key={concern} className="border-t border-border bg-surface align-top"><th scope="row" className="px-5 py-4 font-medium">{concern}</th><td className="px-5 py-4 text-ink-muted">{detail}</td></tr>)}</tbody>
        </table>
      </div>
      <EvidenceLinks id="ARCH-01" /><EvidenceLinks id="REC-03" /><EvidenceLinks id="TEST-01" />
    </DocsSection>

    <DocsSection section={improvements}>
      <p className="mb-6 leading-7 text-ink-muted">These are proposed changes, ordered by release risk and triggered by concrete conditions. They do not describe current behavior.</p>
      <div className="space-y-4">{improvementPriorities.map((item) => <div key={item.title} className="grid gap-4 rounded-card border border-border bg-surface p-6 sm:grid-cols-[auto_1fr]"><span className="h-fit rounded-full bg-surface-muted px-3 py-1 font-mono text-xs font-semibold text-brand">{item.priority}</span><div><h3 className="font-semibold">{item.title}</h3><p className="mt-2 text-sm leading-7 text-ink-muted"><strong className="text-ink">Trigger:</strong> {item.trigger}</p><p className="mt-2 text-sm leading-7 text-ink-muted"><strong className="text-ink">Proposed change:</strong> {item.change}</p></div></div>)}</div>
    </DocsSection>

    <Link to="/docs/decisions" className="docs-button-secondary"><ArrowLeft size={16} aria-hidden="true" />Back to decisions</Link>
  </DocsPage>;
}
