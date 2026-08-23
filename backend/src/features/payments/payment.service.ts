import { eq } from "drizzle-orm";
import { db } from "../../db";
import { paymentsTable } from "../../db/schema";
import type { TransactionType } from "../../utils/types";

class PaymentService {
  async createPayment(
    data: typeof paymentsTable.$inferInsert,
    tx?: TransactionType
  ) {
    const dbT = tx ?? db;
    const [payment] = await dbT
      .insert(paymentsTable)
      .values(data)
      .returning();
    return payment;
  }

  async updatePayment(
    data: Partial<typeof paymentsTable.$inferInsert>,
    id: number,
    tx?: TransactionType
  ) {
    const dbT = tx ?? db;
    await dbT.update(paymentsTable).set(data).where(eq(paymentsTable.id, id));
  }
}

export default new PaymentService();
