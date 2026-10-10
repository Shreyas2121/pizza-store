# ADR-008: Promotion media storage, replacement, and cleanup

- Status: Accepted
- Date: 2026-09-12
- Decision owners: PizzaStore project owner and maintainers

Implementation review (2026-10-10): Implemented behavior and current evidence are described by the linked contracts; the dated decision context is retained as history. See [architecture](../architecture.md), [lifecycle contracts](../finance-lifecycle-contracts.md) and [verification](../case-study-verification.md).

## Context

Offers may use desktop/mobile images and selected offers may appear in the homepage slider. Database updates and local filesystem operations are not one atomic transaction, so upload validation, replacement order, URL exposure, and orphan cleanup need one explicit policy.

## Decision

1. Only a platform admin with `platform.promotions.manage` may upload, replace, or remove promotion media.
2. The backend owns an allowlist of decoded formats, MIME types, extensions, maximum bytes, pixel dimensions, aspect constraints, variants, upload directory, and public URL prefix. Request headers, original extensions, and client filenames are not trusted.
3. The service decodes and validates the file, generates a randomized server filename, and persists a relative storage key. APIs return a public application URL and never a host filesystem path.
4. `desktop` and `mobile` are the only variants. Desktop media and useful alt text are required before an offer can set `showOnHomepage = true`; mobile media is optional and falls back to desktop. Coupons can retain admin-only media metadata but can never be featured or returned by public offer/media endpoints.
5. Replacement order is: write and validate the new file; update the database reference and increment `definitionVersion` in a transaction; commit; then remove the replaced file. The old file is never deleted before the database commit.
6. If the database update fails, the new unreferenced file is an orphan eligible for cleanup. If removal of the old file fails after commit, the old unreferenced file is also eligible. The request reports database truth; cleanup failure is logged with a non-secret storage key and correlation ID.
7. Cleanup enumerates only files under the configured promotion-media root, compares randomized relative keys with current database references, respects a named minimum orphan age, and is idempotent. It never follows user-controlled paths or removes a referenced file.
8. Deactivation does not delete media because reactivation and historical admin evidence may still need it. Physical removal occurs only after replacement, an explicit authorized media removal, or deletion of an unreferenced draft under the retention policy.
9. Public rendering uses meaningful alt text, responsive desktop/mobile sources, deterministic priority, explicit controls, pause behavior, and reduced-motion behavior. A broken or missing image uses application-owned fallback content without exposing storage details.

## Alternatives considered

### Trust Multer MIME metadata and the original extension

Rejected because both are controlled by the requester and do not prove decoded file content.

### Delete the old file before updating PostgreSQL

Rejected because a failed database update would leave the active promotion referencing a missing asset.

### Store absolute filesystem paths

Rejected because paths leak deployment details and make storage moves or alternate backends difficult.

### Delete media whenever a promotion is deactivated

Rejected because deactivation is reversible and should not destroy reusable content.

## Consequences

- Filesystem/database splits require an observable orphan-cleanup operation rather than pretending to be atomic.
- Media constraints and cleanup ages are named constants and covered by upload/storage tests.
- The media service, not routes, owns validation and replacement sequencing.
- Homepage placement validation spans promotion kind, active media metadata, and alt text.

## Testable invariants

- Invalid decoded content, size, dimensions, MIME, extension, or variant fails before persistence.
- Stored filenames are randomized and contain no requester path segments.
- A failed database update leaves the prior reference and file intact.
- A committed replacement never deletes the newly referenced file.
- Cleanup never removes a referenced or too-recent file and is safe to repeat.
- Public featured responses contain offers only and always provide usable desktop media plus alt text.
