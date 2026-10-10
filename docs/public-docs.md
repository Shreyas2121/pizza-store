# Public documentation authoring

The React feature at `frontend/src/features/docs/` serves `/docs`, `/docs/architecture`, `/docs/order-lifecycle`, `/docs/inventory`, `/docs/decisions` and `/docs/reliability`. Unknown child paths retain the docs shell and show a not-found page. Content is local and reading does not require authentication or a backend connection.

## Adding or updating content

1. Create a default-export page in `pages/`, wrap it in `DocsPage` and use one h1 with stable `DocsSection` IDs.
2. Register ready page/section metadata in `content/navigation.ts` and a direct lazy child route under DocsLayout in `frontend/src/app/router/routes.tsx`.
3. Inspect the current code for claims. Update [engineering evidence](case-study-evidence.md) and the public subset in `content/evidence.ts` together. Identify mocked/pure/database/browser evidence accurately.
4. Keep feature-local imports relative. Do not import backend modules or another feature's private internals. Keep business socket/chat/modal effects outside docs in the app boundary.

DocsLayout provides navigation, skip link and nested loading/error handling. DocsPage sets title/description and focuses main content for unanchored navigation; the app ScrollManager handles hash scrolling. These source behaviors require browser verification before making accessibility claims.

## Repository evidence links

Optional `VITE_DOCS_REPOSITORY_URL` accepts a public HTTPS GitHub repository root. Without a valid URL, pages display source paths and omit repository actions. Do not invent a repository/deployment URL or include credentials.

Evidence includes the source review date and baseline revision. Current reviews include uncommitted working-tree changes; links resolve the configured published repository's `HEAD`, so they are navigational source references rather than immutable proof of the audited workspace. Publish the matching code before sharing these links; when a frozen evidence release is required, review it and explicitly pin links to that published commit.

## Diagrams and explorer

Use DiagramCard with a title, caption, repository-authored Mermaid source and ordered prose explanation. Store sources in `content/diagrams/`; keep the prose visible during loading/error/print. Keep hyperlinks in React content and do not accept visitor-authored diagram input.

The renderer dynamically imports Mermaid, initializes its theme and serializes rendering. Each render receives a distinct SVG ID/measurement container; cleanup ignores or aborts obsolete work and removes the container after settlement. A failed render does not poison later queue entries. Configuration uses `startOnLoad: false`, strict security and flowchart `htmlLabels: false`.

The inventory explorer uses local React state and a pure deterministic model with replay/reset and static transcripts. Its three scenarios cover successful capture, confirmed failure and provider-checked safe expiry. It illustrates transaction locks versus persisted holds; it does not exercise a live database or provider.

## Hosting and verification

Run `pnpm docs:check` from the repository root after documentation edits. It checks relative file targets, API handler coverage, schema column coverage and public evidence paths against the current files. It does not validate browser behavior, external links or Markdown fragment IDs.

Build with `pnpm --filter frontend build` and serve `frontend/dist`. Preserve actual static-file behavior while falling back to `index.html` for application routes. BrowserRouter direct-route refresh must be tested on the intended host; local navigation/build success is insufficient.

The [current verification record](case-study-verification.md) includes passing frontend tests, typecheck, lint and build. Browser/hosted checks remain separate:

- Direct load/refresh/back/forward, stable hashes, all six routes and unknown child path.
- Logged-out/stored-token docs with the API unavailable; return to business routes and confirm owned effects resume.
- Keyboard/focus, mobile drawer, explorer status/transcript, reduced motion and print.
- Diagram load/render failure/retry; readable prose throughout.
- Source links after publishing the matching repository revision and configuring the URL.

Use [the two-minute walkthrough](case-study-walkthrough.md) for presentation. Retain a screenshot only from an actual verified route, with meaningful alt text and the tested revision. Current owner/contribution facts must come from the maintainer, not inferred documentation.
