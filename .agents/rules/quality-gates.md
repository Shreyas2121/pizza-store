---
trigger: always_on
description: SD
---

# Quality Gates

## Before Every Commit

Run all four checks and ensure zero errors:

1. `pnpm lint` — ESLint on both FE and BE, zero errors required
2. `pnpm typecheck` — TypeScript on both FE and BE, zero errors required
3. `pnpm test` — All Vitest tests green (backend and frontend)
4. `pnpm build` — Clean production build (FE: tsc + vite, BE: tsc)

**Shortcut**: `pnpm preflight` runs all four in sequence. After documentation changes, also run `pnpm docs:check`; its coverage checks do not replace reading code for prose accuracy.

## Package-Specific Commands

| Gate | Backend | Frontend |
|---|---|---|
| Lint | `pnpm lint:be` | `pnpm lint:fe` |
| Typecheck | `pnpm --filter backend typecheck` | `pnpm --filter frontend typecheck` |
| Test | `pnpm test:be` | `pnpm --filter frontend test` |
| Build | `pnpm --filter backend build` | `pnpm --filter frontend build` |

## What Must Never Be Committed

- Failing tests or type errors
- Generated junk or debug logging
- Secrets, credential-bearing `.env` files, database dumps. Placeholder-only `.env.example` files are allowed.
- Payment payloads, private receipt/payroll data

- Files unrelated to the commit's stated scope