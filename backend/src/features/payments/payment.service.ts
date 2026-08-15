import { eq } from "drizzle-orm";
import { db } from "../../db";
import { paymentsTable } from "../../db/schema";

class PaymentService {
  async processPayment(razorpayOrderId: any) {
    const res = await db
      .insert(paymentsTable)
      .values({
        status: "pending",
        paymentDate: undefined,
        razorpayOrderId,
      })
      .returning();

    return res[0].id;
  }

  async updatePayment(
    data: Partial<typeof paymentsTable.$inferInsert>,
    id: number
  ) {
    await db.update(paymentsTable).set(data).where(eq(paymentsTable.id, id));
  }
}

export default new PaymentService();
