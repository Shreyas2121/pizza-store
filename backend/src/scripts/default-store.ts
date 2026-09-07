import { eq, isNull } from "drizzle-orm";
import { checkDatabaseConnection, closeDatabase, db } from "../db";
import {
  cartTable,
  deliveryPricingRulesTable,
  deliveryZonesTable,
  ordersTable,
  productsTable,
  storeProductsTable,
  productCostVersionsTable,
  storesTable,
  taxRulesTable,
} from "../db/schema";

const defaultUnitCostsPaise: Record<string, number> = {
  "margherita-pizza": 11_000,
  "pepperoni-feast": 18_000,
  "bbq-chicken-pizza": 20_000,
  "veggie-supreme": 15_000,
  "farmhouse-pizza": 14_500,
  "meat-lovers-pizza": 23_000,
  "cheese-burst-pizza": 17_500,
  "creamy-alfredo-pasta": 9_000,
  "garlic-breadsticks": 4_000,
  "classic-french-fries": 3_500,
  "grilled-chicken-wings": 12_000,
  "coca-cola": 3_000,
  "fresh-lemonade": 2_800,
  "cold-coffee": 4_500,
  "fruit-punch": 3_800,
};

const DEFAULT_STORE = {
  name: "PizzaStore - Mumbai Central",
  slug: "pizzastore-default",
  address: "123 Main Street, Fort",
  city: "Mumbai",
  state: "Maharashtra",
  pincode: "400001",
  phone: "+91 98765 43210",
  email: "mumbai@pizzastore.com",
  latitude: 18.9388,
  longitude: 72.8354,
  opensAt: "09:00",
  closesAt: "23:00",
  timezone: "Asia/Kolkata",
  isActive: true,
} as const;

/**
 * Run after the multi-store schema migration. The transaction is idempotent:
 * existing store configuration and product overrides are preserved.
 *
 * Usage: pnpm seed:default-store
 */
export async function seedDefaultStore() {
  return db.transaction(async (tx) => {
    let store = await tx.query.storesTable.findFirst({
      where: eq(storesTable.slug, DEFAULT_STORE.slug),
    });
    let storeCreated = false;

    if (!store) {
      [store] = await tx.insert(storesTable).values(DEFAULT_STORE).returning();
      storeCreated = true;
    }

    const products = await tx
      .select({ id: productsTable.id, pricePaise: productsTable.pricePaise })
      .from(productsTable);
    const existingMappings = await tx
      .select({ productId: storeProductsTable.productId })
      .from(storeProductsTable)
      .where(eq(storeProductsTable.storeId, store.id));
    const mappedProductIds = new Set(
      existingMappings.map((mapping) => mapping.productId),
    );
    const missingMappings = products
      .filter((product) => !mappedProductIds.has(product.id))
      .map((product) => ({
        storeId: store.id,
        productId: product.id,
        pricePaise: product.pricePaise,
        isAvailable: true,
      }));

    if (missingMappings.length > 0) {
      await tx
        .insert(storeProductsTable)
        .values(missingMappings)
        .onConflictDoNothing({
          target: [storeProductsTable.storeId, storeProductsTable.productId],
        });
    }

    const costTargets = await tx.select({
      storeProductId: storeProductsTable.id,
      slug: productsTable.slug,
    }).from(storeProductsTable)
      .innerJoin(productsTable, eq(storeProductsTable.productId, productsTable.id))
      .where(eq(storeProductsTable.storeId, store.id));
    const seededCosts = costTargets.flatMap((target) => {
      const unitCostPaise = defaultUnitCostsPaise[target.slug];
      return unitCostPaise === undefined ? [] : [{
        storeProductId: target.storeProductId,
        storeId: store.id,
        unitCostPaise,
        effectiveFrom: "2026-01-01",
        source: "deterministic_demo_seed",
        createdBy: null,
      }];
    });
    if (seededCosts.length > 0) {
      await tx.insert(productCostVersionsTable).values(seededCosts).onConflictDoNothing({
        target: [productCostVersionsTable.storeProductId, productCostVersionsTable.effectiveFrom],
      });
    }

    const migratedZones = await tx
      .update(deliveryZonesTable)
      .set({ storeId: store.id })
      .where(isNull(deliveryZonesTable.storeId))
      .returning({ id: deliveryZonesTable.id });
    const migratedOrders = await tx
      .update(ordersTable)
      .set({ storeId: store.id })
      .where(isNull(ordersTable.storeId))
      .returning({ id: ordersTable.id });
    const migratedCarts = await tx
      .update(cartTable)
      .set({ storeId: store.id })
      .where(isNull(cartTable.storeId))
      .returning({ id: cartTable.id });

    const defaultZone = await tx
      .insert(deliveryZonesTable)
      .values({ storeId: store.id, pincode: DEFAULT_STORE.pincode })
      .onConflictDoNothing({
        target: [deliveryZonesTable.storeId, deliveryZonesTable.pincode],
      })
      .returning({ id: deliveryZonesTable.id });

    const defaultDeliveryPricingRule = await tx
      .insert(deliveryPricingRulesTable)
      .values({
        storeId: store.id,
        version: 1,
        deliveryFeePaise: 4_000,
        freeDeliveryThresholdPaise: 50_000,
        effectiveFrom: "2020-01-01",
        effectiveTo: null,
      })
      .onConflictDoNothing({
        target: [
          deliveryPricingRulesTable.storeId,
          deliveryPricingRulesTable.version,
        ],
      })
      .returning({ id: deliveryPricingRulesTable.id });

    const defaultTaxRules = await tx
      .insert(taxRulesTable)
      .values([
        {
          storeId: store.id,
          component: "item" as const,
          version: 1,
          rateBps: 500,
          hsnSacCode: "21069099-DEMO",
          effectiveFrom: "2020-01-01",
          effectiveTo: null,
        },
        {
          storeId: store.id,
          component: "delivery" as const,
          version: 1,
          rateBps: 500,
          hsnSacCode: "996331-DEMO",
          effectiveFrom: "2020-01-01",
          effectiveTo: null,
        },
      ])
      .onConflictDoNothing({
        target: [
          taxRulesTable.storeId,
          taxRulesTable.component,
          taxRulesTable.version,
        ],
      })
      .returning({ id: taxRulesTable.id });

    return {
      store,
      storeCreated,
      productsMapped: missingMappings.length,
      deliveryZonesBackfilled: migratedZones.length,
      ordersBackfilled: migratedOrders.length,
      cartsBackfilled: migratedCarts.length,
      defaultZoneCreated: defaultZone.length === 1,
      defaultDeliveryPricingRuleCreated:
        defaultDeliveryPricingRule.length === 1,
      defaultTaxRulesCreated: defaultTaxRules.length,
    };
  });
}

async function run() {
  console.log("⏳ [Store Seed] Checking database connection...");
  const isConnected = await checkDatabaseConnection();
  if (!isConnected) {
    throw new Error("Cannot seed store without a healthy database connection.");
  }
  console.log("🏬 [Store Seed] Seeding the default store and backfilling legacy data...");
  const result = await seedDefaultStore();

  console.log(`${result.storeCreated ? "Created" : "Reused"} store: ${result.store.name} (#${result.store.id})`);
  console.log(`Created ${result.productsMapped} missing store-product mappings.`);
  console.log(`Backfilled ${result.deliveryZonesBackfilled} delivery zones.`);
  console.log(`Backfilled ${result.ordersBackfilled} orders.`);
  console.log(`Backfilled ${result.cartsBackfilled} carts.`);
  console.log(result.defaultZoneCreated ? "Created the default 400001 delivery zone." : "Default delivery zone already exists.");
  console.log(result.defaultDeliveryPricingRuleCreated
    ? "Created the default delivery pricing rule."
    : "Default delivery pricing rule already exists.");
  console.log(`Created ${result.defaultTaxRulesCreated} default demo tax rules.`);
}

if (require.main === module) {
  run()
    .then(async () => {
      await closeDatabase().catch(() => {});
      process.exit(0);
    })
    .catch(async (cause) => {
      console.error("Default store migration failed:", cause);
      await closeDatabase().catch(() => {});
      process.exit(1);
    });
}
