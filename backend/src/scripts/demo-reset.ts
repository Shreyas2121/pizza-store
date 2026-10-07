import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { closeDatabase, db, pool } from "../db";
import {
  addressTable,
  deliveryPricingRulesTable,
  deliveryZonesTable,
  inventoryMovementsTable,
  ledgerAccountsTable,
  productCostVersionsTable,
  productsTable,
  storeMembershipsTable,
  storeProductsTable,
  storesTable,
  taxRulesTable,
  usersTable,
} from "../db/schema";
import { SYSTEM_LEDGER_ACCOUNTS } from "../features/ledger";
import { URL } from "../constants";
import { seedCatalog } from "./catalog";
import { assertDemoResetSafety, buildDemoTruncateSql } from "./demo-reset.policy";
import { formatDemoScenarioSummary, seedDemoFinancialScenario } from "./demo-financial-scenario";
import { seedPromotions } from "./promotions";

const SECOND_STORE = {
  name: "PizzaStore - Bengaluru South",
  slug: "pizzastore-bengaluru-south",
  address: "80 Feet Road, Koramangala",
  city: "Bengaluru",
  state: "Karnataka",
  pincode: "560034",
  phone: "+91 98765 43211",
  email: "bengaluru@pizzastore.com",
  latitude: 12.9352,
  longitude: 77.6245,
  opensAt: "09:00",
  closesAt: "23:00",
  timezone: "Asia/Kolkata",
  isActive: true,
} as const;

const seedDemoUsers = async () => {
  const [admin, customer, finance, mumbaiManager, bengaluruManager, newCustomer] = await db.insert(usersTable).values([
    { fname: "Admin", lname: "Owner", email: "admin@pizzastore.com", password: await bcrypt.hash("admin123", 10), role: "admin" },
    { fname: "Demo", lname: "Customer", email: "customer@pizzastore.com", password: await bcrypt.hash("customer123", 10), role: "user" },
    { fname: "Finance", lname: "Manager", email: "finance@pizzastore.com", password: await bcrypt.hash("finance123", 10), role: "user" },
    { fname: "Mumbai", lname: "Manager", email: "mumbai.manager@pizzastore.com", password: await bcrypt.hash("manager123", 10), role: "user" },
    { fname: "Bengaluru", lname: "Manager", email: "bengaluru.manager@pizzastore.com", password: await bcrypt.hash("manager123", 10), role: "user" },
    { fname: "New", lname: "Customer", email: "new.customer@pizzastore.com", password: await bcrypt.hash("customer123", 10), role: "user" },
  ]).returning();
  await db.insert(addressTable).values({ userId: customer.id, type: "Home", street: "12 Demo Lane", city: "Mumbai", state: "Maharashtra", pincode: "400001", phone: "9876543210" });
  await db.insert(addressTable).values([
    { userId: newCustomer.id, type: "Home", street: "12 Demo Lane", city: "Mumbai", state: "Maharashtra", pincode: "400001", phone: "9876543210" },
    { userId: newCustomer.id, type: "Work", street: "14 Demo Lane", city: "Bengaluru", state: "Karnataka", pincode: "560034", phone: "9876543210" },
  ]);
  return { admin, customer, finance, mumbaiManager, bengaluruManager, newCustomer };
};

const seedSecondStore = async (adminId: number, financeId: number) => {
  const [store] = await db.insert(storesTable).values(SECOND_STORE).returning();
  const products = await db.select({ id: productsTable.id, pricePaise: productsTable.pricePaise }).from(productsTable).orderBy(productsTable.id);
  const mapped = await db.insert(storeProductsTable).values(products.map((product) => ({
    storeId: store.id, productId: product.id, pricePaise: product.pricePaise, isAvailable: true,
    onHandQuantity: 100, lowStockThreshold: 10, lastRestockedAt: new Date("2026-07-01T03:30:00.000Z"),
  }))).returning({ id: storeProductsTable.id, pricePaise: storeProductsTable.pricePaise });
  await db.insert(inventoryMovementsTable).values(mapped.map((product) => ({
    storeProductId: product.id, changeType: "restock" as const, quantityChange: 100,
    previousQuantity: 0, newQuantity: 100, reason: "Deterministic demo opening stock",
    idempotencyKey: `demo-reset:store-product:${product.id}`,
  })));
  await db.insert(productCostVersionsTable).values(mapped.map((product) => ({
    storeProductId: product.id, storeId: store.id, unitCostPaise: Math.round(product.pricePaise * 40 / 100),
    effectiveFrom: "2026-01-01", source: "deterministic_demo_reset", createdBy: adminId,
  })));
  await db.insert(deliveryZonesTable).values({ storeId: store.id, pincode: store.pincode });
  await db.insert(deliveryPricingRulesTable).values({ storeId: store.id, version: 1, deliveryFeePaise: 4_000, freeDeliveryThresholdPaise: 50_000, effectiveFrom: "2020-01-01" });
  await db.insert(taxRulesTable).values([
    { storeId: store.id, component: "item", version: 1, rateBps: 500, hsnSacCode: "21069099-DEMO", effectiveFrom: "2020-01-01" },
    { storeId: store.id, component: "delivery", version: 1, rateBps: 500, hsnSacCode: "996331-DEMO", effectiveFrom: "2020-01-01" },
  ]);
  await db.insert(storeMembershipsTable).values({ userId: financeId, storeId: store.id, role: "finance_manager", createdBy: adminId, updatedBy: adminId });
  return store;
};

const run = async () => {
  assertDemoResetSafety({ nodeEnv: process.env.NODE_ENV ?? "development", databaseUrl: URL, confirmation: process.argv[2] });
  const result = await pool.query<{ tablename: string }>("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public' ORDER BY tablename");
  await pool.query(buildDemoTruncateSql(result.rows.map((row) => row.tablename)));

  const users = await seedDemoUsers();
  await db.insert(ledgerAccountsTable).values(SYSTEM_LEDGER_ACCOUNTS.map((account) => ({ ...account, currency: "INR" as const, isSystem: true, isActive: true })));
  const catalog = await seedCatalog();
  const defaultStore = await db.query.storesTable.findFirst({ where: eq(storesTable.slug, "pizzastore-default") });
  if (!defaultStore) throw new Error("Default demo store was not created.");
  await db.insert(storeMembershipsTable).values({ userId: users.finance.id, storeId: defaultStore.id, role: "finance_manager", createdBy: users.admin.id, updatedBy: users.admin.id });
  const secondStore = await seedSecondStore(users.admin.id, users.finance.id);
  await db.insert(storeMembershipsTable).values([
    { userId: users.mumbaiManager.id, storeId: defaultStore.id, role: "manager", createdBy: users.admin.id, updatedBy: users.admin.id },
    { userId: users.bengaluruManager.id, storeId: secondStore.id, role: "manager", createdBy: users.admin.id, updatedBy: users.admin.id },
  ]);
  const promotions = await seedPromotions();
  const scenario = await seedDemoFinancialScenario({
    adminId: users.admin.id,
    customerId: users.customer.id,
    storeIds: [defaultStore.id, secondStore.id],
  });

  console.log("Demo database reset complete.");
  console.log(`Stores: ${defaultStore.name} (#${defaultStore.id}), ${secondStore.name} (#${secondStore.id})`);
  console.log(`Catalog: ${catalog.products} products with opening stock and standard costs.`);
  console.log("Owner: admin@pizzastore.com / admin123");
  console.log("Customer: customer@pizzastore.com / customer123");
  console.log("Finance manager: finance@pizzastore.com / finance123");
  console.log("Store managers: mumbai.manager@pizzastore.com and bengaluru.manager@pizzastore.com / manager123");
  console.log("First-order customer: new.customer@pizzastore.com / customer123");
  console.log(`Promotion fixtures: ${promotions.created}; pizza/drink combo #${promotions.bundleProductId}.`);
  for (const line of formatDemoScenarioSummary(scenario, [defaultStore.id, secondStore.id])) console.log(line);
  console.log("The complete deterministic finance scenario is ready for immediate report, CSV, and journal drill-down inspection.");
};

run().then(async () => {
  await closeDatabase();
}).catch(async (cause) => {
  console.error(cause instanceof Error ? cause.message : "Demo reset failed.");
  await closeDatabase().catch(() => {});
  process.exitCode = 1;
});
