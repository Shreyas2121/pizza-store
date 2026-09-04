export interface SettlementImportLine {
  providerLineId: string;
  providerTransactionId: string;
  providerEntityId: string;
  type: "payment" | "refund" | "adjustment";
  providerStatus: string;
  amountPaise: number;
  feePaise: number;
  feeTaxPaise: number;
  currency: "INR";
  occurredAt: string;
}

export interface SettlementImportBatch {
  storeId: number;
  providerSettlementId: string;
  providerStatus: string;
  source: "fixture" | "test_provider";
  periodFrom: string;
  periodTo: string;
  grossAmountPaise: number;
  feePaise: number;
  feeTaxPaise: number;
  adjustmentPaise: number;
  netAmountPaise: number;
  currency: "INR";
  utr: string | null;
  providerReference: string | null;
  settledAt: string;
  lines: SettlementImportLine[];
}

export const SETTLEMENT_IMPORT_FIXTURES: readonly SettlementImportBatch[] = [
  {
    storeId: 1,
    providerSettlementId: "set_m1_s1_001",
    providerStatus: "processed",
    source: "fixture",
    periodFrom: "2026-07-01T00:00:00.000Z",
    periodTo: "2026-07-28T06:00:00.000Z",
    grossAmountPaise: 95_000,
    feePaise: 1_900,
    feeTaxPaise: 342,
    adjustmentPaise: -40_000,
    netAmountPaise: 52_758,
    currency: "INR",
    utr: "UTR_FIXTURE_M1_S1_001",
    providerReference: "fixture-july-store-1",
    settledAt: "2026-07-28T06:00:00.000Z",
    lines: [
      {
        providerLineId: "line_set_m1_s1_001_pay_101",
        providerTransactionId: "pay_fixture_order_101",
        providerEntityId: "pay_fixture_order_101",
        type: "payment",
        providerStatus: "captured",
        amountPaise: 45_000,
        feePaise: 900,
        feeTaxPaise: 162,
        currency: "INR",
        occurredAt: "2026-07-03T06:00:00.000Z",
      },
      {
        providerLineId: "line_set_m1_s1_001_pay_104",
        providerTransactionId: "pay_fixture_order_104",
        providerEntityId: "pay_fixture_order_104",
        type: "payment",
        providerStatus: "captured",
        amountPaise: 50_000,
        feePaise: 1_000,
        feeTaxPaise: 180,
        currency: "INR",
        occurredAt: "2026-07-18T06:00:00.000Z",
      },
      {
        providerLineId: "line_set_m1_s1_001_ref_104",
        providerTransactionId: "rfnd_fixture_order_104",
        providerEntityId: "rfnd_fixture_order_104",
        type: "refund",
        providerStatus: "processed",
        amountPaise: -40_000,
        feePaise: 0,
        feeTaxPaise: 0,
        currency: "INR",
        occurredAt: "2026-07-22T06:00:00.000Z",
      },
    ],
  },
  {
    storeId: 2,
    providerSettlementId: "set_m2_s2_001",
    providerStatus: "processed",
    source: "fixture",
    periodFrom: "2026-08-01T00:00:00.000Z",
    periodTo: "2026-08-15T06:00:00.000Z",
    grossAmountPaise: 70_000,
    feePaise: 1_400,
    feeTaxPaise: 252,
    adjustmentPaise: 0,
    netAmountPaise: 68_348,
    currency: "INR",
    utr: "UTR_FIXTURE_M2_S2_001",
    providerReference: "fixture-august-store-2",
    settledAt: "2026-08-15T06:00:00.000Z",
    lines: [
      {
        providerLineId: "line_set_m2_s2_001_pay_202",
        providerTransactionId: "pay_fixture_order_202",
        providerEntityId: "pay_fixture_order_202",
        type: "payment",
        providerStatus: "captured",
        amountPaise: 70_000,
        feePaise: 1_400,
        feeTaxPaise: 252,
        currency: "INR",
        occurredAt: "2026-08-10T06:00:00.000Z",
      },
    ],
  },
] as const;

export const findSettlementFixture = (providerSettlementId: string) =>
  SETTLEMENT_IMPORT_FIXTURES.find(
    (fixture) => fixture.providerSettlementId === providerSettlementId
  );
