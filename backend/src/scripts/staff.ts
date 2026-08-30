import { and, eq, sql } from "drizzle-orm";
import { checkDatabaseConnection, closeDatabase, db } from "../db";
import {
  storeMembershipsTable,
  storesTable,
  usersTable,
} from "../db/schema";
import auditService from "../features/audit/audit.service";
import { isStoreRole } from "../features/access/access.permissions";
import type { AuthPrincipal } from "../features/auth/auth.types";
import type { StoreRole } from "../utils/types";
import { env } from "../utils/zodSchema";

export interface StaffSeedAssignment {
  email: string;
  role: StoreRole;
}

export interface StaffSeedConfig {
  actorEmail: string;
  storeSlug: string;
  assignments: StaffSeedAssignment[];
}

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

const requireEmail = (value: string, option: string): string => {
  const email = normalizeEmail(value);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(`${option} must contain a valid email address.`);
  }
  return email;
};

export const assertDevelopmentSeedEnvironment = (nodeEnv: string): void => {
  if (nodeEnv !== "development") {
    throw new Error("The staff seed is development-only and requires NODE_ENV=development.");
  }
};

export const parseStaffSeedArgs = (args: string[]): StaffSeedConfig => {
  let actorEmail: string | undefined;
  let storeSlug: string | undefined;
  const assignments: StaffSeedAssignment[] = [];

  for (const arg of args) {
    if (arg.startsWith("--actor=")) {
      if (actorEmail) throw new Error("--actor may be provided only once.");
      actorEmail = requireEmail(arg.slice("--actor=".length), "--actor");
      continue;
    }
    if (arg.startsWith("--store=")) {
      if (storeSlug) throw new Error("--store may be provided only once.");
      storeSlug = arg.slice("--store=".length).trim();
      if (!storeSlug) throw new Error("--store requires a store slug.");
      continue;
    }
    if (arg.startsWith("--member=")) {
      const value = arg.slice("--member=".length);
      const separator = value.indexOf(":");
      const role = value.slice(0, separator);
      if (separator <= 0 || !isStoreRole(role)) {
        throw new Error("--member must use manager|operator|inventory_staff:<email>.");
      }
      assignments.push({
        role,
        email: requireEmail(value.slice(separator + 1), "--member"),
      });
      continue;
    }
    throw new Error(`Unknown staff seed option: ${arg}`);
  }

  if (!actorEmail) throw new Error("--actor=<platform-admin-email> is required.");
  if (!storeSlug) throw new Error("--store=<store-slug> is required.");
  if (assignments.length === 0) {
    throw new Error("At least one --member=<role>:<email> assignment is required.");
  }

  const emails = new Set<string>();
  for (const assignment of assignments) {
    if (emails.has(assignment.email)) {
      throw new Error(`Duplicate staff seed assignment for ${assignment.email}.`);
    }
    emails.add(assignment.email);
  }

  return { actorEmail, storeSlug, assignments };
};

export async function seedStaffMemberships(config: StaffSeedConfig) {
  return db.transaction(async (tx) => {
    const [actor] = await tx
      .select({
        id: usersTable.id,
        email: usersTable.email,
        role: usersTable.role,
        tokenVersion: usersTable.tokenVersion,
        isActive: usersTable.isActive,
      })
      .from(usersTable)
      .where(sql`lower(${usersTable.email}) = ${config.actorEmail}`)
      .limit(1);

    if (!actor || actor.role !== "admin" || !actor.isActive) {
      throw new Error("--actor must identify an existing active platform admin.");
    }

    const [store] = await tx
      .select({ id: storesTable.id, name: storesTable.name, isActive: storesTable.isActive })
      .from(storesTable)
      .where(eq(storesTable.slug, config.storeSlug))
      .limit(1);
    if (!store) throw new Error(`Store slug '${config.storeSlug}' was not found.`);
    if (!store.isActive) throw new Error(`Store '${store.name}' is inactive.`);

    const principal: AuthPrincipal = {
      userId: actor.id,
      email: actor.email,
      platformRole: "admin",
      tokenVersion: actor.tokenVersion,
    };
    const now = new Date();
    let created = 0;
    let updated = 0;
    let unchanged = 0;

    for (const assignment of config.assignments) {
      const [user] = await tx
        .select({
          id: usersTable.id,
          email: usersTable.email,
          role: usersTable.role,
          isActive: usersTable.isActive,
        })
        .from(usersTable)
        .where(sql`lower(${usersTable.email}) = ${assignment.email}`)
        .limit(1);

      if (!user) throw new Error(`Staff user '${assignment.email}' was not found.`);
      if (!user.isActive) throw new Error(`Staff user '${assignment.email}' is inactive.`);
      if (user.role === "admin") {
        throw new Error(`Platform admin '${assignment.email}' cannot receive a store membership from this seed.`);
      }

      const [existing] = await tx
        .select({
          id: storeMembershipsTable.id,
          role: storeMembershipsTable.role,
          status: storeMembershipsTable.status,
        })
        .from(storeMembershipsTable)
        .where(
          and(
            eq(storeMembershipsTable.userId, user.id),
            eq(storeMembershipsTable.storeId, store.id),
          ),
        )
        .for("update");

      if (existing?.role === assignment.role && existing.status === "active") {
        unchanged += 1;
        continue;
      }

      const [membership] = existing
        ? await tx
            .update(storeMembershipsTable)
            .set({
              role: assignment.role,
              status: "active",
              updatedBy: actor.id,
              activatedAt: now,
              suspendedAt: null,
              revokedAt: null,
            })
            .where(eq(storeMembershipsTable.id, existing.id))
            .returning({
              id: storeMembershipsTable.id,
              role: storeMembershipsTable.role,
              status: storeMembershipsTable.status,
            })
        : await tx
            .insert(storeMembershipsTable)
            .values({
              userId: user.id,
              storeId: store.id,
              role: assignment.role,
              status: "active",
              createdBy: actor.id,
              updatedBy: actor.id,
              activatedAt: now,
            })
            .returning({
              id: storeMembershipsTable.id,
              role: storeMembershipsTable.role,
              status: storeMembershipsTable.status,
            });

      await auditService.write({
        tx,
        actor: principal,
        storeId: store.id,
        action: "staff.membership.assigned",
        resourceType: "store_membership",
        resourceId: membership.id,
        ...(existing ? { before: { role: existing.role, status: existing.status } } : {}),
        after: { role: membership.role, status: membership.status },
        metadata: { source: "development_staff_seed" },
      });

      if (existing) updated += 1;
      else created += 1;
    }

    return { store, created, updated, unchanged };
  });
}

async function run() {
  assertDevelopmentSeedEnvironment(env.NODE_ENV);
  const config = parseStaffSeedArgs(process.argv.slice(2));
  const isConnected = await checkDatabaseConnection();
  if (!isConnected) {
    throw new Error("Cannot seed staff without a healthy database connection.");
  }

  const result = await seedStaffMemberships(config);
  console.log(`Staff seed completed for ${result.store.name} (#${result.store.id}).`);
  console.log(`Created ${result.created}, updated ${result.updated}, unchanged ${result.unchanged}.`);
  console.log("No users, passwords, or platform roles were created or changed.");
}

if (require.main === module) {
  run()
    .catch((cause) => {
      console.error(cause instanceof Error ? cause.message : "Staff seed failed.");
      process.exitCode = 1;
    })
    .finally(async () => {
      await closeDatabase().catch(() => {});
    });
}
