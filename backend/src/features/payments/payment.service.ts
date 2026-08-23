import { eq } from "drizzle-orm";
import { db } from "../../db";
import { ordersTable, paymentsTable, storesTable } from "../../db/schema";
import { AppError } from "../../utils/error";
import { logger } from "../../utils/logger";
import type { TransactionType } from "../../utils/types";
import cartService from "../cart/cart.service";
import checkoutService from "../checkout/checkout.service";
import { getRazorpayConfig } from "./razorpay.config";
import { createRazorpayGateway } from "./razorpay.gateway";
import type { RazorpayOrderSnapshot } from "./razorpay.types";

const MIN_RAZORPAY_AMOUNT_PAISE = 100;

interface InitiateRazorpayOrderInput {
  userId: number;
  addressId: number;
  couponCode?: string | null;
  clientRequestId: string;
}

interface LocalRazorpayAttempt {
  localOrderId: number;
  localPaymentId: number;
  userId: number;
  storeId: number;
  storeName: string;
  couponId: number | null;
  provider: "cod" | "razorpay";
  amountPaise: number;
  currency: "INR";
  status: "pending" | "processing" | "completed" | "failed" | "refunded";
  providerStatus: string | null;
  providerOrderId: string | null;
  failureCode: string | null;
  failureDescription: string | null;
}

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

  async initiateRazorpayOrder(data: InitiateRazorpayOrderInput) {
    const config = getRazorpayConfig();
    if (!config) {
      throw new AppError(
        "Online payments are temporarily unavailable",
        503,
        "PAYMENT_UNAVAILABLE"
      );
    }

    const attempt = await this.findOrCreateLocalAttempt(data);
    return await this.ensureProviderOrder(attempt, config);
  }

  async retryRazorpayOrder(localOrderId: number, userId: number) {
    const config = getRazorpayConfig();
    if (!config) {
      throw new AppError(
        "Online payments are temporarily unavailable",
        503,
        "PAYMENT_UNAVAILABLE"
      );
    }

    const attempt = await this.getAttemptByOrderId(localOrderId);
    if (!attempt || attempt.userId !== userId) {
      throw new AppError("Payment order not found", 404);
    }
    if (attempt.provider !== "razorpay") {
      throw new AppError("Online payment order not found", 404);
    }

    const retryableAttempt =
      attempt.status === "failed" && attempt.providerOrderId
        ? await this.reactivateProviderOrder(attempt)
        : attempt;
    return await this.ensureProviderOrder(retryableAttempt, config);
  }

  async getRazorpayOrderStatus(localOrderId: number, userId: number) {
    const attempt = await this.getAttemptByOrderId(localOrderId);
    if (!attempt || attempt.userId !== userId) {
      throw new AppError("Payment order not found", 404);
    }
    if (attempt.provider !== "razorpay") {
      throw new AppError("Online payment order not found", 404);
    }
    return this.toCheckoutResponse(attempt, getRazorpayConfig()?.keyId ?? null);
  }

  private async findOrCreateLocalAttempt(data: InitiateRazorpayOrderInput) {
    const existing = await this.getAttemptByClientRequestId(data.clientRequestId);
    if (existing) {
      if (existing.userId !== data.userId) {
        throw new AppError(
          "Client request ID has already been used",
          409,
          "PAYMENT_REQUEST_CONFLICT"
        );
      }
      return existing;
    }

    try {
      return await db.transaction(async (tx) => {
        const quote = await checkoutService.buildQuote(data, tx);
        if (quote.totalPaise < MIN_RAZORPAY_AMOUNT_PAISE) {
          throw new AppError(
            "Online payment amount must be at least ₹1.00",
            400,
            "PAYMENT_AMOUNT_TOO_LOW"
          );
        }

        const payment = await this.createPayment(
          {
            provider: "razorpay",
            status: "pending",
            amountPaise: quote.totalPaise,
            currency: "INR",
            clientRequestId: data.clientRequestId,
          },
          tx
        );
        const order = await checkoutService.createOrderSnapshot(
          quote,
          {
            userId: data.userId,
            addressId: data.addressId,
            paymentId: payment.id,
            paymentType: "razorpay",
            status: "awaiting_payment",
          },
          tx
        );

        if (quote.coupon) {
          await checkoutService.recordCouponUse(
            {
              couponId: quote.coupon.id,
              orderId: order.id,
              userId: data.userId,
              status: "reserved",
            },
            tx
          );
        }

        // The order contains a durable item snapshot, so the cart can be
        // cleared without losing the customer's recoverable payment attempt.
        await cartService.clearCart(data.userId, tx);

        return {
          localOrderId: order.id,
          localPaymentId: payment.id,
          userId: order.userId,
          storeId: order.storeId,
          storeName: quote.cart.store!.name,
          couponId: order.couponId,
          provider: payment.provider,
          amountPaise: payment.amountPaise,
          currency: payment.currency,
          status: payment.status,
          providerStatus: payment.providerStatus,
          providerOrderId: payment.providerOrderId,
          failureCode: payment.failureCode,
          failureDescription: payment.failureDescription,
        } satisfies LocalRazorpayAttempt;
      });
    } catch (error) {
      // A concurrent request with the same idempotency key can win the unique
      // insert. Resolve that race to its durable attempt instead of surfacing a
      // database constraint error.
      const concurrentAttempt = await this.getAttemptByClientRequestId(
        data.clientRequestId
      );
      if (concurrentAttempt?.userId === data.userId) return concurrentAttempt;
      throw error;
    }
  }

  private async ensureProviderOrder(
    attempt: LocalRazorpayAttempt,
    config: { keyId: string; keySecret: string }
  ) {
    if (attempt.providerOrderId || attempt.status === "completed") {
      return this.toCheckoutResponse(attempt, config.keyId);
    }

    const claim = await this.claimProviderOrderCreation(attempt);
    if (!claim.claimed) {
      return this.toCheckoutResponse(claim.attempt, config.keyId);
    }

    const gateway = createRazorpayGateway(config);
    let providerOrder: RazorpayOrderSnapshot;
    try {
      providerOrder = await gateway.createOrder({
        amountPaise: claim.attempt.amountPaise,
        currency: claim.attempt.currency,
        receipt: this.buildReceipt(claim.attempt),
        notes: {
          localOrderId: claim.attempt.localOrderId,
          localPaymentId: claim.attempt.localPaymentId,
          storeId: claim.attempt.storeId,
        },
      });
    } catch (error) {
      const description =
        error instanceof Error
          ? error.message.slice(0, 500)
          : "Provider request failed";
      await this.markProviderCreationFailed(
        claim.attempt,
        "RAZORPAY_ORDER_CREATE_FAILED",
        "Razorpay could not create the payment order"
      );
      logger.error("Razorpay order creation failed", {
        localOrderId: claim.attempt.localOrderId,
        localPaymentId: claim.attempt.localPaymentId,
        error: description,
      });
      throw new AppError(
        "Could not start online payment. Please retry",
        502,
        "PAYMENT_INIT_FAILED",
        {
          localOrderId: claim.attempt.localOrderId,
          localPaymentId: claim.attempt.localPaymentId,
        }
      );
    }

    if (
      providerOrder.amountPaise !== claim.attempt.amountPaise ||
      providerOrder.currency !== claim.attempt.currency ||
      providerOrder.status !== "created"
    ) {
      await this.markProviderCreationFailed(
        claim.attempt,
        "RAZORPAY_ORDER_MISMATCH",
        "Provider order did not match the local payment"
      );
      logger.error("Razorpay returned a mismatched order", {
        localOrderId: claim.attempt.localOrderId,
        localPaymentId: claim.attempt.localPaymentId,
        providerOrderId: providerOrder.id,
      });
      throw new AppError(
        "Online payment could not be prepared safely",
        502,
        "PAYMENT_PROVIDER_MISMATCH",
        {
          localOrderId: claim.attempt.localOrderId,
          localPaymentId: claim.attempt.localPaymentId,
        }
      );
    }

    try {
      const saved = await db.transaction(async (tx) => {
        const [lockedPayment] = await tx
          .select()
          .from(paymentsTable)
          .where(eq(paymentsTable.id, claim.attempt.localPaymentId))
          .for("update")
          .limit(1);

        if (!lockedPayment) throw new AppError("Payment not found", 404);
        if (
          lockedPayment.providerOrderId &&
          lockedPayment.providerOrderId !== providerOrder.id
        ) {
          throw new AppError("Payment already has a different provider order", 409);
        }

        await this.updatePayment(
          {
            status: "processing",
            providerStatus: providerOrder.status,
            providerOrderId: providerOrder.id,
            failureCode: null,
            failureDescription: null,
            failedAt: null,
          },
          lockedPayment.id,
          tx
        );

        return {
          ...claim.attempt,
          status: "processing" as const,
          providerStatus: providerOrder.status,
          providerOrderId: providerOrder.id,
          failureCode: null,
          failureDescription: null,
        };
      });
      return this.toCheckoutResponse(saved, config.keyId);
    } catch (error) {
      logger.error("Razorpay order was created but could not be persisted", {
        localOrderId: claim.attempt.localOrderId,
        localPaymentId: claim.attempt.localPaymentId,
        providerOrderId: providerOrder.id,
        error: error instanceof Error ? error.message : "Persistence failed",
      });
      throw error;
    }
  }

  private async claimProviderOrderCreation(attempt: LocalRazorpayAttempt) {
    return await db.transaction(async (tx) => {
      const [payment] = await tx
        .select()
        .from(paymentsTable)
        .where(eq(paymentsTable.id, attempt.localPaymentId))
        .for("update")
        .limit(1);

      if (!payment) throw new AppError("Payment not found", 404);
      const current = { ...attempt, ...this.paymentFields(payment) };
      if (
        payment.providerOrderId ||
        payment.status === "processing" ||
        payment.status === "completed" ||
        payment.status === "refunded"
      ) {
        return { claimed: false as const, attempt: current };
      }

      if (payment.status === "failed" && attempt.couponId) {
        await checkoutService.restoreCouponReservation(
          { couponId: attempt.couponId, orderId: attempt.localOrderId },
          tx
        );
      }

      await this.updatePayment(
        {
          status: "processing",
          failureCode: null,
          failureDescription: null,
          failedAt: null,
        },
        payment.id,
        tx
      );
      return {
        claimed: true as const,
        attempt: {
          ...current,
          status: "processing" as const,
          failureCode: null,
          failureDescription: null,
        },
      };
    });
  }

  private async markProviderCreationFailed(
    attempt: LocalRazorpayAttempt,
    failureCode: string,
    failureDescription: string
  ) {
    await db.transaction(async (tx) => {
      await this.updatePayment(
        {
          status: "failed",
          failureCode,
          failureDescription,
          failedAt: new Date(),
        },
        attempt.localPaymentId,
        tx
      );
      await checkoutService.releaseCouponReservation(attempt.localOrderId, tx);
    });
  }

  private async reactivateProviderOrder(attempt: LocalRazorpayAttempt) {
    return await db.transaction(async (tx) => {
      const [payment] = await tx
        .select()
        .from(paymentsTable)
        .where(eq(paymentsTable.id, attempt.localPaymentId))
        .for("update")
        .limit(1);

      if (!payment) throw new AppError("Payment not found", 404);
      const current = { ...attempt, ...this.paymentFields(payment) };
      if (payment.status !== "failed" || !payment.providerOrderId) {
        return current;
      }

      if (attempt.couponId) {
        await checkoutService.restoreCouponReservation(
          { couponId: attempt.couponId, orderId: attempt.localOrderId },
          tx
        );
      }
      await this.updatePayment(
        {
          status: "processing",
          failureCode: null,
          failureDescription: null,
          failedAt: null,
        },
        payment.id,
        tx
      );

      return {
        ...current,
        status: "processing" as const,
        failureCode: null,
        failureDescription: null,
      };
    });
  }

  private async getAttemptByClientRequestId(clientRequestId: string) {
    const [attempt] = await this.selectAttempts()
      .where(eq(paymentsTable.clientRequestId, clientRequestId))
      .limit(1);
    return attempt;
  }

  private async getAttemptByOrderId(localOrderId: number) {
    const [attempt] = await this.selectAttempts()
      .where(eq(ordersTable.id, localOrderId))
      .limit(1);
    return attempt;
  }

  private selectAttempts() {
    return db
      .select({
        localOrderId: ordersTable.id,
        localPaymentId: paymentsTable.id,
        userId: ordersTable.userId,
        storeId: ordersTable.storeId,
        storeName: storesTable.name,
        couponId: ordersTable.couponId,
        provider: paymentsTable.provider,
        amountPaise: paymentsTable.amountPaise,
        currency: paymentsTable.currency,
        status: paymentsTable.status,
        providerStatus: paymentsTable.providerStatus,
        providerOrderId: paymentsTable.providerOrderId,
        failureCode: paymentsTable.failureCode,
        failureDescription: paymentsTable.failureDescription,
      })
      .from(ordersTable)
      .innerJoin(paymentsTable, eq(ordersTable.paymentId, paymentsTable.id))
      .innerJoin(storesTable, eq(ordersTable.storeId, storesTable.id))
      .$dynamic();
  }

  private paymentFields(payment: typeof paymentsTable.$inferSelect) {
    return {
      amountPaise: payment.amountPaise,
      currency: payment.currency,
      status: payment.status,
      providerStatus: payment.providerStatus,
      providerOrderId: payment.providerOrderId,
      failureCode: payment.failureCode,
      failureDescription: payment.failureDescription,
    };
  }

  private buildReceipt(attempt: LocalRazorpayAttempt) {
    return `order_${attempt.localOrderId}_payment_${attempt.localPaymentId}`;
  }

  private toCheckoutResponse(attempt: LocalRazorpayAttempt, keyId: string | null) {
    return {
      localOrderId: attempt.localOrderId,
      localPaymentId: attempt.localPaymentId,
      keyId,
      razorpayOrderId: attempt.providerOrderId,
      amountPaise: attempt.amountPaise,
      currency: attempt.currency,
      name: "PizzaStore",
      description: `Order from ${attempt.storeName}`,
      paymentStatus: attempt.status,
      providerStatus: attempt.providerStatus,
      checkoutReady: Boolean(
        keyId && attempt.providerOrderId && attempt.status === "processing"
      ),
      failure:
        attempt.status === "failed"
          ? {
              code: attempt.failureCode,
              description: attempt.failureDescription,
            }
          : null,
    };
  }
}

export default new PaymentService();
