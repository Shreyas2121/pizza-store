import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { AppError } from "../../utils/error";
import { env } from "../../utils/zodSchema";
import type { StoreMembershipStatus, StoreRole, TransactionType } from "../../utils/types";
import authorizationService, { resourceNotFound } from "../access/access.service";
import type { StoreAuthorizationContext } from "../access/access.types";
import type { AuthPrincipal } from "../auth/auth.types";
import auditService from "../audit/audit.service";
import type { AuditWriter, StaffAuditState } from "../audit/audit.types";
import { normalizeEmail } from "../users/user.service";
import { invitationDelivery } from "./staff.invitation-delivery";
import staffRepository from "./staff.repository";
import { staffAccessNotifier } from "./staff.realtime";
import { invitationRateLimiter } from "./staff.rate-limit";
import type {
  InvitationRecord,
  InvitationRateLimiter,
  MembershipChanges,
  MembershipRecord,
  StaffAccessNotifier,
  StaffInvitationDelivery,
  StaffRepository,
} from "./staff.types";

interface StaffAuthorizer {
  requireStorePermission(input: {
    principal: AuthPrincipal;
    storeId: number;
    permission: "store.staff.read" | "store.staff.manage";
    tx?: TransactionType;
    lockMembership?: boolean;
  }): Promise<StoreAuthorizationContext>;
}

interface Clock {
  now(): Date;
}

const systemClock: Clock = { now: () => new Date() };

export const createInvitationToken = (): string => randomBytes(32).toString("base64url");
export const hashInvitationToken = (token: string): string =>
  createHash("sha256").update(token, "utf8").digest("hex");

export const invitationTokenMatches = (token: string, storedHash: string): boolean => {
  const candidate = Buffer.from(hashInvitationToken(token), "hex");
  const stored = Buffer.from(storedHash, "hex");
  return candidate.length === stored.length && timingSafeEqual(candidate, stored);
};

const auditState = (membership: MembershipRecord): StaffAuditState => ({
  role: membership.role,
  status: membership.status,
});

export class StaffService {
  constructor(
    private readonly repository: StaffRepository = staffRepository,
    private readonly authorizer: StaffAuthorizer = authorizationService,
    private readonly audit: AuditWriter = auditService,
    private readonly delivery: StaffInvitationDelivery = invitationDelivery,
    private readonly notifier: StaffAccessNotifier = staffAccessNotifier,
    private readonly rateLimiter: InvitationRateLimiter = invitationRateLimiter,
    private readonly clock: Clock = systemClock,
    private readonly invitationExpiryHours = env.STAFF_INVITATION_EXPIRY_HOURS
  ) {}

  async listStaff(input: {
    principal: AuthPrincipal;
    storeId: number;
    page: number;
    limit: number;
    status?: StoreMembershipStatus;
  }) {
    await this.authorizer.requireStorePermission({
      principal: input.principal,
      storeId: input.storeId,
      permission: "store.staff.read",
    });
    return this.repository.listStaff(input);
  }

  async assignStaff(input: {
    principal: AuthPrincipal;
    storeId: number;
    email: string;
    role: StoreRole;
  }) {
    const normalizedEmail = normalizeEmail(input.email);
    const now = this.clock.now();
    const membership = await this.repository.transaction(async (tx) => {
      const context = await this.authorizeManagement(input.principal, input.storeId, tx);
      this.assertCanManageRole(context, input.role);
      const user = await this.repository.findUserByEmail(tx, normalizedEmail);
      if (!user) {
        throw new AppError(
          "No assignable user was found. Send an invitation instead.",
          404,
          "USER_NOT_FOUND_OR_INVITE_REQUIRED"
        );
      }
      if (user.id === input.principal.userId) {
        throw new AppError("Self role changes are not allowed.", 403, "SELF_ROLE_CHANGE_NOT_ALLOWED");
      }

      const existing = await this.repository.lockMembershipByUserStore(tx, user.id, input.storeId);
      if (existing?.status === "active") {
        throw new AppError("Membership is already active.", 409, "MEMBERSHIP_ALREADY_ACTIVE");
      }
      if (existing) this.assertCanManageRole(context, existing.role);

      const updated = existing
        ? await this.repository.updateMembership(tx, existing.id, {
            role: input.role,
            status: "active",
            updatedBy: input.principal.userId,
            activatedAt: now,
            suspendedAt: null,
            revokedAt: null,
          })
        : await this.repository.insertMembership(tx, {
            userId: user.id,
            storeId: input.storeId,
            role: input.role,
            actorUserId: input.principal.userId,
            now,
          });

      await this.audit.write({
        tx,
        actor: input.principal,
        storeId: input.storeId,
        action: "staff.membership.assigned",
        resourceType: "store_membership",
        resourceId: updated.id,
        ...(existing ? { before: auditState(existing) } : {}),
        after: auditState(updated),
      });
      return updated;
    });
    await this.notifier.membershipChanged({ userId: membership.userId, storeId: membership.storeId });
    return membership;
  }

  async updateStaff(input: {
    principal: AuthPrincipal;
    storeId: number;
    membershipId: number;
    role?: StoreRole;
    status?: "active" | "suspended";
  }) {
    const now = this.clock.now();
    const membership = await this.repository.transaction(async (tx) => {
      const context = await this.authorizeManagement(input.principal, input.storeId, tx);
      const managerState = await this.repository.lockStoreManagerState(tx, input.storeId);
      if (!managerState) throw resourceNotFound();
      const existing = await this.repository.lockMembershipByIdStore(tx, input.membershipId, input.storeId);
      if (!existing) throw resourceNotFound();
      this.assertCanManageRole(context, existing.role);
      if (input.role) this.assertCanManageRole(context, input.role);
      if (existing.userId === input.principal.userId && input.role && input.role !== existing.role) {
        throw new AppError("Self role changes are not allowed.", 403, "SELF_ROLE_CHANGE_NOT_ALLOWED");
      }

      const removesActiveManager =
        existing.role === "manager" &&
        existing.status === "active" &&
        ((input.role !== undefined && input.role !== "manager") || input.status === "suspended");
      if (removesActiveManager) this.assertNotLastActiveManager(managerState, existing.id);

      const changes: MembershipChanges = { updatedBy: input.principal.userId };
      if (input.role) changes.role = input.role;
      if (input.status === "active") {
        changes.status = "active";
        changes.activatedAt = now;
        changes.suspendedAt = null;
        changes.revokedAt = null;
      } else if (input.status === "suspended") {
        changes.status = "suspended";
        changes.suspendedAt = now;
        changes.revokedAt = null;
      }
      const updated = await this.repository.updateMembership(tx, existing.id, changes);
      await this.audit.write({
        tx,
        actor: input.principal,
        storeId: input.storeId,
        action: "staff.membership.updated",
        resourceType: "store_membership",
        resourceId: updated.id,
        before: auditState(existing),
        after: auditState(updated),
      });
      return updated;
    });
    await this.notifier.membershipChanged({ userId: membership.userId, storeId: membership.storeId });
    return membership;
  }

  async revokeStaff(input: { principal: AuthPrincipal; storeId: number; membershipId: number }) {
    const now = this.clock.now();
    const membership = await this.repository.transaction(async (tx) => {
      const context = await this.authorizeManagement(input.principal, input.storeId, tx);
      const managerState = await this.repository.lockStoreManagerState(tx, input.storeId);
      if (!managerState) throw resourceNotFound();
      const existing = await this.repository.lockMembershipByIdStore(tx, input.membershipId, input.storeId);
      if (!existing) throw resourceNotFound();
      this.assertCanManageRole(context, existing.role);
      if (existing.role === "manager" && existing.status === "active") {
        this.assertNotLastActiveManager(managerState, existing.id);
      }
      const updated = await this.repository.updateMembership(tx, existing.id, {
        status: "revoked",
        updatedBy: input.principal.userId,
        suspendedAt: null,
        revokedAt: now,
      });
      await this.audit.write({
        tx,
        actor: input.principal,
        storeId: input.storeId,
        action: "staff.membership.revoked",
        resourceType: "store_membership",
        resourceId: updated.id,
        before: auditState(existing),
        after: auditState(updated),
      });
      return updated;
    });
    await this.notifier.membershipChanged({ userId: membership.userId, storeId: membership.storeId });
    return membership;
  }

  async listInvitations(input: { principal: AuthPrincipal; storeId: number; page: number; limit: number }) {
    await this.authorizer.requireStorePermission({
      principal: input.principal,
      storeId: input.storeId,
      permission: "store.staff.read",
    });
    return this.repository.listInvitations(input);
  }

  async createInvitation(input: {
    principal: AuthPrincipal;
    storeId: number;
    email: string;
    role: StoreRole;
  }) {
    const email = normalizeEmail(input.email);
    const now = this.clock.now();
    this.rateLimiter.consume(
      `create:${input.principal.userId}:${input.storeId}:${hashInvitationToken(email)}`,
      now
    );
    const token = createInvitationToken();
    const tokenHash = hashInvitationToken(token);
    const expiresAt = new Date(now.getTime() + this.invitationExpiryHours * 60 * 60 * 1000);
    return this.repository.transaction(async (tx) => {
      const context = await this.authorizeManagement(input.principal, input.storeId, tx);
      this.assertCanManageRole(context, input.role);
      await this.repository.revokePendingInvitations(tx, input.storeId, email, now);
      const invitation = await this.repository.insertInvitation(tx, {
        storeId: input.storeId,
        email,
        normalizedEmail: email,
        role: input.role,
        tokenHash,
        invitedBy: input.principal.userId,
        expiresAt,
      });
      const delivery = await this.delivery.deliver({
        email,
        storeId: input.storeId,
        role: input.role,
        token,
        expiresAt,
      });
      await this.audit.write({
        tx,
        actor: input.principal,
        storeId: input.storeId,
        action: "staff.invitation.created",
        resourceType: "store_staff_invitation",
        resourceId: invitation.id,
        after: { role: invitation.role },
      });
      return {
        invitation: this.safeInvitation(invitation),
        ...(delivery.developmentUrl ? { developmentUrl: delivery.developmentUrl } : {}),
      };
    });
  }

  async revokeInvitation(input: {
    principal: AuthPrincipal;
    storeId: number;
    invitationId: number;
  }) {
    const now = this.clock.now();
    return this.repository.transaction(async (tx) => {
      const context = await this.authorizeManagement(input.principal, input.storeId, tx);
      const invitation = await this.repository.lockInvitationByIdStore(tx, input.invitationId, input.storeId);
      if (!invitation) throw resourceNotFound();
      this.assertCanManageRole(context, invitation.role);
      if (invitation.acceptedAt) {
        throw new AppError("Invitation has already been used.", 409, "INVITATION_ALREADY_USED");
      }
      if (invitation.revokedAt) {
        throw new AppError("Invitation was revoked.", 410, "INVITATION_REVOKED");
      }
      const updated = await this.repository.updateInvitation(tx, invitation.id, { revokedAt: now });
      await this.audit.write({
        tx,
        actor: input.principal,
        storeId: input.storeId,
        action: "staff.invitation.revoked",
        resourceType: "store_staff_invitation",
        resourceId: invitation.id,
        before: { role: invitation.role },
        after: { role: updated.role },
      });
      return this.safeInvitation(updated);
    });
  }

  async acceptInvitation(input: { principal: AuthPrincipal; token: string }) {
    const tokenHash = hashInvitationToken(input.token);
    const now = this.clock.now();
    this.rateLimiter.consume(`accept:${input.principal.userId}:${tokenHash}`, now);
    const membership = await this.repository.transaction(async (tx) => {
      const invitation = await this.repository.lockInvitationByHash(tx, tokenHash);
      if (!invitation || !invitationTokenMatches(input.token, invitation.tokenHash)) {
        throw new AppError("Invitation is invalid.", 404, "INVITATION_INVALID");
      }
      this.rateLimiter.consume(
        `accept-scope:${input.principal.userId}:${invitation.storeId}:${hashInvitationToken(invitation.normalizedEmail)}`,
        now
      );
      if (invitation.acceptedAt) {
        throw new AppError("Invitation has already been used.", 409, "INVITATION_ALREADY_USED");
      }
      if (invitation.revokedAt) {
        throw new AppError("Invitation was revoked.", 410, "INVITATION_REVOKED");
      }
      if (invitation.expiresAt.getTime() <= now.getTime()) {
        throw new AppError("Invitation has expired.", 410, "INVITATION_EXPIRED");
      }
      if (normalizeEmail(input.principal.email) !== invitation.normalizedEmail) {
        throw new AppError("Invitation email does not match.", 403, "INVITATION_EMAIL_MISMATCH");
      }
      if (!(await this.repository.isStoreActive(tx, invitation.storeId))) {
        throw new AppError("Invitation store is unavailable.", 410, "INVITATION_STORE_INACTIVE");
      }

      const existing = await this.repository.lockMembershipByUserStore(
        tx,
        input.principal.userId,
        invitation.storeId
      );
      if (existing?.status === "active") {
        throw new AppError("Membership is already active.", 409, "MEMBERSHIP_ALREADY_ACTIVE");
      }
      if (existing && existing.role !== invitation.role) {
        throw new AppError(
          "Invitation role conflicts with the retained membership.",
          409,
          "MEMBERSHIP_ROLE_CONFLICT"
        );
      }
      const updated = existing
        ? await this.repository.updateMembership(tx, existing.id, {
            role: invitation.role,
            status: "active",
            updatedBy: input.principal.userId,
            activatedAt: now,
            suspendedAt: null,
            revokedAt: null,
          })
        : await this.repository.insertMembership(tx, {
            userId: input.principal.userId,
            storeId: invitation.storeId,
            role: invitation.role,
            actorUserId: input.principal.userId,
            now,
          });
      await this.repository.updateInvitation(tx, invitation.id, { acceptedAt: now });
      await this.audit.write({
        tx,
        actor: input.principal,
        storeId: invitation.storeId,
        action: "staff.invitation.accepted",
        resourceType: "store_staff_invitation",
        resourceId: invitation.id,
        after: { role: invitation.role },
      });
      return updated;
    });
    await this.notifier.membershipChanged({ userId: membership.userId, storeId: membership.storeId });
    return membership;
  }

  private authorizeManagement(principal: AuthPrincipal, storeId: number, tx: TransactionType) {
    return this.authorizer.requireStorePermission({
      principal,
      storeId,
      permission: "store.staff.manage",
      tx,
      lockMembership: principal.platformRole !== "admin",
    });
  }

  private assertCanManageRole(context: StoreAuthorizationContext, role: StoreRole) {
    if (context.access === "platform") return;
    if (["manager", "finance_manager", "payroll_manager"].includes(role)) {
      throw new AppError(
        "Store managers cannot manage privileged store roles.",
        403,
        "MANAGER_ROLE_RESTRICTED"
      );
    }
  }

  private assertNotLastActiveManager(
    state: { storeIsActive: boolean; activeManagerIds: number[] },
    membershipId: number
  ) {
    if (
      state.storeIsActive &&
      state.activeManagerIds.includes(membershipId) &&
      state.activeManagerIds.length <= 1
    ) {
      throw new AppError("The active store must retain a manager.", 409, "LAST_STORE_MANAGER");
    }
  }

  private safeInvitation(invitation: InvitationRecord) {
    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      acceptedAt: invitation.acceptedAt,
      revokedAt: invitation.revokedAt,
    };
  }
}

export default new StaffService();
