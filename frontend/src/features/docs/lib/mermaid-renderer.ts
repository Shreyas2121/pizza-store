import { designTokens } from "@/shared/config";

type Mermaid = (typeof import("mermaid"))["default"];
let library: Promise<Mermaid> | undefined;
let renderQueue: Promise<unknown> = Promise.resolve();
let nextDiagramId = 0;

function getMermaid() {
  if (!library) {
    library = import("mermaid").then(({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        suppressErrorRendering: true,
        theme: "base",
        // System fonts avoid waiting on external font downloads for measurement.
        fontFamily: "Arial, sans-serif",
        themeVariables: {
          primaryColor: designTokens.brandSoft,
          primaryTextColor: designTokens.ink,
          primaryBorderColor: designTokens.brand,
          lineColor: designTokens.inkMuted,
          secondaryColor: designTokens.basilSoft,
          tertiaryColor: designTokens.surface,
          mainBkg: designTokens.surface,
          textColor: designTokens.ink,
          clusterBkg: designTokens.surfaceMuted,
          clusterBorder: designTokens.border,
          actorBkg: designTokens.surface,
          actorBorder: designTokens.inkMuted,
          actorTextColor: designTokens.ink,
          signalColor: designTokens.ink,
          signalTextColor: designTokens.ink,
          noteBkgColor: designTokens.basilSoft,
          noteTextColor: designTokens.ink,
          noteBorderColor: designTokens.basil,
        },
        flowchart: { htmlLabels: false, useMaxWidth: true },
        sequence: { useMaxWidth: true, wrap: true },
      });
      return mermaid;
    }).catch((error: unknown) => {
      library = undefined;
      throw error;
    });
  }
  return library;
}

// Serialize renders because Mermaid shares configuration and rendering state.
// Aborted effects cannot publish SVG or leave temporary measurement DOM behind.
export function renderDocsDiagram(source: string, signal: AbortSignal): Promise<string> {
  const task = renderQueue.then(async () => {
    signal.throwIfAborted();
    const mermaid = await getMermaid();
    signal.throwIfAborted();
    const host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    Object.assign(host.style, {
      position: "fixed",
      left: "-10000px",
      top: "0",
      width: "1024px",
      visibility: "hidden",
      pointerEvents: "none",
    });
    document.body.append(host);
    try {
      const { svg } = await mermaid.render(`docs-diagram-${++nextDiagramId}`, source, host);
      signal.throwIfAborted();
      return svg;
    } finally {
      host.remove();
    }
  });
  renderQueue = task.catch(() => undefined);
  return task;
}
