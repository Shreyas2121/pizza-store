import { expect, it } from "vitest";
import { reconcilePromotionFinanceFixtures } from "./promotion-reconciliation.fixtures";

it("reconciles two-store offers, coupons and bundle/free-delivery journals through production reports", () => {
  expect(reconcilePromotionFinanceFixtures()).toEqual({ journals: 6, consolidatedScenarios: 3, databaseQueries: 0 });
});
