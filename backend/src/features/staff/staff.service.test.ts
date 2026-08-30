import { describe, expect, it, vi } from "vitest";
import { AppError } from "../../utils/error";
import type { StoreRole, TransactionType } from "../../utils/types";
import type { AuthPrincipal } from "../auth/auth.types";
import type { AuditWriter } from "../audit/audit.types";
import { StaffService, createInvitationToken, hashInvitationToken, invitationTokenMatches } from "./staff.service";
import type {
  InvitationRecord,
  MembershipRecord,
  StaffAccessNotifier,
  StaffInvitationDelivery,
  InvitationRateLimiter,
  StaffRepository,
} from "./staff.types";
import { InMemoryInvitationRateLimiter } from "./staff.rate-limit";
import {
  DevelopmentInvitationDelivery,
  UnavailableInvitationDelivery,
} from "./staff.invitation-delivery";

const now = new Date("2026-08-27T10:00:00.000Z");
const tx = { testTransaction: true } as unknown as TransactionType;

const actor = (platformRole: "admin" | "user" = "admin"): AuthPrincipal => ({
  userId: platformRole === "admin" ? 1 : 10,
  email: platformRole === "admin" ? "admin@example.com" : "manager@example.com",
  platformRole,
  tokenVersion: 0,
});

const member = (overrides: Partial<MembershipRecord> = {}): MembershipRecord => ({
  id: 12,
  userId: 20,
  storeId: 3,
  role: "operator",
  status: "active",
  activatedAt: new Date("2026-01-01T00:00:00Z"),
  suspendedAt: null,
  revokedAt: null,
  ...overrides,
});

const invitation = (overrides: Partial<InvitationRecord> = {}): InvitationRecord => {
  const token = "acceptance-token";
  return {
    id: 30,
    storeId: 3,
    email: "invitee@example.com",
    normalizedEmail: "invitee@example.com",
    role: "operator",
    tokenHash: hashInvitationToken(token),
    expiresAt: new Date("2026-08-29T10:00:00Z"),
    acceptedAt: null,
    revokedAt: null,
    ...overrides,
  };
};

const createHarness = (options: {
  principalContext?: "platform" | "membership";
  memberships?: MembershipRecord[];
  invitations?: InvitationRecord[];
  users?: Record<string, number>;
  deliveryError?: Error;
  auditError?: Error;
} = {}) => {
  let memberships = [...(options.memberships ?? [])];
  let invitations = [...(options.invitations ?? [])];
  const users = options.users ?? { "staff@example.com": 20 };
  let nextMembershipId = 100;
  let nextInvitationId = 200;

  const repository: StaffRepository = {
    transaction: vi.fn(async (work) => {
      const membershipSnapshot = memberships.map((row) => ({ ...row }));
      const invitationSnapshot = invitations.map((row) => ({ ...row }));
      try {
        return await work(tx);
      } catch (error) {
        memberships = membershipSnapshot;
        invitations = invitationSnapshot;
        throw error;
      }
    }),
    findUserByEmail: vi.fn(async (_tx, email) =>
      users[email] ? { id: users[email] } : undefined
    ),
    lockMembershipByUserStore: vi.fn(async (_tx, userId, storeId) =>
      memberships.find((row) => row.userId === userId && row.storeId === storeId)
    ),
    lockMembershipByIdStore: vi.fn(async (_tx, id, storeId) =>
      memberships.find((row) => row.id === id && row.storeId === storeId)
    ),
    insertMembership: vi.fn(async (_tx, input) => {
      const row = member({
        id: nextMembershipId++,
        userId: input.userId,
        storeId: input.storeId,
        role: input.role,
        activatedAt: input.now,
      });
      memberships.push(row);
      return row;
    }),
    updateMembership: vi.fn(async (_tx, id, changes) => {
      const index = memberships.findIndex((row) => row.id === id);
      memberships[index] = { ...memberships[index], ...changes };
      return memberships[index];
    }),
    lockStoreManagerState: vi.fn(async (_tx, storeId) => ({
      storeIsActive: true,
      activeManagerIds: memberships
        .filter((row) => row.storeId === storeId && row.role === "manager" && row.status === "active")
        .map((row) => row.id),
    })),
    listStaff: vi.fn(async () => ({ items: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } })),
    listInvitations: vi.fn(async () => ({ items: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } })),
    revokePendingInvitations: vi.fn(async (_tx, storeId, email, revokedAt) => {
      invitations = invitations.map((row) =>
        row.storeId === storeId && row.normalizedEmail === email && !row.acceptedAt && !row.revokedAt
          ? { ...row, revokedAt }
          : row
      );
    }),
    insertInvitation: vi.fn(async (_tx, input) => {
      const row: InvitationRecord = {
        id: nextInvitationId++,
        storeId: input.storeId,
        email: input.email,
        normalizedEmail: input.normalizedEmail,
        role: input.role,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        acceptedAt: null,
        revokedAt: null,
      };
      invitations.push(row);
      return row;
    }),
    lockInvitationByIdStore: vi.fn(async (_tx, id, storeId) =>
      invitations.find((row) => row.id === id && row.storeId === storeId)
    ),
    lockInvitationByHash: vi.fn(async (_tx, hash) =>
      invitations.find((row) => row.tokenHash === hash)
    ),
    updateInvitation: vi.fn(async (_tx, id, changes) => {
      const index = invitations.findIndex((row) => row.id === id);
      invitations[index] = { ...invitations[index], ...changes };
      return invitations[index];
    }),
    isStoreActive: vi.fn(async () => true),
  };

  const authorizer = {
    requireStorePermission: vi.fn(async ({ principal, storeId }: { principal: AuthPrincipal; storeId: number }) => {
      if (principal.platformRole === "admin") {
        return { access: "platform" as const, userId: principal.userId, storeId, permission: "store.staff.manage" as const };
      }
      if (storeId !== 3) throw new AppError("Permission denied", 403, "PERMISSION_DENIED");
      return {
        access: "membership" as const,
        userId: principal.userId,
        storeId,
        permission: "store.staff.manage" as const,
        membershipId: 9,
        membershipRole: "manager" as const,
      };
    }),
  };
  const audit: AuditWriter = {
    write: vi.fn(async () => {
      if (options.auditError) throw options.auditError;
    }),
  };
  const delivered: Parameters<StaffInvitationDelivery["deliver"]>[0][] = [];
  const delivery: StaffInvitationDelivery = {
    deliver: vi.fn(async (input) => {
      delivered.push(input);
      if (options.deliveryError) throw options.deliveryError;
      return { developmentUrl: `http://localhost/accept?token=${input.token}` };
    }),
  };
  const notifier: StaffAccessNotifier = { membershipChanged: vi.fn(async () => {}) };
  const rateLimiter: InvitationRateLimiter = { consume: vi.fn() };
  const service = new StaffService(
    repository,
    authorizer,
    audit,
    delivery,
    notifier,
    rateLimiter,
    { now: () => new Date(now) },
    48
  );
  return { service, repository, authorizer, audit, delivery, delivered, notifier, getMemberships: () => memberships, getInvitations: () => invitations };
};

describe("StaffService membership lifecycle", () => {
  it.each(["manager", "operator", "inventory_staff"] as StoreRole[])(
    "allows platform admin to assign %s",
    async (role) => {
      const { service, getMemberships, audit } = createHarness();
      await service.assignStaff({ principal: actor(), storeId: 3, email: "STAFF@example.com", role });
      expect(getMemberships()[0]).toMatchObject({ role, status: "active", userId: 20 });
      expect(audit.write).toHaveBeenCalled();
    }
  );

  it.each(["operator", "inventory_staff"] as StoreRole[])(
    "allows a manager to assign lower role %s",
    async (role) => {
      const { service } = createHarness();
      await expect(
        service.assignStaff({ principal: actor("user"), storeId: 3, email: "staff@example.com", role })
      ).resolves.toMatchObject({ role });
    }
  );

  it("blocks manager grants, cross-store management, and self assignment", async () => {
    const managerHarness = createHarness();
    await expect(
      managerHarness.service.assignStaff({
        principal: actor("user"),
        storeId: 3,
        email: "staff@example.com",
        role: "manager",
      })
    ).rejects.toMatchObject({ code: "MANAGER_ROLE_RESTRICTED" });
    await expect(
      managerHarness.service.assignStaff({
        principal: actor("user"),
        storeId: 4,
        email: "staff@example.com",
        role: "operator",
      })
    ).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    const selfHarness = createHarness({ users: { "manager@example.com": 10 } });
    await expect(
      selfHarness.service.assignStaff({
        principal: actor("user"),
        storeId: 3,
        email: "manager@example.com",
        role: "operator",
      })
    ).rejects.toMatchObject({ code: "SELF_ROLE_CHANGE_NOT_ALLOWED" });
  });

  it("prevents a manager from modifying a manager membership", async () => {
    const existing = member({ role: "manager", userId: 30 });
    const { service } = createHarness({ memberships: [existing] });
    await expect(
      service.updateStaff({ principal: actor("user"), storeId: 3, membershipId: existing.id, status: "suspended" })
    ).rejects.toMatchObject({ code: "MANAGER_ROLE_RESTRICTED" });
  });

  it("protects the last active manager", async () => {
    const existing = member({ role: "manager" });
    const { service } = createHarness({ memberships: [existing] });
    await expect(
      service.revokeStaff({ principal: actor(), storeId: 3, membershipId: existing.id })
    ).rejects.toMatchObject({ status: 409, code: "LAST_STORE_MANAGER" });
  });

  it("sets suspension, reactivation, and revocation timestamps", async () => {
    const existing = member();
    const harness = createHarness({ memberships: [existing] });
    const suspended = await harness.service.updateStaff({
      principal: actor(), storeId: 3, membershipId: existing.id, status: "suspended",
    });
    expect(suspended).toMatchObject({ status: "suspended", suspendedAt: now });
    const active = await harness.service.updateStaff({
      principal: actor(), storeId: 3, membershipId: existing.id, status: "active",
    });
    expect(active).toMatchObject({ status: "active", activatedAt: now, suspendedAt: null, revokedAt: null });
    const revoked = await harness.service.revokeStaff({
      principal: actor(), storeId: 3, membershipId: existing.id,
    });
    expect(revoked).toMatchObject({ status: "revoked", revokedAt: now, suspendedAt: null });
  });

  it("reactivates a revoked row instead of inserting a duplicate", async () => {
    const existing = member({ status: "revoked", revokedAt: new Date("2026-01-02") });
    const harness = createHarness({ memberships: [existing] });
    await harness.service.assignStaff({ principal: actor(), storeId: 3, email: "staff@example.com", role: "inventory_staff" });
    expect(harness.repository.insertMembership).not.toHaveBeenCalled();
    expect(harness.getMemberships()).toHaveLength(1);
    expect(harness.getMemberships()[0]).toMatchObject({ status: "active", role: "inventory_staff", revokedAt: null });
  });
});

describe("StaffService invitations", () => {
  it("returns development links only from the development adapter", async () => {
    const input = {
      email: "invitee@example.com",
      storeId: 3,
      role: "operator" as const,
      token: "raw-token",
      expiresAt: now,
    };
    await expect(
      new DevelopmentInvitationDelivery("http://localhost:5173").deliver(input)
    ).resolves.toEqual({
      developmentUrl:
        "http://localhost:5173/staff-invitations/accept?token=raw-token",
    });
    await expect(new UnavailableInvitationDelivery().deliver()).rejects.toMatchObject({
      status: 503,
      code: "INVITATION_DELIVERY_UNAVAILABLE",
    });
  });

  it("rate limits repeated invitation attempts without retaining raw tokens", () => {
    const limiter = new InMemoryInvitationRateLimiter(2, 60_000);
    limiter.consume("hashed-scope", now);
    limiter.consume("hashed-scope", now);
    expect(() => limiter.consume("hashed-scope", now)).toThrowError(
      expect.objectContaining({ status: 429, code: "INVITATION_RATE_LIMITED" })
    );
  });

  it("generates a 32-byte token, stores only its hash, and expires after 48 hours", async () => {
    const token = createInvitationToken();
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
    expect(hashInvitationToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(invitationTokenMatches(token, hashInvitationToken(token))).toBe(true);
    expect(invitationTokenMatches(`${token}x`, hashInvitationToken(token))).toBe(false);

    const harness = createHarness();
    const result = await harness.service.createInvitation({
      principal: actor(), storeId: 3, email: "Invitee@Example.com", role: "operator",
    });
    const stored = harness.getInvitations()[0];
    expect(stored.tokenHash).not.toBe(harness.delivered[0].token);
    expect(stored.expiresAt.getTime() - now.getTime()).toBe(48 * 60 * 60 * 1000);
    expect(result.developmentUrl).toContain(harness.delivered[0].token);
    expect(JSON.stringify(result.invitation)).not.toContain("tokenHash");
  });

  it.each([
    ["email mismatch", invitation(), actor("user"), "INVITATION_EMAIL_MISMATCH"],
    ["expired", invitation({ expiresAt: new Date("2026-08-27T09:00:00Z") }), { ...actor("user"), email: "invitee@example.com" }, "INVITATION_EXPIRED"],
    ["revoked", invitation({ revokedAt: new Date("2026-08-26") }), { ...actor("user"), email: "invitee@example.com" }, "INVITATION_REVOKED"],
    ["used", invitation({ acceptedAt: new Date("2026-08-26") }), { ...actor("user"), email: "invitee@example.com" }, "INVITATION_ALREADY_USED"],
  ])("rejects %s invitation", async (_name, record, acceptingActor, code) => {
    const harness = createHarness({ invitations: [record] });
    await expect(
      harness.service.acceptInvitation({ principal: acceptingActor, token: "acceptance-token" })
    ).rejects.toMatchObject({ code });
    expect(harness.getMemberships()).toHaveLength(0);
  });

  it("accepts once and repeated acceptance cannot duplicate membership", async () => {
    const record = invitation();
    const harness = createHarness({ invitations: [record] });
    const acceptingActor = { ...actor("user"), userId: 44, email: "invitee@example.com" };
    await harness.service.acceptInvitation({ principal: acceptingActor, token: "acceptance-token" });
    expect(harness.getMemberships()).toHaveLength(1);
    await expect(
      harness.service.acceptInvitation({ principal: acceptingActor, token: "acceptance-token" })
    ).rejects.toMatchObject({ code: "INVITATION_ALREADY_USED" });
    expect(harness.getMemberships()).toHaveLength(1);
  });

  it("cannot use an invitation to overwrite an existing manager role", async () => {
    const harness = createHarness({
      invitations: [invitation({ role: "operator" })],
      memberships: [member({ userId: 44, role: "manager", status: "suspended" })],
    });
    const acceptingActor = { ...actor("user"), userId: 44, email: "invitee@example.com" };
    await expect(
      harness.service.acceptInvitation({ principal: acceptingActor, token: "acceptance-token" })
    ).rejects.toMatchObject({ code: "MEMBERSHIP_ROLE_CONFLICT" });
    expect(harness.getMemberships()[0].role).toBe("manager");
  });

  it("rolls back invitation state when delivery fails", async () => {
    const harness = createHarness({ deliveryError: new AppError("Unavailable", 503, "INVITATION_DELIVERY_UNAVAILABLE") });
    await expect(
      harness.service.createInvitation({ principal: actor(), storeId: 3, email: "invitee@example.com", role: "operator" })
    ).rejects.toMatchObject({ code: "INVITATION_DELIVERY_UNAVAILABLE" });
    expect(harness.getInvitations()).toHaveLength(0);
    expect(harness.audit.write).not.toHaveBeenCalled();
  });

  it("aborts later dependencies when authorization or audit fails", async () => {
    const denied = createHarness();
    denied.authorizer.requireStorePermission.mockRejectedValueOnce(
      new AppError("Denied", 403, "PERMISSION_DENIED")
    );
    await expect(
      denied.service.assignStaff({ principal: actor("user"), storeId: 3, email: "staff@example.com", role: "operator" })
    ).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    expect(denied.repository.findUserByEmail).not.toHaveBeenCalled();

    const auditFailure = createHarness({ auditError: new Error("audit failed") });
    await expect(
      auditFailure.service.assignStaff({ principal: actor(), storeId: 3, email: "staff@example.com", role: "operator" })
    ).rejects.toThrow("audit failed");
    expect(auditFailure.notifier.membershipChanged).not.toHaveBeenCalled();
    expect(auditFailure.getMemberships()).toHaveLength(0);
  });
});
