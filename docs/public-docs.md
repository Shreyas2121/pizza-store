# Public documentation authoring

The public case study starts at `/docs`. Its React feature lives in
`frontend/src/features/docs/`. Published pages are `/docs` (overview),
`/docs/architecture`, `/docs/order-lifecycle`, `/docs/inventory`,
`/docs/decisions`, and `/docs/reliability`. Unknown child paths retain the docs
shell and display a not-found message.

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

Source-behavior evidence links are pinned to `reviewedRevision` in
`content/evidence.ts`. A claim may specify its own reviewed revision when its
source artifact was added later, as TEST-01 does for the C01 audit document. Do
not replace revisions automatically with the latest commit: audit the claim
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

C07 publishes six explicitly retrospective decision assessments and a separate
reliability evidence page. Reliability content classifies pure, mocked,
database-integration, and browser evidence; maps failure handling to operator
actions and limitations; records the exact one-shot reconciliation commands;
and separates current diagnostics/deployment gaps from triggered proposals.
`docs/setup.md` and the Razorpay runbook were corrected to match package scripts,
route gaps, exit behavior, and diagnostic identifiers. This phase used source
and diff review only under the owner's standing direction.

C08 adds a React-free deterministic inventory model with three replayable
scenarios: successful capture, confirmed payment failure, and provider-checked
safe expiry. Its fixtures preserve the audited distinction between transaction
locks and committed reservations, require Customer B to start a new attempt
after release, and reject capture once expiry has released the reservation.
Vitest `4.1.11` and `pnpm run test` are declared for focused invariant tests.
Those tests, lint, and build were not executed under the owner's standing
direction, so their results remain unverified until a later authorized run.

C09 mounts that model on `/docs/inventory` as an accessible teaching explorer.
Native scenario and replay controls update textual inventory, actor, lock, and
event-log views through a polite status region. The selected scenario also has
an always-available full transcript; print styles omit the controls and force
the transcript content to remain visible. The explorer has no timers, API calls,
global store, or color-only state. Reduced-motion styles suppress incidental
transitions. Source and diff review were completed, while tests, lint, build,
browser, keyboard, narrow-viewport, and print execution remain unverified under
the owner's standing direction.

C10 adds the storefront footer entry point, direct landing-page links into the
three evidence stories, a README case-study entry, hosting guidance, and the
two-minute walkthrough. Print rules expose evidence disclosures and allow long
sections to paginate while keeping smaller cards together. No Git remote,
hosting manifest, deployed URL, verified screenshot, or supplied ownership facts
were found, so those actions and claims remain absent. Source/link review was
completed; runtime presentation checks remain under the same execution waiver.

C11 records the final static audit against revision `ea12e57` in
`docs/case-study-verification.md`. Route/navigation/page registration, wrapper and
heading structure, literal docs targets, evidence paths, relative Markdown links,
feature boundaries, declared scripts, and publication inputs were inspected.
The report keeps local source completion separate from publication readiness.
All frontend commands, browser/accessibility behavior, build chunk inspection,
hosted fallback, and screenshot capture remain pending under the owner's waiver.
The completed root planning files were removed at the owner's request; this
verification report is the durable release-status record.

For a future authorized browser review, check direct/refresh access, existing
auth-token visits, mobile drawer keyboard/focus behavior, section links,
unknown docs paths, content-load failures, and navigation back to business routes.
Hosted SPA fallback configuration must be checked separately from local routes.
