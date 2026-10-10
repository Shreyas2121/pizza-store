# Store Staff Authorization Runbook

This runbook describes the implemented store-scoped authorization boundary, staff operations, deployment order, rollback, and verification requirements.

## Identity model

Platform and store authority are separate:

- `users.role` is the platform role and remains `admin | user`.
- `store_memberships.role` is a store role: `manager | finance_manager | payroll_manager | operator | inventory_staff`.
- Staff users retain `users.role = user`. A user can have active memberships in multiple stores.
- Platform admins do not need membership rows and normally bypass store permissions, but platform-only capabilities still require `users.role = admin`. Promotion participation endpoints are an explicit exception: only an active same-store manager can toggle, and platform-admin override is denied.
- Membership status is `active | suspended | revoked`. Only active memberships for active stores grant access.

JWTs contain identity and token-version claims, not memberships or permissions. Every authenticated HTTP request reloads the active user from PostgreSQL. Store authorization then checks the current membership, so suspension or revocation affects the next request without waiting for the JWT to expire.

## Permission matrix

| Capability | Platform admin | Manager | Finance manager | Payroll manager | Operator | Inventory staff |
| --- | --- | --- | --- | --- | --- | --- |
| Operations dashboard | All/global or store | Assigned store | Assigned store | No | Assigned store | Assigned store |
| Finance overview & P&L | All/global or store | Assigned store | Assigned store | No | No | No |
| Expenses (create) | All stores | Assigned store | Assigned store | No | No | No |
| Expenses (approve) | All stores | Assigned store (threshold) | Assigned store | No | No | No |
| Expenses (pay/post) | All stores | No | Assigned store | No | No | No |
| Refunds (request/approve) | All stores | Assigned store (threshold) | Assigned store | No | Request only | No |
| Cash sessions (close/reopen) | All stores | Assigned store | Assigned store | No | Movements only | No |
| Settlements & Reconciliation | All stores | Assigned store (read) | Assigned store | No | No | No |
| General ledger & posting | All stores | No | Assigned store | No | No | No |
| Fiscal period close/reopen | All stores | No | No | No | No | No |
| Standard product costs | All stores | Assigned store | Assigned store | No | No | Read only |
| Payroll profiles & pay runs | All stores | No | No | Assigned store | No | No |
| Read orders | All stores | Assigned store | Assigned store | No | Assigned store | No |
| Update order status | All stores | Assigned store | No | No | Assigned store | No |
| Read inventory | All stores | Assigned store | Assigned store | No | Assigned store | Assigned store |
| Restock/adjust/threshold inventory | All stores | Assigned store | No | No | No | Assigned store |
| Read store-product mappings | All stores | Assigned store | Assigned store | No | Assigned store | Assigned store |
| Map/remove products and update price | All stores | Assigned store | No | No | No | No |
| Update manual availability | All stores | Assigned store | No | No | No | Assigned store |
| Update safe store profile fields | All stores | Assigned store | No | No | No | No |
| Manage delivery zones | All stores | Assigned store | No | No | No | No |
| Read store staff and audit | All stores | Assigned store | No | No | No | No |
| Manage operators/inventory staff | All stores | Assigned store | No | No | No | No |
| Grant, change, or revoke manager/finance/payroll roles | Yes | No | No | No | No | No |
| Global catalogue/promotion definitions/media/analytics/payments/support/system | Yes | No | No | No | No | No |
| Promotion participation toggle | No | Assigned store only | No | No | No | No |

The canonical permission strings and role mapping live in `backend/src/features/access/access.permissions.ts`. Detailed finance/payroll segregation of duties and error codes are mapped in [Finance API compatibility and rollout map](finance-api-compatibility-rollout.md). UI visibility is only a convenience; backend policy remains authoritative.

## Staff workflows

### Assign an existing account

1. Select the target store in the operations workspace.
2. Open **Staff** and choose **Assign user**.
3. Enter the existing account email and an allowed role.
4. Managers can assign only `operator` or `inventory_staff`; platform admins can assign every store role.

Assignment reuses a prior membership row and reactivates suspended or revoked membership. It never changes the user's platform role.

### Invite a user

1. Open **Staff**, choose **Invite staff**, and enter the email and allowed role.
2. The server generates a single-use token, stores only its SHA-256 hash, and defaults expiry to 48 hours (`STAFF_INVITATION_EXPIRY_HOURS`).
3. The recipient signs in or registers with the invited email and opens the acceptance link.
4. Acceptance verifies the authenticated email, store state, expiry, unused state, and role before creating/reactivating membership transactionally.

Production requires an invitation delivery implementation and never returns the raw token. The current default production adapter is `UnavailableInvitationDelivery`, which fails with `INVITATION_DELIVERY_UNAVAILABLE`; a working production delivery adapter is not included. The non-production adapter may return a development URL once to the authorized caller. The frontend holds that URL only in component memory and removes the token from browser history after acceptance. Never copy tokens into logs, tickets, audit metadata, or staff tables.

Resend creates a replacement invitation and revokes the previous pending invitation in the same transaction. Revoke invalidates a pending invitation without deleting its record.

### Change, suspend, reactivate, or revoke

- Managers can change only `operator` and `inventory_staff` roles in their assigned store.
- Platform admins can manage all store roles.
- Suspension is reversible. Revocation retains the membership row and ends access.
- A user cannot elevate their own membership.
- An active store cannot lose its final active manager.
- Successful sensitive changes write allow-listed audit metadata.

Membership changes notify the socket layer after the transaction commits. The current notifier disconnects the affected user's sockets known to the local process adapter; cross-process eviction is not established. A new handshake reloads current memberships and rooms. HTTP membership decisions are also reloaded from the database; neither JWTs nor frontend state cache membership truth.

## Access-token and forced-logout behavior

Access tokens use HS256 with configured issuer and audience and expire after `JWT_EXPIRES_IN` (`4h`, `6h`, or `8h`; default `6h`). Requests reject inactive users and token-version mismatches.

- Membership suspension/revocation blocks store operations on the next HTTP request and disconnects active realtime sessions.
- Account deactivation or a token-version increment invalidates the token itself.
- A normal token expiry returns `401`; the frontend clears auth/access state and requires sign-in again.

Do not add memberships or permission lists to JWT claims.

## Socket.IO audiences

Clients provide only the bearer token in `socket.handshake.auth`. The server authenticates it, loads active memberships, and derives rooms:

| Room | Audience |
| --- | --- |
| `user:{userId}` | The authenticated user |
| `platform-admin` | Platform admins |
| `platform-support` | Platform support/admin audience |
| `store:{storeId}:operations` | Managers, finance managers, operators, and inventory staff |
| `store:{storeId}:orders` | Store managers, finance managers, and operators |
| `store:{storeId}:inventory` | Store managers, finance managers, and inventory staff |

Rooms are delivery audiences, never authorization evidence. Route code chooses the audiences. The room-mapping unit tests do not establish complete delivery: in the current finalizer, some results omit store/user IDs that their callers expect, so webhook/reconciliation delivery falls back to platform admins. See claim RT-02 in [case-study evidence](case-study-evidence.md).

## Development staff seed

The optional staff seed is separate from catalog/user seeds and never runs during application startup:

```bash
cd backend
pnpm run seed:staff -- \
  --actor=admin@pizzastore.com \
  --store=mumbai-central \
  --member=manager:manager@example.com \
  --member=finance_manager:finance@example.com \
  --member=payroll_manager:payroll@example.com \
  --member=operator:operator@example.com \
  --member=inventory_staff:stock@example.com
```

PowerShell can place the command on one line or use backticks for continuation.

The command:

- requires `NODE_ENV=development`;
- requires an existing active platform admin actor, active store slug, and existing active non-admin users;
- creates no users or passwords and never changes `users.role`;
- creates or reactivates membership rows idempotently;
- audits actual membership changes and leaves already-correct rows unchanged;
- runs all requested assignments in one transaction, so a validation failure rolls back the batch.

The seed intentionally does not run as part of `seed`, `seed:catalog`, migrations, or production startup.

## Migration deployment

Migration `backend/migrations/0005_aberrant_captain_midlands.sql` adds the authorization tables. Migration `backend/migrations/0006_blushing_lenny_balinger.sql` extends both role checks with finance and payroll managers.

This portfolio supports fresh databases only. Existing local/demo data is disposable: do not build account reconciliation, role backfills, or compatibility paths for old rows. Migrations are still mandatory because a fresh clone must reproduce the schema from an empty PostgreSQL database.

### Deployment order

1. Create an empty database and apply committed migrations with `pnpm run db:migrate`.
2. Run the deterministic seed/reset flow; do not use `db:push` as a substitute.
3. Deploy the backend and frontend together, then verify `/api/v1/access/me`, role selection, and navigation.
4. Complete the two-store security matrix below.

## Rollback

For this fresh-only portfolio, reset the disposable database, check out the intended application revision, and rerun that revision's committed migration chain and deterministic seeds. Do not hand-edit migration history or use `db:push` to imitate a rollback.

## Verification evidence and limitations

Automated release verification is:

```bash
cd backend
pnpm run typecheck
pnpm test

cd ../frontend
pnpm run lint
pnpm run build
```

The authorization suites use pure policies and mocked services/repositories. Frontend Vitest tests cover keys, transport and UI contracts. A separate PGlite recruiter-seed test covers schema constraints and ledger triggers, but does not establish store-service SQL isolation, multi-connection locks or actual Socket.IO delivery. See [current checks](case-study-verification.md) for the passing baseline and remaining runtime gates.

Redis adapters, Kafka, PostgreSQL RLS, custom roles and external policy engines are not implemented.

### Manual two-store security matrix

This audit did not execute the manual matrix below.

Run this against an isolated staging/local database after migration, never a shared production database. Record tester, date, build SHA, store/user IDs, and pass/fail evidence in the release record.

- [ ] Platform admin can operate both stores and platform-only features.
- [ ] Store 1 manager receives no Store 2 rows, counts, or events.
- [ ] Store 1 operator can read/update Store 1 orders and only read inventory.
- [ ] Store 1 inventory staff can manage inventory/availability but cannot read orders or finance.
- [ ] Store 1 finance manager can execute store finance work but cannot close periods or read payroll.
- [ ] Store 1 payroll manager can execute payroll work but cannot read finance, orders, or inventory.
- [ ] Customer has no staff access.
- [ ] Manager cannot grant managers, deactivate stores, reconcile payments, manage support, or clear data.
- [ ] Guessed cross-store order, movement, membership, and invitation IDs return `404`.
- [ ] Revocation blocks the next HTTP request and removes active store socket access.
- [ ] Invitation accepts once and only for the matching normalized email.
- [ ] Final active manager cannot be removed from an active store.
- [ ] Sensitive success audits commit with the mutation; denied/terminal failures create only the supported separate safe attempt evidence, never a committed success audit.
- [ ] A staff user can still view their own customer orders.
- [ ] Switching stores never displays cached data from the prior store.
- [ ] No sensitive event uses a global broadcast.
- [ ] Clear-all removes staff/invitations/old audit, preserves admins, and writes a new clear event.

The current automated verification does not claim the manual matrix was executed, because it requires migrated two-store data and deliberate state-changing operations.
