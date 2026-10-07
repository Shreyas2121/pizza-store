import { describe, expect, it } from "vitest";
import { ordersTable, storesTable, usersTable } from "../../db/schema";
import type { TransactionType } from "../../utils/types";
import paymentRepository from "./payment.repository";

describe("payment promotion projection and lifecycle locking", () => {
  it("bounds expiry candidates independently of tracked inventory using the saved attempt deadline", () => {
    const query = paymentRepository.expiredAwaitingQuery(25, new Date("2026-10-07T12:00:00Z")).toSQL();
    expect(query.params).toEqual(["awaiting_payment", "razorpay", "pending", "processing", "failed", new Date("2026-10-07T12:00:00Z"), 25]);
    expect(query.sql).not.toContain("inventory_reservations");
    expect(query.sql).toContain('"payment_attempts"."expires_at" <');
    expect(query.sql).not.toContain('"payments"."updated_at"');
  });
  it("reads bounded order application snapshots without joining mutable definitions or a singular coupon", () => {
    const query = paymentRepository.selectAttempts().toSQL();
    expect(query.sql).toContain('"promotion_applications"."promotion_name"');
    expect(query.sql).toContain('"promotion_applications"."definition_version"');
    expect(query.sql).toContain('"promotion_applications"."order_id" = "orders"."id"');
    expect(query.sql).toContain('order by "promotion_applications"."promotion_id"');
    expect(query.sql).toContain("'[]'::jsonb");
    expect(query.sql).not.toContain('"coupon_id"');
    expect(query.sql).not.toContain('join "promotions"');
  });
  it("locks the existing order, user eligibility and store before payment/inventory/application work", async () => {
    const locks: unknown[] = [];
    const txDouble = { select: () => ({ from: (table: unknown) => {
      const query = { where: () => query, for: (mode: string) => {
        locks.push([table, mode]); return query;
      }, limit: async () => [{ id: 42, userId: 7, storeId: 1, status: "awaiting_payment" }] };
      return query;
    } }) };
    // Read-only partial transaction double; no database connection is used.
    const tx = txDouble as unknown as TransactionType;
    expect(await paymentRepository.lockLifecycleOwner(42, tx)).toBe("awaiting_payment");
    expect(locks).toEqual([[ordersTable, "update"], [usersTable, "update"], [storesTable, "update"]]);
  });
});
