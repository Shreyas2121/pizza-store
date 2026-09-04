import Razorpay from "razorpay";
import { AppError } from "../../utils/error";
import { getRazorpayConfig } from "../payments/razorpay.config";
import type { SettlementImportBatch } from "./settlement.fixtures";

type ProviderSettlement = {
  id: string;
  entity?: string;
  amount: number | string;
  fees: number | string;
  tax: number | string;
  currency: string;
  status: string;
  utr?: string | null;
  created_at: number;
};

const safeAmount = (value: number | string, field: string) => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new AppError(`Provider returned an invalid settlement ${field}.`, 502, "INVALID_PROVIDER_SETTLEMENT");
  }
  return parsed;
};

export interface SettlementProvider {
  fetchSettlement(providerSettlementId: string, storeId: number): Promise<SettlementImportBatch>;
}

export class RazorpayTestSettlementProvider implements SettlementProvider {
  constructor(private readonly settlements: {
    fetch(id: string): Promise<ProviderSettlement>;
  }) {}

  async fetchSettlement(providerSettlementId: string, storeId: number) {
    const settlement = await this.settlements.fetch(providerSettlementId);
    const netAmountPaise = safeAmount(settlement.amount, "net amount");
    const feePaise = safeAmount(settlement.fees, "fee");
    const feeTaxPaise = safeAmount(settlement.tax, "fee tax");
    const grossAmountPaise = netAmountPaise + feePaise + feeTaxPaise;
    if (!Number.isSafeInteger(grossAmountPaise)) {
      throw new AppError("Provider settlement gross exceeds safe integer range.", 502, "INVALID_PROVIDER_SETTLEMENT");
    }
    if (settlement.currency !== "INR") {
      throw new AppError("Provider settlement currency is not INR.", 422, "SETTLEMENT_CURRENCY_MISMATCH");
    }
    const settledAt = new Date(settlement.created_at * 1000);
    if (Number.isNaN(settledAt.getTime())) {
      throw new AppError("Provider returned an invalid settlement timestamp.", 502, "INVALID_PROVIDER_SETTLEMENT");
    }
    const timestamp = settledAt.toISOString();
    return {
      storeId,
      providerSettlementId: settlement.id,
      providerStatus: settlement.status,
      source: "test_provider" as const,
      periodFrom: timestamp,
      periodTo: timestamp,
      grossAmountPaise,
      feePaise,
      feeTaxPaise,
      adjustmentPaise: 0,
      netAmountPaise,
      currency: "INR" as const,
      utr: settlement.utr ?? null,
      providerReference: settlement.id,
      settledAt: timestamp,
      lines: [],
    };
  }
}

export const createTestSettlementProvider = (): SettlementProvider => {
  const config = getRazorpayConfig();
  if (!config || config.mode !== "razorpay_test") {
    throw new AppError(
      "Test-provider settlement sync is unavailable.",
      503,
      "SETTLEMENT_PROVIDER_UNAVAILABLE"
    );
  }
  const sdk = new Razorpay({ key_id: config.keyId, key_secret: config.keySecret });
  return new RazorpayTestSettlementProvider(
    sdk.settlements as unknown as { fetch(id: string): Promise<ProviderSettlement> }
  );
};
