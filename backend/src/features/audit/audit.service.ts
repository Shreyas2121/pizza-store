import { auditLogsTable } from "../../db/schema";
import type { AuditWriter, WriteAuditInput } from "./audit.types";

const SENSITIVE_KEYS = new Set([
  "password",
  "token",
  "tokenHash",
  "token_hash",
  "secret",
  "refreshToken",
  "apiKey",
  "webhookSecret",
]);

const sanitizeRecord = (
  record?: Record<string, unknown>
): Record<string, unknown> | undefined => {
  if (!record || typeof record !== "object") return undefined;
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (!SENSITIVE_KEYS.has(key) && value !== undefined) {
      clean[key] = value;
    }
  }
  return Object.keys(clean).length > 0 ? clean : undefined;
};

export class AuditService implements AuditWriter {
  async write({
    tx,
    actor,
    storeId,
    action,
    resourceType,
    resourceId,
    before,
    after,
    metadata,
  }: WriteAuditInput) {
    const cleanBefore = sanitizeRecord(before);
    const cleanAfter = sanitizeRecord(after);
    const cleanMetadata = sanitizeRecord(metadata);

    const auditMetadata: Record<string, unknown> = {
      ...(cleanBefore ? { before: cleanBefore } : {}),
      ...(cleanAfter ? { after: cleanAfter } : {}),
      ...(cleanMetadata ? cleanMetadata : {}),
    };

    await tx.insert(auditLogsTable).values({
      actorUserId: actor.userId,
      actorEmailSnapshot: actor.email,
      platformRole: actor.platformRole,
      storeId,
      action,
      resourceType,
      resourceId: String(resourceId),
      outcome: "success",
      metadata: auditMetadata,
    });
  }
}

export default new AuditService();
