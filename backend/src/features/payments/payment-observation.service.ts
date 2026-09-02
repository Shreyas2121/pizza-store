import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import { paymentsTable, paymentAttemptsTable } from "../../db/schema";
import paymentRepository from "./payment.repository";
import type { LocalRazorpayAttempt } from "./payment.types";

export class PaymentObservationService {
  async recordProviderObservation(
    attempt: LocalRazorpayAttempt,
    providerStatus: typeof paymentsTable.$inferInsert.providerStatus
  ) {
    await db.transaction(async (tx) => {
      const [payment] = await tx
        .select()
        .from(paymentsTable)
        .where(eq(paymentsTable.id, attempt.localPaymentId))
        .for("update")
        .limit(1);
      if (
        !payment ||
        payment.status === "completed" ||
        payment.status === "refunded"
      ) {
        return;
      }
      await paymentRepository.updatePayment(
        { providerStatus },
        payment.id,
        tx
      );
      await tx
        .update(paymentAttemptsTable)
        .set({ providerStatus, updatedAt: new Date() })
        .where(
          and(
            eq(paymentAttemptsTable.orderId, attempt.localOrderId),
            eq(paymentAttemptsTable.provider, "razorpay")
          )
        );
    });
  }
}

export default new PaymentObservationService();
