import type { AuthPrincipal, PlatformRole } from "../auth/auth.types";
import type {
  DatabaseType,
  StoreMembershipStatus,
  StoreRole,
  TransactionType,
} from "../../utils/types";
import type { Permission, PlatformCapability } from "./access.permissions";

export type AccessExecutor = DatabaseType | TransactionType;

export interface MembershipAccessRecord {
  membershipId: number;
  userId: number;
  storeId: number;
  role: StoreRole;
  status: StoreMembershipStatus;
  storeIsActive: boolean;
  storeName: string;
  storeSlug: string;
}

export interface StoreAuthorizationContext {
  access: "platform" | "membership";
  userId: number;
  storeId: number;
  permission: Permission;
  membershipId?: number;
  membershipRole?: StoreRole;
}

export interface PlatformAuthorizationContext {
  access: "platform";
  userId: number;
  capability?: PlatformCapability;
}

export interface RequireStorePermissionInput {
  principal: AuthPrincipal;
  storeId: number;
  permission: Permission;
  tx?: TransactionType;
  lockMembership?: boolean;
}

export interface RequireResourceStorePermissionInput
  extends Omit<RequireStorePermissionInput, "storeId"> {
  resourceStoreId: number | null | undefined;
}

export interface GetAccessibleStoreIdsInput {
  principal: AuthPrincipal;
  permission: Permission;
  tx?: TransactionType;
}

export interface AccessMembershipDto {
  membershipId: number;
  role: StoreRole;
  store: {
    id: number;
    name: string;
    slug: string;
  };
  permissions: Permission[];
}

export interface CurrentAccessDto {
  platformRole: PlatformRole;
  platformAccess?: "all";
  memberships: AccessMembershipDto[];
}

export interface AccessRepository {
  findMembership(input: {
    userId: number;
    storeId: number;
    executor?: AccessExecutor;
    lock?: boolean;
  }): Promise<MembershipAccessRecord | undefined>;
  listMemberships(input: {
    userId: number;
    executor?: AccessExecutor;
  }): Promise<MembershipAccessRecord[]>;
}
