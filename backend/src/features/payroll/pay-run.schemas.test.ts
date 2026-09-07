import { describe, expect, it } from "vitest";
import { createPayRunSchema, payPayRunSchema, payRunsQuerySchema } from "./pay-run.schemas";

describe("pay run schemas", () => {
  it("accepts only a complete calendar month", () => {
    expect(createPayRunSchema.parse({ storeId: 1, periodStart: "2026-02-01", periodEnd: "2026-02-28" })).toBeDefined();
    expect(createPayRunSchema.parse({ storeId: 1, periodStart: "2028-02-01", periodEnd: "2028-02-29" })).toBeDefined();
    expect(createPayRunSchema.safeParse({ storeId: 1, periodStart: "2026-02-02", periodEnd: "2026-02-28" }).success).toBe(false);
    expect(createPayRunSchema.safeParse({ storeId: 1, periodStart: "2026-02-01", periodEnd: "2026-02-27" }).success).toBe(false);
  });

  it("bounds list filters and requires a payment reference", () => {
    expect(payRunsQuerySchema.safeParse({ storeId: 1, from: "2026-08-01", to: "2026-07-01" }).success).toBe(false);
    expect(payPayRunSchema.safeParse({ paymentReference: "" }).success).toBe(false);
  });
});
