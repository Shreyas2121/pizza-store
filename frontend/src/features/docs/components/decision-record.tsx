import type { DecisionRecord as Decision } from "../content/decisions";
import { EvidenceLinks } from "./evidence-links";

export function DecisionRecord({ decision }: { decision: Decision }) {
  return <div className="rounded-card border border-border bg-surface p-6 sm:p-8">
    <div className="mb-6 flex flex-wrap items-start justify-between gap-5">
      <div><p className="docs-eyebrow mb-3">Decision {decision.number}</p><h3 className="max-w-2xl text-xl font-semibold tracking-tight sm:text-2xl">{decision.title}</h3></div>
      <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-ink-muted">Present-day assessment</span>
    </div>
    <div className="grid gap-6 sm:grid-cols-2">
      <div><h4 className="text-sm font-semibold">Context</h4><p className="mt-2 text-sm leading-7 text-ink-muted">{decision.context}</p></div>
      <div><h4 className="text-sm font-semibold">Constraints</h4><ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-7 text-ink-muted">{decision.constraints.map((constraint) => <li key={constraint}>{constraint}</li>)}</ul></div>
      <div><h4 className="text-sm font-semibold">Chosen approach</h4><p className="mt-2 text-sm leading-7 text-ink-muted">{decision.chosenApproach}</p></div>
      <div><h4 className="text-sm font-semibold">Alternative considered</h4><p className="mt-2 text-sm leading-7 text-ink-muted">{decision.alternative}</p></div>
      <div><h4 className="text-sm font-semibold">Cost accepted</h4><p className="mt-2 text-sm leading-7 text-ink-muted">{decision.cost}</p></div>
      <div><h4 className="text-sm font-semibold">Conditions for revisiting</h4><p className="mt-2 text-sm leading-7 text-ink-muted">{decision.revisit}</p></div>
    </div>
    <div className="mt-2">{decision.evidence.map((id) => <EvidenceLinks key={id} id={id} />)}</div>
  </div>;
}
