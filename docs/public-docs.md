# Public documentation authoring

The public case study starts at `/docs`. Its React feature lives in
`frontend/src/features/docs/`. The overview is currently the only published page;
unknown child paths retain the docs shell and display a not-found message.

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

## Current verification scope

C03 lint passed with three existing warnings. No browser or hosted refresh
verification was completed. The owner requested that further runtime/build/test
runs be skipped during this phase. Source structure implements public routing,
responsive navigation, and backend-independent content, but these are not claims
of observed browser behavior. The earlier financial/dependency baseline remains
documented in the evidence audit.

For a future authorized browser review, check direct/refresh access, existing
auth-token visits, mobile drawer keyboard/focus behavior, section links,
unknown docs paths, content-load failures, and navigation back to business routes.
Hosted SPA fallback configuration must be checked separately from local routes.
