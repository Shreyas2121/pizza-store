import { describe, expect, it, vi } from "vitest";
import { RazorpayTestSettlementProvider } from "./settlement.provider";

describe("Razorpay test settlement provider", () => {
  it("normalizes the provider net, fee and tax into exact batch totals", async () => {
    const fetch = vi.fn().mockResolvedValue({
      id: "set_test_1",
      amount: 52_758,
      fees: 1_900,
      tax: 342,
      currency: "INR",
      status: "processed",
      utr: "UTR_TEST_1",
      created_at: 1_775_001_600,
    });
    const provider = new RazorpayTestSettlementProvider({ fetch });
    const result = await provider.fetchSettlement("set_test_1", 1);

    expect(result).toMatchObject({
      source: "test_provider",
      storeId: 1,
      grossAmountPaise: 55_000,
      feePaise: 1_900,
      feeTaxPaise: 342,
      adjustmentPaise: 0,
      netAmountPaise: 52_758,
      currency: "INR",
      lines: [],
    });
  });

  it("rejects a non-INR provider settlement", async () => {
    const provider = new RazorpayTestSettlementProvider({
      fetch: vi.fn().mockResolvedValue({
        id: "set_test_usd",
        amount: 100,
        fees: 2,
        tax: 0,
        currency: "USD",
        status: "processed",
        created_at: 1_775_001_600,
      }),
    });
    await expect(provider.fetchSettlement("set_test_usd", 1)).rejects.toMatchObject({
      code: "SETTLEMENT_CURRENCY_MISMATCH",
      status: 422,
    });
  });
});
