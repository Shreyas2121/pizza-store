import { and, asc, eq } from "drizzle-orm";
import { db } from "../../db";
import { storeMembershipsTable, storesTable } from "../../db/schema";
import { AppError } from "../../utils/error";
import { logger } from "../../utils/logger";
import type { AuthPrincipal } from "../auth/auth.types";
import {
  isPermission,
  isPlatformCapability,
  permissionsForRole,
  platformHasCapability,
  roleHasPermission,
  type Permission,
  type PlatformCapability,
} from "./access.permissions";
import type {
  AccessExecutor,
  AccessRepository,
  CurrentAccessDto,
  GetAccessibleStoreIdsInput,
  MembershipAccessRecord,
  PlatformAuthorizationContext,
  RequireResourceStorePermissionInput,
  RequireStorePermissionInput,
  StoreAuthorizationContext,
} from "./access.types";

export const authenticationRequired = () =>
  new AppError("Authentication required.", 401, "AUTHENTICATION_REQUIRED");

export const permissionDenied = () =>
  new AppError("Permission denied.", 403, "PERMISSION_DENIED");

export const resourceNotFound = () =>
  new AppError("Resource not found.", 404, "RESOURCE_NOT_FOUND");

export class DrizzleAccessRepository implements AccessRepository {
  async findMembership({
    userId,
    storeId,
    executor = db,
    lock = false,
  }: {
    userId: number;
    storeId: number;
    executor?: AccessExecutor;
    lock?: boolean;
  }): Promise<MembershipAccessRecord | undefined> {
    const query = executor
      .select({
        membershipId: storeMembershipsTable.id,
        userId: storeMembershipsTable.userId,
        storeId: storeMembershipsTable.storeId,
        role: storeMembershipsTable.role,
        status: storeMembershipsTable.status,
        storeIsActive: storesTable.isActive,
        storeName: storesTable.name,
        storeSlug: storesTable.slug,
      })
      .from(storeMembershipsTable)
      .innerJoin(storesTable, eq(storesTable.id, storeMembershipsTable.storeId))
      .where(
        and(
          eq(storeMembershipsTable.userId, userId),
          eq(storeMembershipsTable.storeId, storeId)
        )
      );

    const rows = lock
      ? await query.for("update", { of: storeMembershipsTable })
      : await query;
    return rows[0];
  }

  async listMemberships({
    userId,
    executor = db,
  }: {
    userId: number;
    executor?: AccessExecutor;
  }): Promise<MembershipAccessRecord[]> {
    return executor
      .select({
        membershipId: storeMembershipsTable.id,
        userId: storeMembershipsTable.userId,
        storeId: storeMembershipsTable.storeId,
        role: storeMembershipsTable.role,
        status: storeMembershipsTable.status,
        storeIsActive: storesTable.isActive,
        storeName: storesTable.name,
        storeSlug: storesTable.slug,
      })
      .from(storeMembershipsTable)
      .innerJoin(storesTable, eq(storesTable.id, storeMembershipsTable.storeId))
      .where(eq(storeMembershipsTable.userId, userId))
      .orderBy(asc(storeMembershipsTable.storeId));
  }
}

interface DenialLogger {
  warn(message: string, metadata: Record<string, unknown>): unknown;
}

export class AuthorizationService {
  constructor(
    private readonly repository: AccessRepository = new DrizzleAccessRepository(),
    private readonly denialLogger: DenialLogger = logger
  ) {}

  requirePlatformAdmin(
    principal: AuthPrincipal | undefined,
    capability?: PlatformCapability
  ): PlatformAuthorizationContext {
    if (!principal) throw authenticationRequired();
    const allowed = capability
      ? platformHasCapability(principal.platformRole, capability)
      : principal.platformRole === "admin";

    if (!allowed || (capability !== undefined && !isPlatformCapability(capability))) {
      this.logDenial(principal, { capability, reason: "platform_permission_missing" });
      throw permissionDenied();
    }

    return { access: "platform", userId: principal.userId, capability };
  }

  async requireStorePermission(
    input: RequireStorePermissionInput
  ): Promise<StoreAuthorizationContext> {
    const { principal, storeId, permission, tx, lockMembership = false } = input;
    if (!isPermission(permission)) {
      this.logDenial(principal, { storeId, permission, reason: "unknown_permission" });
      throw permissionDenied();
    }

    if (principal.platformRole === "admin") {
      return {
        access: "platform",
        userId: principal.userId,
        storeId,
        permission,
      };
    }

    if (lockMembership && !tx) {
      throw new AppError(
        "Membership locking requires a transaction.",
        500,
        "AUTHORIZATION_TRANSACTION_REQUIRED"
      );
    }

    const membership = await this.repository.findMembership({
      userId: principal.userId,
      storeId,
      executor: tx,
      lock: lockMembership,
    });
    const denialReason = this.membershipDenialReason(membership, permission);
    if (denialReason) {
      this.logDenial(principal, { storeId, permission, reason: denialReason });
      throw permissionDenied();
    }
    if (!membership) throw permissionDenied();

    return {
      access: "membership",
      userId: principal.userId,
      storeId,
      permission,
      membershipId: membership.membershipId,
      membershipRole: membership.role,
    };
  }

  async requireResourceStorePermission(
    input: RequireResourceStorePermissionInput
  ): Promise<StoreAuthorizationContext> {
    if (input.resourceStoreId == null) throw resourceNotFound();
    try {
      return await this.requireStorePermission({
        ...input,
        storeId: input.resourceStoreId,
      });
    } catch (error) {
      if (error instanceof AppError && error.status === 403) {
        throw resourceNotFound();
      }
      throw error;
    }
  }

  async getAccessibleStoreIds({
    principal,
    permission,
    tx,
  }: GetAccessibleStoreIdsInput): Promise<number[] | "all"> {
    if (!isPermission(permission)) return [];
    if (principal.platformRole === "admin") return "all";

    const memberships = await this.repository.listMemberships({
      userId: principal.userId,
      executor: tx,
    });
    return memberships
      .filter(
        (membership) =>
          !this.membershipDenialReason(membership, permission)
      )
      .map((membership) => membership.storeId);
  }

  async hasStorePermission(
    principal: AuthPrincipal,
    storeId: number,
    permission: Permission,
    tx?: AccessExecutor
  ): Promise<boolean> {
    if (!isPermission(permission)) return false;
    if (principal.platformRole === "admin") return true;

    const membership = await this.repository.findMembership({
      userId: principal.userId,
      storeId,
      executor: tx,
    });
    return !this.membershipDenialReason(membership, permission);
  }

  async getCurrentAccess(principal: AuthPrincipal): Promise<CurrentAccessDto> {
    if (principal.platformRole === "admin") {
      return {
        platformRole: "admin",
        platformAccess: "all",
        memberships: [],
      };
    }

    const memberships = await this.repository.listMemberships({
      userId: principal.userId,
    });
    return {
      platformRole: principal.platformRole,
      memberships: memberships
        .filter(
          (membership) =>
            membership.status === "active" && membership.storeIsActive
        )
        .map((membership) => ({
          membershipId: membership.membershipId,
          role: membership.role,
          store: {
            id: membership.storeId,
            name: membership.storeName,
            slug: membership.storeSlug,
          },
          permissions: permissionsForRole(membership.role),
        })),
    };
  }

  private membershipDenialReason(
    membership: MembershipAccessRecord | undefined,
    permission: Permission
  ): string | undefined {
    if (!membership) return "membership_missing";
    if (membership.status !== "active") return "membership_inactive";
    if (!membership.storeIsActive) return "store_inactive";
    if (!roleHasPermission(membership.role, permission)) return "role_permission_missing";
    return undefined;
  }

  private logDenial(
    principal: AuthPrincipal,
    metadata: {
      storeId?: number;
      permission?: string;
      capability?: string;
      reason: string;
    }
  ) {
    this.denialLogger.warn("Authorization denied", {
      actorUserId: principal.userId,
      ...metadata,
    });
  }
}

export default new AuthorizationService();
