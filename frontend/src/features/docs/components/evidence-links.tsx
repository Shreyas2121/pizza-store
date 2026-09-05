import { evidence, sourceUrl, type EvidenceId } from "../content/evidence";

export function EvidenceLinks({ id }: { id: EvidenceId }) {
  const claim = evidence[id];
  return (
    <details className="docs-evidence">
      <summary>Inspect the evidence <span className="font-mono text-xs">{id}</span></summary>
      <div className="mt-4 space-y-3 text-sm">
        <p>{claim.scope}</p>
        <p className="font-medium">{claim.symbol}</p>
        <ul className="space-y-2" aria-label={`${claim.title} source files`}>
          {[claim.source, ...("test" in claim ? [claim.test] : [])].map((path) => {
            const href = sourceUrl(path);
            return <li key={path} className="break-words font-mono text-xs leading-5">
              {href ? <a href={href} className="underline underline-offset-4">{path}</a> : <code>{path}</code>}
            </li>;
          })}
        </ul>
      </div>
    </details>
  );
}
