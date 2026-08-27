import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  storeMembershipsTable,
  storesTable,
  storeStaffInvitationsTable,
  usersTable,
} from "../../db/schema";
import type { StoreMembershipStatus, TransactionType } from "../../utils/types";
import type {
  InvitationChanges,
  InvitationRecord,
  MembershipChanges,
  MembershipRecord,
  StaffRepository,
} from "./staff.types";

const membershipSelection = {
  id: storeMembershipsTable.id,
  userId: storeMembershipsTable.userId,
  storeId: storeMembershipsTable.storeId,
  role: storeMembershipsTable.role,
  status: storeMembershipsTable.status,
  activatedAt: storeMembershipsTable.activatedAt,
  suspendedAt: storeMembershipsTable.suspendedAt,
  revokedAt: storeMembershipsTable.revokedAt,
};

const invitationSelection = {
  id: storeStaffInvitationsTable.id,
  storeId: storeStaffInvitationsTable.storeId,
  email: storeStaffInvitationsTable.email,
  normalizedEmail: storeStaffInvitationsTable.normalizedEmail,
  role: storeStaffInvitationsTable.role,
  tokenHash: storeStaffInvitationsTable.tokenHash,
  expiresAt: storeStaffInvitationsTable.expiresAt,
  acceptedAt: storeStaffInvitationsTable.acceptedAt,
  revokedAt: storeStaffInvitationsTable.revokedAt,
};

export class DrizzleStaffRepository implements StaffRepository {
  transaction<T>(work: (tx: TransactionType) => Promise<T>): Promise<T> {
    return db.transaction(work);
  }

  async findUserByEmail(tx: TransactionType, email: string) {
    const rows = await tx
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(sql`lower(${usersTable.email}) = ${email}`)
      .limit(1);
    return rows[0];
  }

  async lockMembershipByUserStore(tx: TransactionType, userId: number, storeId: number) {
    const rows = await tx
      .select(membershipSelection)
      .from(storeMembershipsTable)
      .where(and(eq(storeMembershipsTable.userId, userId), eq(storeMembershipsTable.storeId, storeId)))
      .for("update");
    return rows[0];
  }

  async lockMembershipByIdStore(tx: TransactionType, membershipId: number, storeId: number) {
    const rows = await tx
      .select(membershipSelection)
      .from(storeMembershipsTable)
      .where(and(eq(storeMembershipsTable.id, membershipId), eq(storeMembershipsTable.storeId, storeId)))
      .for("update");
    return rows[0];
  }

  async insertMembership(
    tx: TransactionType,
    input: { userId: number; storeId: number; role: MembershipRecord["role"]; actorUserId: number; now: Date }
  ) {
    const rows = await tx
      .insert(storeMembershipsTable)
      .values({
        userId: input.userId,
        storeId: input.storeId,
        role: input.role,
        status: "active",
        createdBy: input.actorUserId,
        updatedBy: input.actorUserId,
        activatedAt: input.now,
      })
      .returning(membershipSelection);
    return rows[0];
  }

  async updateMembership(tx: TransactionType, membershipId: number, changes: MembershipChanges) {
    const rows = await tx
      .update(storeMembershipsTable)
      .set(changes)
      .where(eq(storeMembershipsTable.id, membershipId))
      .returning(membershipSelection);
    return rows[0];
  }

  async lockStoreManagerState(tx: TransactionType, storeId: number) {
    const stores = await tx
      .select({ isActive: storesTable.isActive })
      .from(storesTable)
      .where(eq(storesTable.id, storeId))
      .for("update");
    if (!stores[0]) return undefined;
    const managers = await tx
      .select({ id: storeMembershipsTable.id })
      .from(storeMembershipsTable)
      .where(
        and(
          eq(storeMembershipsTable.storeId, storeId),
          eq(storeMembershipsTable.role, "manager"),
          eq(storeMembershipsTable.status, "active")
        )
      )
      .orderBy(asc(storeMembershipsTable.id))
      .for("update");
    return { storeIsActive: stores[0].isActive, activeManagerIds: managers.map((row) => row.id) };
  }

  async listStaff({ storeId, page, limit, status }: { storeId: number; page: number; limit: number; status?: StoreMembershipStatus }) {
    const condition = status
      ? and(eq(storeMembershipsTable.storeId, storeId), eq(storeMembershipsTable.status, status))
      : eq(storeMembershipsTable.storeId, storeId);
    const [items, totals] = await Promise.all([
      db
        .select({
          ...membershipSelection,
          user: { id: usersTable.id, fname: usersTable.fname, lname: usersTable.lname, email: usersTable.email },
        })
        .from(storeMembershipsTable)
        .innerJoin(usersTable, eq(usersTable.id, storeMembershipsTable.userId))
        .where(condition)
        .orderBy(asc(usersTable.fname), asc(usersTable.lname), asc(storeMembershipsTable.id))
        .limit(limit)
        .offset((page - 1) * limit),
      db.select({ total: count() }).from(storeMembershipsTable).where(condition),
    ]);
    const total = totals[0]?.total ?? 0;
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async listInvitations({ storeId, page, limit }: { storeId: number; page: number; limit: number }) {
    const condition = eq(storeStaffInvitationsTable.storeId, storeId);
    const [items, totals] = await Promise.all([
      db
        .select({
          id: storeStaffInvitationsTable.id,
          email: storeStaffInvitationsTable.email,
          role: storeStaffInvitationsTable.role,
          expiresAt: storeStaffInvitationsTable.expiresAt,
          acceptedAt: storeStaffInvitationsTable.acceptedAt,
          revokedAt: storeStaffInvitationsTable.revokedAt,
          createdAt: storeStaffInvitationsTable.createdAt,
        })
        .from(storeStaffInvitationsTable)
        .where(condition)
        .orderBy(desc(storeStaffInvitationsTable.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
      db.select({ total: count() }).from(storeStaffInvitationsTable).where(condition),
    ]);
    const total = totals[0]?.total ?? 0;
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async revokePendingInvitations(tx: TransactionType, storeId: number, normalizedEmail: string, now: Date) {
    await tx
      .update(storeStaffInvitationsTable)
      .set({ revokedAt: now })
      .where(
        and(
          eq(storeStaffInvitationsTable.storeId, storeId),
          eq(storeStaffInvitationsTable.normalizedEmail, normalizedEmail),
          sql`${storeStaffInvitationsTable.acceptedAt} is null`,
          sql`${storeStaffInvitationsTable.revokedAt} is null`
        )
      );
  }

  async insertInvitation(tx: TransactionType, input: Parameters<StaffRepository["insertInvitation"]>[1]) {
    const rows = await tx.insert(storeStaffInvitationsTable).values(input).returning(invitationSelection);
    return rows[0];
  }

  async lockInvitationByIdStore(tx: TransactionType, invitationId: number, storeId: number) {
    const rows = await tx
      .select(invitationSelection)
      .from(storeStaffInvitationsTable)
      .where(and(eq(storeStaffInvitationsTable.id, invitationId), eq(storeStaffInvitationsTable.storeId, storeId)))
      .for("update");
    return rows[0];
  }

  async lockInvitationByHash(tx: TransactionType, tokenHash: string) {
    const rows = await tx
      .select(invitationSelection)
      .from(storeStaffInvitationsTable)
      .where(eq(storeStaffInvitationsTable.tokenHash, tokenHash))
      .for("update");
    return rows[0];
  }

  async updateInvitation(tx: TransactionType, invitationId: number, changes: InvitationChanges) {
    const rows = await tx
      .update(storeStaffInvitationsTable)
      .set(changes)
      .where(eq(storeStaffInvitationsTable.id, invitationId))
      .returning(invitationSelection);
    return rows[0];
  }

  async isStoreActive(tx: TransactionType, storeId: number) {
    const rows = await tx.select({ isActive: storesTable.isActive }).from(storesTable).where(eq(storesTable.id, storeId));
    return rows[0]?.isActive === true;
  }
}

export default new DrizzleStaffRepository();
