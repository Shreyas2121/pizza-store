import { createHmac, timingSafeEqual } from "crypto";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db";
import { paymentWebhookEventsTable } from "../../db/schema";
import { AppError } from "../../utils/error";
import { logger } from "../../utils/logger";
import paymentService from "./payment.service";
import { getRazorpayConfig } from "./razorpay.config";

const WEBHOOK_CLAIM_TIMEOUT_MS = 5 * 60_000;

const providerId = (prefix: "pay" | "order") =>
  z.string().regex(new RegExp(`^${prefix}_[A-Za-z0-9]+$`));

const paymentEntitySchema = z
  .object({
    id: providerId("pay"),
    order_id: providerId("order"),
    amount: z.number().int().nonnegative(),
    currency: z.string(),
    status: z.string(),
    error_code: z.string().nullable().optional(),
    error_description: z.string().nullable().optional(),
  })
  .passthrough();

const webhookSchema = z
  .object({
    event: z.string().min(1).max(100),
    payload: z
      .object({
        payment: z.object({ entity: paymentEntitySchema }).optional(),
      })
      .passthrough(),
  })
  .passthrough();

class RazorpayWebhookService {
  async handle(rawBody: Buffer, signature: string, eventId: string) {
    const config = getRazorpayConfig();
    if (!config) {
      throw new AppError(
        "Online payments are temporarily unavailable",
        503,
        "PAYMENT_UNAVAILABLE"
      );
    }
    if (!this.isValidSignature(rawBody, signature, config.webhookSecret)) {
      throw new AppError(
        "Webhook signature is invalid",
        400,
        "WEBHOOK_SIGNATURE_INVALID"
      );
    }

    let json: unknown;
    try {
      json = JSON.parse(rawBody.toString("utf8"));
    } catch {
      throw new AppError("Webhook body is not valid JSON", 400);
    }
    const parsed = webhookSchema.safeParse(json);
    if (!parsed.success) {
      throw new AppError("Webhook payload is invalid", 400);
    }

    const claim = await this.claimEvent(eventId, parsed.data.event);
    if (!claim.claimed) {
      if (claim.inProgress) {
        throw new AppError(
          "Webhook event is already being processed",
          503,
          "WEBHOOK_IN_PROGRESS"
        );
      }
      return {
        eventId,
        eventType: parsed.data.event,
        duplicate: true,
        inProgress: false,
        reconciliation: null,
      };
    }

    try {
      const reconciliation = await this.processEvent(parsed.data);
      await db
        .update(paymentWebhookEventsTable)
        .set({
          status: "processed",
          processedAt: new Date(),
          lastError: null,
        })
        .where(eq(paymentWebhookEventsTable.eventId, eventId));

      logger.info("Razorpay webhook processed", {
        eventId,
        eventType: parsed.data.event,
      });
      return {
        eventId,
        eventType: parsed.data.event,
        duplicate: false,
        inProgress: false,
        reconciliation,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message.slice(0, 500) : "Unknown error";
      await db
        .update(paymentWebhookEventsTable)
        .set({ status: "failed", lastError: message })
        .where(eq(paymentWebhookEventsTable.eventId, eventId));
      logger.error("Razorpay webhook processing failed", {
        eventId,
        eventType: parsed.data.event,
        error: message,
      });
      throw error;
    }
  }

  private async processEvent(event: z.infer<typeof webhookSchema>) {
    if (
      event.event !== "payment.captured" &&
      event.event !== "payment.failed" &&
      event.event !== "order.paid"
    ) {
      return { ignored: true as const, finalizedNow: false };
    }

    const payment = event.payload.payment?.entity;
    if (!payment) {
      throw new AppError("Webhook payment entity is missing", 400);
    }

    return await paymentService.reconcileProviderPayment(
      payment.order_id,
      payment.id,
      event.event === "payment.failed"
        ? {
            failureCode: payment.error_code,
            failureDescription: payment.error_description,
          }
        : {}
    );
  }

  private async claimEvent(eventId: string, eventType: string) {
    const [created] = await db
      .insert(paymentWebhookEventsTable)
      .values({ eventId, eventType, status: "processing" })
      .onConflictDoNothing({ target: paymentWebhookEventsTable.eventId })
      .returning({ id: paymentWebhookEventsTable.id });
    if (created) return { claimed: true as const, inProgress: false };

    return await db.transaction(async (tx) => {
      const [event] = await tx
        .select()
        .from(paymentWebhookEventsTable)
        .where(eq(paymentWebhookEventsTable.eventId, eventId))
        .for("update")
        .limit(1);
      if (!event) throw new AppError("Webhook event claim was lost", 500);
      if (event.eventType !== eventType) {
        throw new AppError("Webhook event ID was reused", 409);
      }
      if (event.status === "processed") {
        return { claimed: false as const, inProgress: false };
      }

      const claimIsFresh =
        event.status === "processing" &&
        event.updatedAt.getTime() > Date.now() - WEBHOOK_CLAIM_TIMEOUT_MS;
      if (claimIsFresh) {
        return { claimed: false as const, inProgress: true };
      }

      await tx
        .update(paymentWebhookEventsTable)
        .set({
          status: "processing",
          attempts: sql`${paymentWebhookEventsTable.attempts} + 1`,
          lastError: null,
        })
        .where(eq(paymentWebhookEventsTable.id, event.id));
      return { claimed: true as const, inProgress: false };
    });
  }

  private isValidSignature(rawBody: Buffer, signature: string, secret: string) {
    if (!/^[A-Fa-f0-9]{64}$/.test(signature)) return false;
    const expected = createHmac("sha256", secret).update(rawBody).digest();
    const received = Buffer.from(signature, "hex");
    return received.length === expected.length && timingSafeEqual(received, expected);
  }
}

export default new RazorpayWebhookService();
