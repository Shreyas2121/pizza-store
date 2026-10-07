import { describe, expect, it } from "vitest";
import { initiateRazorpayOrderSchema } from "../../utils/zodSchema";

const request = { addressId: 2, clientRequestId: "c7c7f5f4-4079-4b9f-8ebf-f740322e1d53" };
describe("online manual coupon request contract", () => {
  it("normalizes a manual code with the same 64-character policy as COD", () => {
    expect(initiateRazorpayOrderSchema.parse({ ...request, couponCode: " save " }).couponCode).toBe("SAVE");
    expect(initiateRazorpayOrderSchema.safeParse({ ...request, couponCode: "S".repeat(64) }).success).toBe(true);
    expect(initiateRazorpayOrderSchema.safeParse({ ...request, couponCode: "ß".repeat(64) }).success).toBe(false);
  });
  it.each([{ offerId: 1 }, { pricePaise: 1 }, { discountMode: "coupon" }, { couponId: 1 }])("rejects customer-supplied promotion or money fields: %j", (extra) => {
    expect(initiateRazorpayOrderSchema.safeParse({ ...request, ...extra }).success).toBe(false);
  });
});
