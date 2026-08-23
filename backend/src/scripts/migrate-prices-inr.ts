import { db } from "../db";
import { productsTable, customizationOptionsTable } from "../db/schema";
import { eq } from "drizzle-orm";

/**
 * One-time migration to restore INR prices in the live database
 * to match the current seed values.
 *
 * Usage: npx ts-node src/scripts/migrate-prices-inr.ts
 */

const productPriceMap: Record<string, number> = {
  "margherita-pizza": 299,
  "pepperoni-feast": 449,
  "bbq-chicken-pizza": 499,
  "veggie-supreme": 399,
  "farmhouse-pizza": 379,
  "meat-lovers-pizza": 549,
  "cheese-burst-pizza": 429,
  "creamy-alfredo-pasta": 249,
  "garlic-breadsticks": 149,
  "classic-french-fries": 129,
  "grilled-chicken-wings": 299,
  "coca-cola": 60,
  "fresh-lemonade": 99,
  "cold-coffee": 129,
  "fruit-punch": 119,
};

const customizationPriceMap: Record<string, number> = {
  "Regular": 0,
  "Medium": 100,
  "Large": 200,
  "Hand Tossed": 0,
  "Thin Crust": 0,
  "Cheese Burst": 120,
  "New York Style": 80,
  "Extra Cheese": 60,
  "Jalapenos": 40,
  "Mushrooms": 50,
  "Olives": 50,
  "Onions": 30,
  "Paneer": 70,
  "Grilled Chicken": 90,
};

async function migratePrices() {
  console.log("💱 Restoring INR prices...\n");

  console.log("📦 Updating product prices...");
  for (const [slug, price] of Object.entries(productPriceMap)) {
    await db
      .update(productsTable)
      .set({ price })
      .where(eq(productsTable.slug, slug));
    console.log(`  ✅ ${slug} → ₹${price}`);
  }

  console.log("\n🎨 Updating customization option prices...");
  for (const [name, price] of Object.entries(customizationPriceMap)) {
    await db
      .update(customizationOptionsTable)
      .set({ price })
      .where(eq(customizationOptionsTable.name, name));
    console.log(`  ✅ ${name} → ₹${price}`);
  }

  console.log("\n🎉 INR price restoration complete!");
  process.exit(0);
}

migratePrices().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
