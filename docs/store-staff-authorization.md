# Store Staff Authorization Runbook

This runbook describes the implemented store-scoped authorization boundary, staff operations, deployment order, rollback, and verification requirements.

## Identity model

Platform and store authority are separate:

- `users.role` is the platform role and remains `admin | user`.
- `store_memberships.role` is a store role: `manager | finance_manager | payroll_manager | operator | inventory_staff`.
- Staff users retain `users.role = user`. A user can have active memberships in multiple stores.
- Platform admins do not need membership rows and bypass store permissions, but platform-only capabilities still require `users.role = admin`.
- Membership status is `active | suspended | revoked`. Only active memberships for active stores grant access.

JWTs contain identity and token-version claims, not memberships or permissions. Every authenticated HTTP request reloads the active user from PostgreSQL. Store authorization then checks the current membership, so suspension or revocation affects the next request without waiting for the JWT to expire.

## Permission matrix

| Capability | Platform admin | Manager | Finance manager | Payroll manager | Operator | Inventory staff |
| --- | --- | --- | --- | --- | --- | --- |
| Operations dashboard | All/global or store | Assigned store | Assigned store | No | Assigned store | Assigned store |
| Finance overview & P&L | All/global or store | Assigned store | Assigned store | No | No | No |
| Expenses (create/approve) | All stores | Assigned store (threshold) | Assigned store | No | No | No |
| Expenses (pay/post) | All stores | No | Assigned store | No | No | No |
| Refunds (request/approve) | All stores | Assigned store (threshold) | Assigned store | No | Request only | No |
| Cash sessions (close/reopen) | All stores | Assigned store | Assigned store | No | Movements only | No |
| Settlements & Reconciliation | All stores | Assigned store (read) | Assigned store | No | No | No |
| General ledger & posting | All stores | No | Assigned store | No | No | No |
| Fiscal period close/reopen | All stores | No | No | No | No | No |
| Standard product costs | All stores | Assigned store | Assigned store | No | No | Read only |
| Payroll profiles & pay runs | All stores | No | No | Assigned store | No | No |
| Read/update orders | All stores | Assigned store | Assigned store | No | Assigned store | No |
| Read inventory | All stores | Assigned store | Assigned store | No | Assigned store | Assigned store |
| Restock/adjust/threshold inventory | All stores | Assigned store | No | No | No | Assigned store |
| Read store-product mappings | All stores | Assigned store | Assigned store | No | Assigned store | Assigned store |
| Map/remove products and update price | All stores | Assigned store | No | No | No | No |
| Update manual availability | All stores | Assigned store | No | No | No | Assigned store |
| Update safe store profile fields | All stores | Assigned store | No | No | No | No |
| Manage delivery zones | All stores | Assigned store | No | No | No | No |
| Read store staff and audit | All stores | Assigned store | No | No | No | No |
| Manage operators/inventory staff | All stores | Assigned store | No | No | No | No |
| Grant, change, or revoke managers | Yes | No | No | No | No | No |
| Global catalog/coupons/payments/support/system | Yes | No | No | No | No | No |

The canonical permission strings and role mapping live in `backend/src/features/access/access.permissions.ts`. Detailed finance/payroll segregation of duties and error codes are mapped in [Finance API compatibility and rollout map](finance-api-compatibility-rollout.md). UI visibility is only a convenience; backend policy remains authoritative.

## Staff workflows

### Assign an existing account

1. Select the target store in the operations workspace.
2. Open **Staff** and choose **Assign user**.
3. Enter the existing account email and an allowed role.
4. Managers can assign only `operator` or `inventory_staff`; platform admins can also assign `manager`.

Assignment reuses a prior membership row and reactivates suspended or revoked membership. It never changes the user's platform role.

### Invite a user

1. Open **Staff**, choose **Invite staff**, and enter the email and allowed role.
2. The server generates a single-use token, stores only its SHA-256 hash, and defaults expiry to 48 hours (`STAFF_INVITATION_EXPIRY_HOURS`).
3. The recipient signs in or registers with the invited email and opens the acceptance link.
4. Acceptance verifies the authenticated email, store state, expiry, unused state, and role before creating/reactivating membership transactionally.

Production requires a configured invitation delivery implementation and never returns the raw token. The non-production adapter may return a development URL once to the authorized caller. The frontend holds that URL only in component memory and removes the token from browser history after acceptance. Never copy tokens into logs, tickets, audit metadata, or staff tables.

Resend creates a replacement invitation and revokes the previous pending invitation in the same transaction. Revoke invalidates a pending invitation without deleting its record.

### Change, suspend, reactivate, or revoke

- Managers can change only lower-privilege roles in their assigned store.
- Platform admins can manage all store roles.
- Suspension is reversible. Revocation retains the membership row and ends access.
- A user cannot elevate their own membership.
- An active store cannot lose its final active manager.
- Successful sensitive changes write allow-listed audit metadata.

Membership changes disconnect the affected user's active sockets. A reconnect reloads current memberships and rooms. HTTP membership decisions are also reloaded from the database; neither JWTs nor frontend state cache membership truth.

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
| `store:{storeId}:operations` | All active staff for that store |
| `store:{storeId}:orders` | Store managers and operators |
| `store:{storeId}:inventory` | Store managers and inventory staff |

Rooms are delivery audiences, never authorization evidence. Order, inventory, support, chat, and payment events target their authoritative user/store audiences; sensitive events do not use global broadcasts.

## Development staff seed

The optional staff seed is separate from catalog/user seeds and never runs during application startup:

```bash
cd backend
pnpm run seed:staff -- \
  --actor=admin@pizzastore.com \
  --store=mumbai-central \
  --member=manager:manager@example.com \
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

Migration `backend/migrations/0005_aberrant_captain_midlands.sql` adds token versioning, case-insensitive email uniqueness, store memberships, invitations, and audit logs.

### Preflight

Back up the database and run this before applying the migration:

```sql
SELECT lower(email), count(*)
FROM users
GROUP BY lower(email)
HAVING count(*) > 1;
```

If any rows are returned, stop. Reconcile duplicate accounts manually before creating the unique `lower(email)` index. Do not automatically merge users, orders, addresses, or credentials.

### Deployment order

1. Deploy the database backup and complete the duplicate-email preflight.
2. Apply committed migrations with `pnpm run db:migrate`. Do not regenerate migration SQL during deployment.
3. Deploy the backend. Confirm JWT issuer/audience/expiry, frontend URL, and invitation delivery configuration.
4. Deploy the frontend in the same release window so Socket.IO handshake authentication and capability navigation remain compatible.
5. Sign in as an existing platform admin and verify `/api/v1/access/me`, global navigation, and store selection.
6. Assign a replacement manager before removing an existing final manager.
7. Complete the two-store security matrix below before broad staff rollout.

Existing platform admins remain usable because `users.role` is unchanged and `token_version` defaults to `0`.

## Rollback

Prefer an application rollback that keeps the migrated schema and data:

1. Stop staff assignment/invitation changes and retain a database backup.
2. Roll back frontend and backend together to a version compatible with the deployed Socket.IO handshake.
3. Leave `store_memberships`, `store_staff_invitations`, `audit_logs`, and `users.token_version` intact. Older code ignores additive tables/columns, and preserving them avoids destroying staff/audit history.
4. Keep authorization endpoints unavailable until the authorization-aware backend is restored.
5. Diagnose and forward-fix, then redeploy in the documented order.

Do not drop authorization tables or the case-insensitive email index as an incident response. A schema rollback requires a separately reviewed data-preservation migration and restore plan.

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

The repository currently has backend unit tests with mocked repositories/services and no new frontend test harness. These tests validate policy behavior but cannot prove PostgreSQL row locks, transaction isolation, partial/unique constraints, SQL scoping, or multi-process Socket.IO behavior. Database-backed integration coverage remains future work.

Redis adapters, Kafka, PostgreSQL RLS, custom roles, and external policy engines are deliberately deferred.

Commit verification recorded on 2026-08-30:

| Check | Result |
| --- | --- |
| Backend type-check | Passed |
| Backend unit suite | 20 files, 201 tests passed |
| Staff seed configuration tests | 5 tests passed |
| Frontend lint | Passed with 0 errors and 3 pre-existing Fast Refresh warnings |
| Frontend production build | Passed; existing bundle-size and Browserslist age warnings remain |
| Migration/seed execution | Not run |
| Manual two-store matrix | Not run; requires isolated migrated data as described below |

### Manual two-store security matrix

Run this against an isolated staging/local database after migration, never a shared production database. Record tester, date, build SHA, store/user IDs, and pass/fail evidence in the release record.

- [ ] Platform admin can operate both stores and platform-only features.
- [ ] Store 1 manager receives no Store 2 rows, counts, or events.
- [ ] Store 1 operator can read/update Store 1 orders and only read inventory.
- [ ] Store 1 inventory staff can manage inventory/availability but cannot read orders or finance.
- [ ] Customer has no staff access.
- [ ] Manager cannot grant managers, deactivate stores, reconcile payments, manage support, or clear data.
- [ ] Guessed cross-store order, movement, membership, and invitation IDs return `404`.
- [ ] Revocation blocks the next HTTP request and removes active store socket access.
- [ ] Invitation accepts once and only for the matching normalized email.
- [ ] Final active manager cannot be removed from an active store.
- [ ] Sensitive success creates one safe audit record; failed transactions create none.
- [ ] A staff user can still view their own customer orders.
- [ ] Switching stores never displays cached data from the prior store.
- [ ] No sensitive event uses a global broadcast.
- [ ] Clear-all removes staff/invitations/old audit, preserves admins, and writes a new clear event.

This commit's automated verification does not claim the manual matrix was executed, because it requires migrated two-store data and deliberate state-changing operations.
