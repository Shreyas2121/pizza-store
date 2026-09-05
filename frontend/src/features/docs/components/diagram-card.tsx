import { useId } from "react";
import { MermaidDiagram } from "./mermaid-diagram";

export interface DiagramDefinition {
  title: string;
  caption: string;
  explanation: readonly string[];
  source: string;
  wide?: boolean;
}

export function DiagramCard({ diagram }: { diagram: DiagramDefinition }) {
  const titleId = useId();
  return <figure aria-labelledby={titleId} className="docs-diagram-card overflow-hidden rounded-card border border-border bg-surface">
    <div className="border-b border-border px-6 py-5">
      <h3 id={titleId} className="font-semibold">{diagram.title}</h3>
      <p className="mt-2 text-xs leading-5 text-ink-muted">Wide diagrams scroll horizontally. The same flow is explained below.</p>
    </div>
    <MermaidDiagram source={diagram.source} title={diagram.title} wide={diagram.wide} />
    <figcaption className="border-t border-border px-6 py-5 text-sm leading-6">
      <p className="font-medium">{diagram.caption}</p>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-ink-muted">
        {diagram.explanation.map((step) => <li key={step}>{step}</li>)}
      </ol>
    </figcaption>
    <details className="docs-diagram-source border-t border-border px-6 py-4">
      <summary className="cursor-pointer text-sm font-medium">Diagram source (Mermaid)</summary>
      <pre className="mt-4 overflow-x-auto rounded-control bg-canvas p-4 text-xs leading-6" tabIndex={0} aria-label={`${diagram.title} Mermaid source`}><code>{diagram.source}</code></pre>
    </details>
  </figure>;
}
