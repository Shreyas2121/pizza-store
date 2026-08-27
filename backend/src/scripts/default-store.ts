import { eq, isNull } from "drizzle-orm";
import { checkDatabaseConnection, closeDatabase, db } from "../db";
import {
  cartTable,
  deliveryZonesTable,
  ordersTable,
  productsTable,
  storeProductsTable,
  storesTable,
} from "../db/schema";

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
      .select({ id: productsTable.id, price: productsTable.price })
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
        price: product.price,
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

    return {
      store,
      storeCreated,
      productsMapped: missingMappings.length,
      deliveryZonesBackfilled: migratedZones.length,
      ordersBackfilled: migratedOrders.length,
      cartsBackfilled: migratedCarts.length,
      defaultZoneCreated: defaultZone.length === 1,
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
