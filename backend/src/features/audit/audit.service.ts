import { auditLogsTable } from "../../db/schema";
import type { AuditWriter, StaffAuditState, WriteAuditInput } from "./audit.types";

const sanitizeState = (state?: StaffAuditState): StaffAuditState | undefined =>
  state ? { ...(state.role ? { role: state.role } : {}), ...(state.status ? { status: state.status } : {}) } : undefined;

export class AuditService implements AuditWriter {
  async write({ tx, actor, storeId, action, resourceType, resourceId, before, after }: WriteAuditInput) {
    const metadata = {
      ...(before ? { before: sanitizeState(before) } : {}),
      ...(after ? { after: sanitizeState(after) } : {}),
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
      metadata,
    });
  }
}

export default new AuditService();
