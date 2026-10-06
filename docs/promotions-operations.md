# Promotion governance and media operations

C05 provides backend administration and discovery; C06 provides pricing and owned-cart coupon validation; C07 persists immutable COD promotion and bundle snapshots. Payment recovery, finance integration, remaining order DTO cleanup, and frontend controls follow in their assigned commits.

Only platform admins with `platform.promotions.manage` create, replace, deactivate, upload or remove media, or read analytics. `PUT /promotions/:id` is a full replacement with `expectedDefinitionVersion`. Deactivation preserves rules, media, historical applications and store choices. Exhaustion is derived from reserved plus consumed applications and never flips the administrative active switch.

Only an active same-store manager with `store.promotions.toggle` reads the manager list or writes participation. Platform admin overrides are deliberately denied for these manager endpoints. Absence of a setting means enabled. Disabling requires a trimmed reason; re-enabling restores participation without editing the definition. Global deactivation wins over explicit settings.

The manager mutation rechecks and locks membership within its transaction, then locks store, promotion and existing setting in that order. The store lock covers default-enabled absence. COD checkout follows ADR-006's compatible relative order, including user eligibility serialization and sorted catalogue locks. Unit tests check orchestration; PostgreSQL races are not claimed verified.

COD applications consume exact item and delivery savings in the transaction that writes the order, payment/attempt, stock movement and cart deletion. Reserved and consumed applications occupy global/per-user limits and exact global budget; released applications occupy neither. There are no mutable usage counters. Collection record/consume/release/restore operations verify snapshots and are idempotent. Restore checks capacity for the full released collection before updating, preserves captured amounts/versions after edits or opt-out, and never reprices. Consumed COD applications remain consumed on cancellation. Online collections become active only after C08 completes all payment recovery paths.

Success audits are committed with mutations and include actor, promotion version, before/after state, store and reason where applicable. Failure auditors run before authentication/authorization and persist safe operation/resource IDs and a stable reason code. They do not copy coupon codes or upload bytes into attempts. Every request retains the existing correlation-ID behavior.

## Images

The multipart request has `variant`, `imageAlt`, and one `file`. JPEG, PNG and WebP are decoded and re-encoded by `sharp`; header-only checks are insufficient. SVG, GIF, animation, truncated pixel data, MIME/extension mismatches, excess bytes and invalid variant dimensions are rejected. Re-encoding strips requester metadata and trailing content. Named byte and dimension limits live in `promotion.constants.ts`.

`sharp` is the C05 dependency exception: the existing libraries provide multipart parsing but no full image decoder. See the [Sharp constructor documentation](https://sharp.pixelplumbing.com/api-constructor/) for untrusted-input failure and pixel limits.

Files live under the backend working directory's `uploads/promotions`, matching the existing `/uploads` static server. API values are application URLs with randomized UUID filenames; requester filenames never determine storage paths. Mobile display falls back to desktop in the consuming UI when its URL is null. Offers without media remain valid discovery cards; featured placement requires desktop media and useful alt text.

Replacement writes the validated file, updates the reference/version and audit in a transaction, commits, and then removes the old unreferenced file. A DB failure preserves the old reference/file and leaves the new file for orphan cleanup. Post-commit deletion failure logs a safe storage key and correlation ID; the successful API response continues to reflect committed database truth.

`DELETE /promotions/:id/images` removes one variant. Removing desktop media disables homepage placement. Removing the last variant clears alt text. Deactivation never removes media.

## Orphan cleanup

Run from the repository root:

```powershell
pnpm.cmd --filter backend promotions:cleanup-media
```

This maintenance command uses the configured database and filesystem. Run it only against the intended application environment. It is not part of unit tests or preflight.

Cleanup takes the same transaction advisory lock as media writes, reads only current image references, and removes only unreferenced UUID-named files at least 24 hours old. It skips symlinks/junctions, non-file entries, unmanaged names and recent files. Path validation confines removal to the media root. Repeating cleanup is safe. A failed cleanup can be rerun; referenced assets are preserved.

## Analytics

Admin analytics use inclusive order pricing business dates and current application states. Reserved/consumed/released counts are separate. Savings, influenced order value and distinct users include consumed applications only. All report money and counts are canonical decimal strings, with platform distinct users calculated globally.

`influencedOrderValuePaise` is the order's immutable payable amount associated with this promotion, not incremental sales or recognized revenue. `netRevenueReductionPaise` apportions the actual tax-exclusive item line reduction across its applications. Delivery savings and bundle compare-at markdown contribute no item contra-revenue. Application attribution does not replace the delivered-ledger reporting scheduled for C09.
