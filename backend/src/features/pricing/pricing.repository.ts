import { and, eq, gte, isNull, lte, or } from "drizzle-orm";
import { db } from "../../db";
import {
  deliveryPricingRulesTable,
  storesTable,
  taxRulesTable,
  type DemoTaxComponent,
} from "../../db/schema";
import type { DatabaseType, TransactionType } from "../../utils/types";

type DeliveryPricingRuleRecord = typeof deliveryPricingRulesTable.$inferSelect;
type TaxRuleRecord = typeof taxRulesTable.$inferSelect;
export type PricingExecutor = DatabaseType | TransactionType;

export interface PricingRepository {
  findStorePricingContext(
    storeId: number,
    executor?: PricingExecutor,
  ): Promise<{ timezone: string; state: string } | undefined>;
  findDeliveryPricingRules(
    storeId: number,
    businessDate: string,
    options: { executor?: PricingExecutor; lock: boolean },
  ): Promise<DeliveryPricingRuleRecord[]>;
  findTaxRules(
    storeId: number,
    component: DemoTaxComponent,
    businessDate: string,
    options: { executor?: PricingExecutor; lock: boolean },
  ): Promise<TaxRuleRecord[]>;
}

export class DrizzlePricingRepository implements PricingRepository {
  async findStorePricingContext(
    storeId: number,
    executor: PricingExecutor = db,
  ) {
    const [store] = await executor
      .select({ timezone: storesTable.timezone, state: storesTable.state })
      .from(storesTable)
      .where(and(eq(storesTable.id, storeId), eq(storesTable.isActive, true)))
      .limit(1);
    return store;
  }

  async findDeliveryPricingRules(
    storeId: number,
    businessDate: string,
    options: { executor?: PricingExecutor; lock: boolean },
  ) {
    const executor = options.executor ?? db;
    const query = executor
      .select()
      .from(deliveryPricingRulesTable)
      .where(
        and(
          eq(deliveryPricingRulesTable.storeId, storeId),
          lte(deliveryPricingRulesTable.effectiveFrom, businessDate),
          or(
            isNull(deliveryPricingRulesTable.effectiveTo),
            gte(deliveryPricingRulesTable.effectiveTo, businessDate),
          ),
        ),
      );
    return options.lock
      ? await query.for("update").limit(2)
      : await query.limit(2);
  }

  async findTaxRules(
    storeId: number,
    component: DemoTaxComponent,
    businessDate: string,
    options: { executor?: PricingExecutor; lock: boolean },
  ) {
    const executor = options.executor ?? db;
    const query = executor
      .select()
      .from(taxRulesTable)
      .where(
        and(
          eq(taxRulesTable.storeId, storeId),
          eq(taxRulesTable.component, component),
          lte(taxRulesTable.effectiveFrom, businessDate),
          or(
            isNull(taxRulesTable.effectiveTo),
            gte(taxRulesTable.effectiveTo, businessDate),
          ),
        ),
      );
    return options.lock
      ? await query.for("update").limit(2)
      : await query.limit(2);
  }
}
