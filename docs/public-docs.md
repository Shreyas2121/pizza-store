# Public documentation authoring

The public case study starts at `/docs`. Its React feature lives in
`frontend/src/features/docs/`. Published pages are `/docs` (overview),
`/docs/architecture`, `/docs/order-lifecycle`, and `/docs/inventory`. Unknown
child paths retain the docs shell and display a not-found message.

## Adding a page

1. Create a page with a default export in the feature's `pages/` directory.
2. Wrap content in `DocsPage` with a title and description. Use one `h1` and
   stable section IDs through `DocsSection`.
3. Register the page and section metadata in `content/navigation.ts` only when
   the content is ready. Add its direct lazy import and child route beneath
   `DocsLayout` in `frontend/src/app/router/routes.tsx` in the same change.
4. Keep claims consistent with [case-study evidence](case-study-evidence.md).
   Extend the public subset in `content/evidence.ts` when needed. Link claims
   to actual source/test paths and identify what the evidence does not prove.

Keep feature-internal imports relative. Docs must not import app modules,
backend modules, or other features' private internals. Content is local React
and TypeScript data; no API calls or authentication are required for reading.

`DocsLayout` provides navigation and a nested content loading/error boundary.
The page boundary resets on pathname changes. Failed lazy imports can be retried
with a page reload. The existing app `ScrollManager` owns heading scrolling;
the page wrapper sets metadata and focuses main content on unanchored navigation.

## Optional repository links

Set `VITE_DOCS_REPOSITORY_URL` in frontend build-time configuration to the actual
public HTTPS GitHub repository URL, in the form `https://github.com/OWNER/REPO`.
This is public configuration and must not contain credentials. It is optional;
without a valid URL, the page displays source paths and omits repository actions.

Evidence links are pinned to `reviewedRevision` in `content/evidence.ts`. Do not
replace that revision automatically with the latest commit: audit the claims
first, especially after the financial rework merges. Keep the date and detailed
Markdown evidence record synchronized.

## Diagram authoring

Use `DiagramCard` with a title, caption, ordered prose explanation, and a
repository-authored Mermaid string. Diagram data lives in `content/diagrams/`.
The prose is always visible, including loading, error, and print states. Source
is available in a separate disclosure. Keep hyperlinks in React content outside
the SVG and never accept arbitrary visitor-authored diagram input here.

`lib/mermaid-renderer.ts` dynamically imports Mermaid on first render, initializes
the shared theme once, and serializes rendering. Every render gets a distinct
SVG ID and its own temporary measurement container. Effect cleanup aborts
pending work or ignores an in-progress result; the renderer removes the container
when that work settles. A failed render does not poison the queue. Renderer-level
errors offer a retry without replacing the documentation page.

Mermaid is configured with `startOnLoad: false`, `securityLevel: "strict"`, and
`htmlLabels: false` for flowcharts. API references:
[Mermaid usage](https://mermaid.js.org/config/usage.html) and
[strict security configuration](https://mermaid.js.org/config/schema-docs/config-properties-securitylevel.html).
The architecture page uses ordinary flowchart syntax for C4-style views;
the [C4 container convention](https://c4model.com/diagrams/container) describes
logical applications/data stores rather than a specific Docker deployment.

C04 adds exact dependency `mermaid@11.17.2` using pnpm's `--lockfile-only
--ignore-scripts` mode. The package manifest and generated lockfile are committed;
the local installed dependency tree was not synchronized. Before a future run,
install the committed frontend dependencies through the normal project setup.
Do not assume the owner's existing dependency mismatch has been repaired.

## Current verification scope

C03 lint passed with three existing warnings. No browser or hosted refresh
verification was completed. The owner requested that further runtime/build/test
runs be skipped during this phase. Source structure implements public routing,
responsive navigation, and backend-independent content, but these are not claims
of observed browser behavior. The earlier financial/dependency baseline remains
documented in the evidence audit.

C04 used source review only, as requested. No lint, build, diagram execution,
browser, or bundle inspection was run. Dynamic imports provide the intended
loading boundary in source; no measured claim about storefront chunk isolation,
diagram timing, or Strict Mode behavior is made until runtime checks are requested.

C05 adds COD, online initiation, capture, and order-state diagrams, a separate
payment-state comparison, cancellation effects, and recovery scenarios. Content
and evidence remain pinned to the audited source revision; re-audit after the
financial branch merges. Failed webhook claims can be reclaimed immediately;
the five-minute stale window applies to processing claims. This phase used
source review only: no lint, build, tests, or diagram/browser execution.

C06 adds the tracked/untracked stock model, manual availability boundary,
displayed-availability formula, cross-path lock table, synthetic movement
ledger, static last-item walkthrough, and current expiry/admin interactions.
The page explicitly separates transaction-scoped row locks from persisted
reservations and does not claim global deadlock freedom or live database
contention coverage. Relevant source was re-read; runtime checks remain skipped
under the owner's standing direction.

For a future authorized browser review, check direct/refresh access, existing
auth-token visits, mobile drawer keyboard/focus behavior, section links,
unknown docs paths, content-load failures, and navigation back to business routes.
Hosted SPA fallback configuration must be checked separately from local routes.
