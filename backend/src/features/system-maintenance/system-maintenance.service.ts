import { eq, getTableName, is, ne, sql } from "drizzle-orm";
import { db } from "../../db";
import { PgTable } from "drizzle-orm/pg-core";
import * as schema from "../../db/schema";
import { auditLogsTable, usersTable } from "../../db/schema";
import { AppError } from "../../utils/error";
import type { TransactionType } from "../../utils/types";
import type { AuthPrincipal } from "../auth/auth.types";

// Keep the reset FK-complete as application domains are added. Users are
// deleted separately so platform administrator accounts can be preserved.
export const APPLICATION_DATA_TABLE_NAMES = [...new Set(
  Object.values(schema).filter((value) => is(value, PgTable))
    .map(getTableName).filter((name) => name !== getTableName(usersTable))
)].sort();

const quoteIdentifier = (identifier: string) =>
  `"${identifier.replaceAll('"', '""')}"`;

export const TRUNCATE_APPLICATION_DATA_SQL = `TRUNCATE TABLE ${APPLICATION_DATA_TABLE_NAMES.map(
  quoteIdentifier
).join(", ")} RESTART IDENTITY`;

class SystemMaintenanceService {
  async clearAllExceptAdmins(
    actor: AuthPrincipal,
    transaction?: TransactionType
  ) {
    const execute = async (tx: TransactionType) => {
      await tx.execute(sql.raw('LOCK TABLE "users" IN EXCLUSIVE MODE'));

      const [requestingAdmin] = await tx
        .select({ id: usersTable.id, role: usersTable.role, email: usersTable.email })
        .from(usersTable)
        .where(eq(usersTable.id, actor.userId))
        .for("update")
        .limit(1);
      if (!requestingAdmin || requestingAdmin.role !== "admin") {
        throw new AppError(
          "Admin account is no longer authorized",
          403,
          "ADMIN_ACCOUNT_NOT_AUTHORIZED"
        );
      }

      await tx.execute(sql.raw(TRUNCATE_APPLICATION_DATA_SQL));
      const deletedUsers = await tx
        .delete(usersTable)
        .where(ne(usersTable.role, "admin"))
        .returning({ id: usersTable.id });
      const preservedAdmins = await tx
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.role, "admin"));

      await tx.insert(auditLogsTable).values({
        actorUserId: requestingAdmin.id,
        actorEmailSnapshot: requestingAdmin.email ?? actor.email,
        platformRole: "admin",
        storeId: null,
        action: "system.clear_all",
        resourceType: "system",
        resourceId: "application_data",
        outcome: "success",
        metadata: {
          clearedTableCount: APPLICATION_DATA_TABLE_NAMES.length,
          deletedNonAdminUsers: deletedUsers.length,
          preservedAdminUsers: preservedAdmins.length,
        },
      });

      return {
        cleared: true as const,
        clearedTableCount: APPLICATION_DATA_TABLE_NAMES.length,
        deletedNonAdminUsers: deletedUsers.length,
        preservedAdminUsers: preservedAdmins.length,
      };
    };

    return transaction ? execute(transaction) : db.transaction(execute);
  }
}

export { SystemMaintenanceService };
export default new SystemMaintenanceService();
