import { describe, expect, it } from "vitest";
import { maskSensitiveLast4, PayrollSensitiveDataProtector } from "./payroll-sensitive-data";

describe("payroll sensitive data", () => {
  it("encrypts authenticated values and exposes only a last-four mask", () => {
    const protector = new PayrollSensitiveDataProtector("test-only-payroll-key-with-at-least-32-characters");
    const first = protector.protect("ab1234567890");
    const second = protector.protect("ab1234567890");
    expect(first.encrypted).not.toContain("AB1234567890");
    expect(first.encrypted).not.toBe(second.encrypted);
    expect(protector.decrypt(first.encrypted)).toBe("AB1234567890");
    expect(maskSensitiveLast4(first.last4)).toBe("••••7890");
  });

  it("fails closed without a dedicated encryption secret", () => {
    expect(() => new PayrollSensitiveDataProtector(null).protect("AB123456")).toThrowError(
      expect.objectContaining({ code: "PAYROLL_ENCRYPTION_NOT_CONFIGURED" })
    );
  });
});
