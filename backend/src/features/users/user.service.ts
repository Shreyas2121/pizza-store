import { eq } from "drizzle-orm";
import { db } from "../../db";
import { addressTable, usersTable } from "../../db/schema";
import { AppError } from "../../utils/error";

class UserService {
  async createUser(user: typeof usersTable.$inferInsert) {
    const email = user.email;

    const existingUser = await this.getUserByEmail(email);
    if (existingUser) {
      throw new AppError(`User with email ${email} already exists`, 401);
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
    });
  }

  async createUserAddress(data: typeof addressTable.$inferInsert) {
    return await db.insert(addressTable).values(data).returning();
  }

  async getUserById(id: number) {
    return db.query.usersTable.findFirst({
      where: eq(usersTable.id, id),
    });
  }
}

export default new UserService();
