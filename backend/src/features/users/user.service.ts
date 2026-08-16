import { and, asc, eq } from "drizzle-orm";
import { db } from "../../db";
import { addressTable, ordersTable, usersTable } from "../../db/schema";
import { AppError } from "../../utils/error";

class UserService {
  async createUser(user: typeof usersTable.$inferInsert) {
    const email = user.email;

    const existingUser = await this.getUserByEmail(email);
    if (existingUser) {
      throw new AppError(`User with email ${email} already exists`, 409);
    }

    const [u] = await db.insert(usersTable).values(user).returning();

    return u;
  }

  async getUserByEmail(email: string) {
    return db.query.usersTable.findFirst({
      where: eq(usersTable.email, email),
    });
  }

  async getUserAddress(userId: number) {
    return db.query.addressTable.findMany({
      where: eq(addressTable.userId, userId),
      orderBy: asc(addressTable.id),
    });
  }

  async createUserAddress(data: typeof addressTable.$inferInsert) {
    return await db.insert(addressTable).values(data).returning();
  }

  async updateUserAddress(id: number, userId: number, data: Omit<typeof addressTable.$inferInsert, "userId">) {
    if (await this.addressHasOrders(id, userId)) {
      throw new AppError("This address is linked to an order and cannot be changed.", 409);
    }
    return await db.update(addressTable).set(data).where(and(eq(addressTable.id, id), eq(addressTable.userId, userId))).returning();
  }

  async deleteUserAddress(id: number, userId: number) {
    if (await this.addressHasOrders(id, userId)) {
      throw new AppError("This address is linked to an order and cannot be deleted.", 409);
    }
    return await db.delete(addressTable).where(and(eq(addressTable.id, id), eq(addressTable.userId, userId))).returning({ id: addressTable.id });
  }

  async addressHasOrders(id: number, userId: number) {
    return db.query.ordersTable.findFirst({
      columns: { id: true },
      where: and(eq(ordersTable.addressId, id), eq(ordersTable.userId, userId)),
    });
  }

  async getUserById(id: number) {
    return db.query.usersTable.findFirst({
      where: eq(usersTable.id, id),
    });
  }

  async getAllUsers() {
    return await db.query.usersTable.findMany({
      columns: {
        id: true,
      },
    });
  }

  async addressExists(userId: number) {
    return await db.query.addressTable.findFirst({
      columns: {
        id: true,
      },
      where: eq(addressTable.userId, userId),
    });
  }
}

export default new UserService();
