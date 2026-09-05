# PizzaStore case-study release verification

Date: 2026-09-05 (Asia/Calcutta)

Audited implementation revision: `ea12e57`

This report separates repository evidence from behavior that was actually run.
The audited revision includes the C10 presentation commit `1a1050a` and the
follow-up print-rule fix `ea12e57`. This report and removal of the completed
planning files are documentation-only changes made after that audited revision.

## Release status

| Area | Status | Basis |
| --- | --- | --- |
| Core case-study source | Implemented | Six public route/page/navigation triples, evidence content, deterministic inventory model, explorer, storefront entry point, walkthrough, and hosting guidance are present. |
| Repository integrity | Passed static review | Commit whitespace, registered targets, local file links, evidence paths, page structure, import boundaries, and declared scripts were inspected as recorded below. |
| Frontend tests, lint, and build | Not run | The owner maintained a standing waiver for app, test, lint, build, and browser execution. No current passing result is claimed. |
| Browser and accessibility behavior | Not run | Direct load, refresh, history, API-offline access, keyboard, viewport, focus, reduced-motion, diagram failure, and print behavior remain unobserved. |
| Hosted publication | Unverified | No Git remote, hosting manifest, or deployed URL was available. Hosted SPA fallback was documented but not tested. |
| Portfolio inputs | Incomplete | No actual case-study screenshot or confirmed personal-contribution facts were available. Neither was fabricated. |

Local implementation is source-complete for the six core pages. Publication
readiness is not verified because the required runtime and hosted checks remain
outstanding.

## Static results

### Routes, pages, and navigation

All six expected route registrations, navigation entries, and page files were
found at the audited revision:

| Public route | Router | Navigation | Page source |
| --- | --- | --- | --- |
| `/docs` | Found | Found | Found |
| `/docs/architecture` | Found | Found | Found |
| `/docs/order-lifecycle` | Found | Found | Found |
| `/docs/inventory` | Found | Found | Found |
| `/docs/decisions` | Found | Found | Found |
| `/docs/reliability` | Found | Found | Found |

The nested `/docs/*` not-found route is present. Eight direct lazy imports cover
the docs layout, overview, five child case-study pages, and docs not-found page.
This source structure does not prove production chunk boundaries; no build output
was produced or inspected.

Each of the six standard pages has one `DocsPage` wrapper and one `h1`. Overview,
architecture, order lifecycle, inventory, and reliability have the same number
of rendered `DocsSection` calls as manifest sections. Decisions has one explicit
intro section plus six records rendered through `decisionRecords.map`, matching
its seven manifest sections.

The static target scan found every literal docs link mapped to a published route,
including `#scenario-explorer` and `#store-authority`. The evidence registry's 27
source/test paths all exist. The pre-report Markdown scan resolved all 74 relative
file targets. After adding this report and removing the planning files, a second
scan resolved all 77 relative Markdown targets with no missing files.

### Isolation, metadata, and interaction source

- `App` gates `BusinessRuntime` with the `/docs/*` match. Docs pages remain outside
  storefront socket, chat, and modal effects in source.
- The docs feature has no app, backend, or other-feature imports. Its one aliased
  import is the shared design-token configuration used by the Mermaid renderer.
- `DocsPage` sets title and description metadata and focuses `#docs-main` for
  unanchored page navigation. `DocsLayout` retains a skip link, mobile drawer,
  pathname-keyed content boundary, and loading status. Errors use an alert and
  retain overview/reload actions.
- The inventory explorer uses local React state, labelled native controls, bounded
  previous/next/reset behavior, a polite atomic status region, textual actor and
  lock state, and a full static transcript. The pure model declares three
  deterministic fixtures and contains no network calls, timers, or randomness.
- Source contains reduced-motion and print media rules. Print hides interactive
  controls, exposes evidence and simulation disclosure contents, and keeps the
  page-margin rule at stylesheet top level. These rules were not rendered.

### Declared tooling

The frontend manifest currently declares:

| Purpose | Declared command/version | Execution in C11 |
| --- | --- | --- |
| Model tests | `vitest run` / Vitest `4.1.11` | Not run |
| Lint | `eslint .` | Not run |
| Production build | `tsc -b && vite build` | Not run |
| Mermaid | `11.17.2` | Not rendered |

The detailed [C01 evidence baseline](case-study-evidence.md#test-baseline) remains
historical evidence only. C11 did not rerun backend checks because this release
work changed no backend source, and it did not rerun frontend checks under the
owner's execution waiver.

## Read-only commands and results

These repository-level checks were run from `F:\Shreyas\food`:

```powershell
git status --short
git show --check --oneline ea12e57
git log -4 --oneline
```

`git show --check` reported no whitespace errors. Before the requested final
cleanup, status showed only untracked `plan.md` and
`implementation_plan_docs.md`. Both are absent from the final workspace; the
tracked `guide.md` deletion is recorded in the final documentation commit.

Route, page, and target checks read the files directly with PowerShell:

```powershell
$routesText = Get-Content -Raw frontend/src/app/router/routes.tsx
$navText = Get-Content -Raw frontend/src/features/docs/content/navigation.ts
$routesText.Contains('path="/docs"')
$routesText.Contains('path="*" element={<DocsNotFound')

rg -n '<DocsPage|<h1|<DocsSection' frontend/src/features/docs/pages
rg -n 'to="/docs|to: "/docs' frontend/src/features/docs frontend/src/app/layouts/components/storefront-footer.tsx
```

PowerShell assertions compared the six expected routes against router text,
navigation text, and page existence; all values were true. Additional assertions
counted page wrappers/headings/sections, the six mapped decision records, eight
direct docs lazy imports, and resolved literal route/hash targets.

File-evidence checks used `Test-Path` over regex-extracted targets:

```powershell
$evidenceText = Get-Content -Raw frontend/src/features/docs/content/evidence.ts
$evidencePaths = [regex]::Matches($evidenceText, '(?:source|test): "([^"]+)"')

$markdownFiles = @(Get-Item readme.md; Get-ChildItem -LiteralPath docs -File -Filter *.md)
```

All 27 evidence paths and all 74 relative Markdown targets present before this
report resolved. The final documentation tree was scanned again after adding
this report and removing the planning files.

External-publication inspection used:

```powershell
git remote -v
rg --files -g 'vercel.json' -g 'netlify.toml' -g 'staticwebapp.config.json' -g 'firebase.json' -g 'render.yaml' -g 'fly.toml'
```

No Git remote or listed hosting manifest was found. No screenshot asset named for
the case study was found under `frontend/public/` or `docs/`.

## Checks still required

Run these once dependencies are synchronized and execution is authorized:

```powershell
pnpm.cmd --dir frontend run test
pnpm.cmd --dir frontend run lint
pnpm.cmd --dir frontend run build
```

Record the command, date, revision, environment, exit status, and complete failure
output. If the build succeeds, inspect generated chunks to determine whether each
page is split and Mermaid remains outside the initial storefront path. Direct
lazy imports alone are insufficient evidence.

The release operator should then verify:

1. Direct load, refresh, back/forward, and section links for all six core routes,
   plus an unknown `/docs/*` URL and diagram renderer failure/retry.
2. Logged-out and stored-token visits with the API unavailable, followed by
   navigation to the storefront and back to docs.
3. Keyboard order, visible focus, mobile drawer return focus, simulator controls,
   scenario changes, reset, final disabled state, and live status announcements.
4. Narrow viewports, reduced-motion preference, print preview, evidence expansion,
   and the full selected-scenario transcript.
5. Every internal and evidence link with the final public repository setting.
6. Hosted direct-route refresh after configuring an asset-preserving SPA fallback.
7. A screenshot captured from the actual verified route, with useful alternative
   text and the tested revision recorded alongside it.

Owners for these remaining checks are the project maintainer and release operator
with access to the intended dependency installation and hosting environment.

## Final implementation chain

| Task | Commit | Result |
| --- | --- | --- |
| C01 | `fe1f273` | Evidence audit and dated baseline |
| C02 | `53eb8d0` | Public-docs effect isolation |
| C03 | `71c3e7f` | Docs shell and overview |
| C04 | `ddd393c` | Architecture and lazy diagrams |
| C05 | `e9d5882` | Checkout and payment lifecycle |
| C06 | `bdef64d` | Inventory consistency explanation |
| C07 | `d2f6927` | Decisions and reliability evidence |
| C08 | `85822d5` | Deterministic simulation model and test source |
| C09 | `c94d91c` | Accessible scenario explorer source |
| C10 | `1a1050a` | Discovery, presentation, and walkthrough |
| C11 fix | `ea12e57` | Top-level print page rule before final audit |

C08 through C11 retain verification-pending status because their required
frontend and browser checks were waived. No push or deployment was performed.
