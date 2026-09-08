import { useEffect, useState } from "react";
import { renderDocsDiagram } from "../lib/mermaid-renderer";

type RenderState =
  | { source: string; status: "ready"; svg: string }
  | { source: string; status: "error" };

export function MermaidDiagram({ source, title, wide = false }: {
  source: string;
  title: string;
  wide?: boolean;
}) {
  const [result, setResult] = useState<RenderState | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    renderDocsDiagram(source, controller.signal).then(
      (svg) => {
        if (!controller.signal.aborted) setResult({ source, status: "ready", svg });
      },
      () => {
        if (!controller.signal.aborted) setResult({ source, status: "error" });
      },
    );
    return () => controller.abort();
  }, [source, attempt]);

  if (!result || result.source !== source) {
    return <p role="status" className="px-5 py-12 text-sm text-ink-muted">Drawing diagram… The explanation below is already available.</p>;
  }
  if (result.status === "error") {
    return <div className="space-y-3 p-6">
      <p role="status" className="text-sm text-ink-muted">This diagram could not render. Read its explanation below or expand the diagram source.</p>
      <button type="button" className="docs-button-secondary" onClick={() => {
        setResult(null);
        setAttempt((value) => value + 1);
      }}>Retry diagram</button>
    </div>;
  }

  return <div className="docs-diagram-scroll" tabIndex={0} role="region" aria-label={`${title}: scrollable diagram`}>
    <div role="img" aria-label={title} className={wide ? "docs-diagram-svg docs-diagram-wide" : "docs-diagram-svg"}>
      {/* Only repository-authored source rendered by Mermaid in strict mode. */}
      <div aria-hidden="true" dangerouslySetInnerHTML={{ __html: result.svg }} />
    </div>
  </div>;
}
