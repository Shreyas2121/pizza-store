import type { AuthPrincipal } from "../auth/auth.types";
import type {
  StoreMembershipStatus,
  StoreRole,
  TransactionType,
} from "../../utils/types";

export interface MembershipRecord {
  id: number;
  userId: number;
  storeId: number;
  role: StoreRole;
  status: StoreMembershipStatus;
  activatedAt: Date;
  suspendedAt: Date | null;
  revokedAt: Date | null;
}

export interface InvitationRecord {
  id: number;
  storeId: number;
  email: string;
  normalizedEmail: string;
  role: StoreRole;
  tokenHash: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
}

export interface StaffListItem extends MembershipRecord {
  user: { id: number; fname: string; lname: string; email: string };
}

export interface InvitationListItem {
  id: number;
  email: string;
  role: StoreRole;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface Page<T> {
  items: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface MembershipChanges {
  role?: StoreRole;
  status?: StoreMembershipStatus;
  updatedBy?: number;
  activatedAt?: Date;
  suspendedAt?: Date | null;
  revokedAt?: Date | null;
}

export interface InvitationChanges {
  acceptedAt?: Date;
  revokedAt?: Date;
}

export interface StaffRepository {
  transaction<T>(work: (tx: TransactionType) => Promise<T>): Promise<T>;
  findUserByEmail(tx: TransactionType, email: string): Promise<{ id: number } | undefined>;
  lockMembershipByUserStore(
    tx: TransactionType,
    userId: number,
    storeId: number
  ): Promise<MembershipRecord | undefined>;
  lockMembershipByIdStore(
    tx: TransactionType,
    membershipId: number,
    storeId: number
  ): Promise<MembershipRecord | undefined>;
  insertMembership(
    tx: TransactionType,
    input: { userId: number; storeId: number; role: StoreRole; actorUserId: number; now: Date }
  ): Promise<MembershipRecord>;
  updateMembership(
    tx: TransactionType,
    membershipId: number,
    changes: MembershipChanges
  ): Promise<MembershipRecord>;
  lockStoreManagerState(
    tx: TransactionType,
    storeId: number
  ): Promise<{ storeIsActive: boolean; activeManagerIds: number[] } | undefined>;
  listStaff(input: {
    storeId: number;
    page: number;
    limit: number;
    status?: StoreMembershipStatus;
  }): Promise<Page<StaffListItem>>;
  listInvitations(input: {
    storeId: number;
    page: number;
    limit: number;
  }): Promise<Page<InvitationListItem>>;
  revokePendingInvitations(
    tx: TransactionType,
    storeId: number,
    normalizedEmail: string,
    now: Date
  ): Promise<void>;
  insertInvitation(
    tx: TransactionType,
    input: {
      storeId: number;
      email: string;
      normalizedEmail: string;
      role: StoreRole;
      tokenHash: string;
      invitedBy: number;
      expiresAt: Date;
    }
  ): Promise<InvitationRecord>;
  lockInvitationByIdStore(
    tx: TransactionType,
    invitationId: number,
    storeId: number
  ): Promise<InvitationRecord | undefined>;
  lockInvitationByHash(
    tx: TransactionType,
    tokenHash: string
  ): Promise<InvitationRecord | undefined>;
  updateInvitation(
    tx: TransactionType,
    invitationId: number,
    changes: InvitationChanges
  ): Promise<InvitationRecord>;
  isStoreActive(tx: TransactionType, storeId: number): Promise<boolean>;
}

export interface StaffAccessNotifier {
  membershipChanged(input: { userId: number; storeId: number }): Promise<void>;
}

export interface InvitationRateLimiter {
  consume(key: string, now: Date): void;
}

export interface StaffInvitationDelivery {
  deliver(input: {
    email: string;
    storeId: number;
    role: StoreRole;
    token: string;
    expiresAt: Date;
  }): Promise<{ developmentUrl?: string }>;
}

export interface StaffMutationInput {
  principal: AuthPrincipal;
  storeId: number;
}
