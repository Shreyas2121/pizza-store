import { db } from "../db";
import { productsTable, customizationOptionsTable } from "../db/schema";
import { eq } from "drizzle-orm";

/**
 * One-time migration script to convert all product and customization
 * prices from INR to realistic USD values.
 *
 * Usage: npx ts-node src/scripts/migrate-prices.ts
 */

const productPriceMap: Record<string, number> = {
  "margherita-pizza": 9.99,
  "pepperoni-feast": 13.99,
  "bbq-chicken-pizza": 15.99,
  "veggie-supreme": 12.99,
  "farmhouse-pizza": 11.99,
  "meat-lovers-pizza": 17.99,
  "cheese-burst-pizza": 13.49,
  "creamy-alfredo-pasta": 10.99,
  "garlic-breadsticks": 5.99,
  "classic-french-fries": 3.99,
  "grilled-chicken-wings": 10.99,
  "coca-cola": 2.49,
  "fresh-lemonade": 3.49,
  "cold-coffee": 4.99,
  "fruit-punch": 3.99,
};

const customizationPriceMap: Record<string, number> = {
  "Regular": 0,
  "Medium": 1.50,
  "Large": 3.00,
  "Hand Tossed": 0,
  "Thin Crust": 0,
  "Cheese Burst": 2.49,
  "New York Style": 1.49,
  "Extra Cheese": 1.49,
  "Jalapenos": 0.79,
  "Mushrooms": 0.99,
  "Olives": 0.89,
  "Onions": 0.49,
  "Paneer": 1.49,
  "Grilled Chicken": 1.99,
};

async function migratePrices() {
  console.log("💱 Migrating prices from INR to USD...\n");

  // Update product prices
  console.log("📦 Updating product prices...");
  for (const [slug, price] of Object.entries(productPriceMap)) {
    await db
      .update(productsTable)
      .set({ price })
      .where(eq(productsTable.slug, slug));
    console.log(`  ✅ ${slug} → $${price.toFixed(2)}`);
  }

  // Update customization option prices
  console.log("\n🎨 Updating customization option prices...");
  for (const [name, price] of Object.entries(customizationPriceMap)) {
    await db
      .update(customizationOptionsTable)
      .set({ price })
      .where(eq(customizationOptionsTable.name, name));
    console.log(`  ✅ ${name} → $${price.toFixed(2)}`);
  }

  console.log("\n🎉 Price migration complete!");
  process.exit(0);
}

migratePrices().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
