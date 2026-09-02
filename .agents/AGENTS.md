# PizzaStore — Agent Instructions

> Portfolio project — no Docker, no CI provider, no deploy pipeline.

## Repo Layout

```
backend/    Express 5 + Drizzle ORM + PostgreSQL + Zod 4 + Vitest
frontend/   React 19 + Vite + Mantine + Tailwind + TanStack Query + Zustand
docs/       Architecture docs and rollout plans
guide.md    Financial overhaul execution guide (agent-facing)
plan.md     Product decision document (business-facing)
```

## How to Run Things

All commands run from repo root via pnpm workspace orchestration:

| Action | Command |
|---|---|
| **Full preflight** (before every commit) | `pnpm preflight` |
| Lint both packages | `pnpm lint` |
| Typecheck both packages | `pnpm typecheck` |
| Run all tests | `pnpm test` |
| Production build | `pnpm build` |
| Dev servers (both) | `pnpm dev` |
| Backend only dev | `pnpm dev:be` |
| Frontend only dev | `pnpm dev:fe` |
| DB push schema | `pnpm db:push` |
| DB seed | `pnpm db:seed` |

## Commit Convention

Follow conventional commits with scoped prefixes:

```
feat(scope): description
fix(scope): description
refactor(scope): description
test(scope): description
docs(scope): description
chore(scope): description
```

One commit = one coherent, reviewable behavior. Never mix unrelated changes.

## Testing Policy

- **Backend**: Vitest unit tests required for all services and business logic
- **Frontend**: Lint + TypeScript + Vite build only. No frontend test framework unless the user changes this decision.

## Data Policy

- Fresh databases only. No backfills, no production upgrade paths.
- Reproducible schema migrations and deterministic seeds.

## Financial Domain

Money is always **integer paise** in domain/persistence logic. Never use floats for money. Convert to formatted INR only at presentation boundaries. Never trust a browser-calculated price.

See `guide.md` for the full financial overhaul execution sequence.
See `plan.md` for product decisions and business definitions.
