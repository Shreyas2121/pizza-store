# PizzaStore frontend

React 19 and TypeScript application for the customer storefront, store operations, finance, payroll and public engineering case study. Vite serves development at port 3150 and emits production assets to `dist/`.

## Development

From the repository root:

```sh
pnpm install --frozen-lockfile
# Copy frontend/.env.example to frontend/.env.
pnpm dev:fe
pnpm --filter frontend lint
pnpm --filter frontend typecheck
pnpm --filter frontend test
pnpm --filter frontend build
```

Set `VITE_BACKEND_URL=http://localhost:3000` to the API origin; the Axios client appends `/api/v1`. Optional `VITE_DOCS_REPOSITORY_URL` supplies a public HTTPS GitHub repository root for evidence links. Never place payment, JWT, database or payroll secrets in Vite variables.

## Structure and conventions

- `src/app/` owns layouts, route guards, providers and business-runtime integration.
- `src/features/` owns feature API hooks, models, components and pages. Import another feature through its public barrel where available.
- `src/shared/` owns reusable UI, transport, configuration, formatting and realtime primitives.
- TanStack Query owns server data; Zustand holds authentication and transient client state. React Hook Form/Zod validate supported forms; backend validation remains authoritative.
- Private queries include principal identity; scoped staff queries also include the store. Pass cancellation signals and avoid placeholder data across principals/stores. See [cache isolation](../docs/client-cache-isolation.md).
- Use shared shape-preserving skeletons for initial loading and retain existing content during refresh. See [Loading UI](LOADING.md).
- Display server-provided paise amounts as INR. Keep item savings, delivery savings and bundle compare-at markdown separate. The browser does not calculate the authoritative payable amount.

Routes live in [routes.tsx](src/app/router/routes.tsx). Customer account/cart/checkout screens require authentication; staff routes apply capability/store guards. Login and registration use the global modal, not a dedicated `/login` route.

## Public engineering case study

The `src/features/docs/` feature serves six public `/docs` routes with local content, evidence links, lazy Mermaid rendering and a deterministic inventory explorer. `App` unmounts business socket/chat/modal effects while reading docs. See [authoring guidance](../docs/public-docs.md).

Serve the build as a single-page application with a fallback to `index.html` for application routes. Verify direct loads and refreshes on the actual host. Unit tests and a successful build do not establish browser accessibility or provider integration.
