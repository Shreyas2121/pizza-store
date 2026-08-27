import { and, count, desc, eq, gte, lte, type SQL } from "drizzle-orm";
import { db } from "../../db";
import { auditLogsTable } from "../../db/schema";
import type { AuthPrincipal } from "../auth/auth.types";
import authorizationService, { AuthorizationService } from "../access/access.service";
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
  constructor(
    private readonly authorization: AuthorizationService = authorizationService
  ) {}

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

  async listStore(
    actor: AuthPrincipal,
    storeId: number,
    input: AuditListInput
  ) {
    await this.authorization.requireStorePermission({
      principal: actor,
      storeId,
      permission: "store.audit.read",
    });
    return this.list({ ...input, storeId });
  }

  async listGlobal(actor: AuthPrincipal, input: AuditListInput) {
    this.authorization.requirePlatformAdmin(actor, "platform.audit.read");
    return this.list(input);
  }

  private async list(input: AuditListInput) {
    const conditions: SQL[] = [];
    if (input.storeId !== undefined) conditions.push(eq(auditLogsTable.storeId, input.storeId));
    if (input.actorUserId !== undefined) conditions.push(eq(auditLogsTable.actorUserId, input.actorUserId));
    if (input.action !== undefined) conditions.push(eq(auditLogsTable.action, input.action));
    if (input.from !== undefined) conditions.push(gte(auditLogsTable.createdAt, input.from));
    if (input.to !== undefined) conditions.push(lte(auditLogsTable.createdAt, input.to));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [{ total }] = await db.select({ total: count() }).from(auditLogsTable).where(where);
    const items = await db
      .select()
      .from(auditLogsTable)
      .where(where)
      .orderBy(desc(auditLogsTable.createdAt), desc(auditLogsTable.id))
      .limit(input.limit)
      .offset((input.page - 1) * input.limit);
    const parsedTotal = Number(total);
    return {
      items,
      meta: {
        total: parsedTotal,
        page: input.page,
        limit: input.limit,
        totalPages: Math.ceil(parsedTotal / input.limit),
        hasNextPage: input.page * input.limit < parsedTotal,
      },
    };
  }
}

export interface AuditListInput {
  page: number;
  limit: number;
  storeId?: number;
  actorUserId?: number;
  action?: string;
  from?: Date;
  to?: Date;
}

export default new AuditService();
