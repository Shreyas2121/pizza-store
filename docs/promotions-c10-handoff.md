# C10 implementation handoff

Branch: `feature/promotions-overhaul`. Starting commit: `e87c2a2` (C09).
Prerequisite fix `7ee2839` restricts staff order customer joins to identity
columns, excluding password and authorization metadata.

## Order snapshot projection

All customer/staff list and detail paths load saved promotion applications,
allocations, item customizations and bundle components in one relational query.
Names, prices and allocation explanations come from immutable order snapshots.
Current product images are optional decoration. Explicit DTO projection excludes
cost snapshots, credentials, provider internals and payment attempts.

Reserved, consumed and released application states remain visible as historical
facts. Item discount, delivery savings and display-only bundle markdown remain
separate. The saved grand total is never repriced. Customer payment details now
use saved item subtotal and charged delivery instead of including delivery in
the item subtotal. Customer/staff order pages consume the collection DTO.

Lists are bounded (default 25, maximum 100) with page/limit query validation and
stable date/ID ordering. Customer and staff views include page controls. Tests cover query construction without database access,
all read paths, saved names after definition edits, allocations, bundles,
released applications, safe projection and exact money boundaries.

## Verification and remaining slice

The full workspace preflight runs lint, typecheck, existing tests and production
builds; the snapshot gate passed 895 backend tests across 122 files and 10
frontend tests across 2 files, with zero lint errors (306 backend/3 frontend
existing warnings). New mapper/query/schema tests also pass an additional
TypeScript check including test files. No database checks, migrations, seeds, provider or browser checks are
run, as requested. Existing lint and Vite barrel-import warnings remain.

The second C10 commit removes obsolete coupon persistence/routes/types and
generates the cleanup migration. This handoff will be completed with that slice.
