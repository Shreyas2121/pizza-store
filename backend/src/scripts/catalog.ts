import { and, eq, isNull } from "drizzle-orm";
import { checkDatabaseConnection, closeDatabase, db } from "../db";
import {
  categoriesTable,
  customizationGroupsTable,
  customizationOptionsTable,
  inventoryMovementsTable,
  menuItemsMappingTable,
  menuItemsTable,
  productCustomizationGroupMappingTable,
  productsTable,
  storeProductsTable,
} from "../db/schema";
import { seedDefaultStore } from "./default-store";

const categoryData = [
  { name: "Pizza", featured: true },
  { name: "Pasta", featured: true },
  { name: "Sides", featured: false },
  { name: "Beverages", featured: false },
  { name: "Chicken", featured: true },
];

const productData = [
  {
    name: "Margherita Pizza",
    description:
      "Classic delight with mozzarella cheese, fresh basil, and tangy tomato sauce on a crispy crust.",
    slug: "margherita-pizza",
    veg: true,
    hasCustomization: true,
    price: 299,
    image: "/uploads/pizza-1.avif",
    category: "Pizza",
  },
  {
    name: "Pepperoni Feast",
    description:
      "Loaded with spicy pepperoni slices, mozzarella, and our signature pizza sauce.",
    slug: "pepperoni-feast",
    veg: false,
    hasCustomization: true,
    price: 449,
    image: "/uploads/pizza-2.avif",
    category: "Pizza",
  },
  {
    name: "BBQ Chicken Pizza",
    description:
      "Smoky BBQ sauce with grilled chicken, red onions, and a blend of cheeses.",
    slug: "bbq-chicken-pizza",
    veg: false,
    hasCustomization: true,
    price: 499,
    image: "/uploads/pizza-3.avif",
    category: "Pizza",
  },
  {
    name: "Veggie Supreme",
    description:
      "A garden-fresh medley of bell peppers, olives, mushrooms, onions, and sweet corn.",
    slug: "veggie-supreme",
    veg: true,
    hasCustomization: true,
    price: 399,
    image: "/uploads/pizza-4.webp",
    category: "Pizza",
  },
  {
    name: "Farmhouse Pizza",
    description:
      "Topped with capsicum, mushrooms, onions, and fresh tomatoes on a cheesy base.",
    slug: "farmhouse-pizza",
    veg: true,
    hasCustomization: true,
    price: 379,
    image: "/uploads/pizza-5.avif",
    category: "Pizza",
  },
  {
    name: "Meat Lovers Pizza",
    description:
      "A hearty combination of chicken tikka, sausage, pepperoni, and grilled chicken.",
    slug: "meat-lovers-pizza",
    veg: false,
    hasCustomization: true,
    price: 549,
    image: "/uploads/pizza-6.avif",
    category: "Pizza",
  },
  {
    name: "Cheese Burst Pizza",
    description:
      "Extra gooey mozzarella stuffed crust with a triple cheese topping.",
    slug: "cheese-burst-pizza",
    veg: true,
    hasCustomization: true,
    price: 429,
    image: "/uploads/pizza-7.avif",
    category: "Pizza",
  },
  {
    name: "Creamy Alfredo Pasta",
    description:
      "Penne in a rich and creamy Alfredo sauce with garlic, parmesan, and herbs.",
    slug: "creamy-alfredo-pasta",
    veg: true,
    hasCustomization: false,
    price: 249,
    image: "/uploads/pasta.avif",
    category: "Pasta",
  },
  {
    name: "Garlic Breadsticks",
    description:
      "Freshly baked breadsticks brushed with garlic butter and sprinkled with herbs.",
    slug: "garlic-breadsticks",
    veg: true,
    hasCustomization: false,
    price: 149,
    image: "/uploads/bread.avif",
    category: "Sides",
  },
  {
    name: "Classic French Fries",
    description:
      "Golden crispy fries seasoned with salt and served with ketchup.",
    slug: "classic-french-fries",
    veg: true,
    hasCustomization: false,
    price: 129,
    image: "/uploads/fries.avif",
    category: "Sides",
  },
  {
    name: "Grilled Chicken Wings",
    description:
      "Juicy chicken wings marinated in spices and grilled to perfection. Served with dipping sauce.",
    slug: "grilled-chicken-wings",
    veg: false,
    hasCustomization: false,
    price: 299,
    image: "/uploads/chicken.avif",
    category: "Chicken",
  },
  {
    name: "Coca-Cola",
    description: "Chilled 300ml can of classic Coca-Cola.",
    slug: "coca-cola",
    veg: true,
    hasCustomization: false,
    price: 60,
    image: "/uploads/coke.avif",
    category: "Beverages",
  },
  {
    name: "Fresh Lemonade",
    description:
      "Refreshing lemonade made with fresh lemons, mint, and a hint of sugar.",
    slug: "fresh-lemonade",
    veg: true,
    hasCustomization: false,
    price: 99,
    image: "/uploads/lemon-drink.avif",
    category: "Beverages",
  },
  {
    name: "Cold Coffee",
    description:
      "Creamy cold coffee blended with milk, coffee, and topped with whipped cream.",
    slug: "cold-coffee",
    veg: true,
    hasCustomization: false,
    price: 129,
    image: "/uploads/coffee.avif",
    category: "Beverages",
  },
  {
    name: "Fruit Punch",
    description:
      "A vibrant mix of tropical fruit juices blended with ice. Refreshing and fruity.",
    slug: "fruit-punch",
    veg: true,
    hasCustomization: false,
    price: 119,
    image: "/uploads/drink.avif",
    category: "Beverages",
  },
];

const customizationData = [
  {
    name: "Size",
    type: "single" as const,
    required: true,
    options: [
      { name: "Regular", price: 0 },
      { name: "Medium", price: 100 },
      { name: "Large", price: 200 },
    ],
  },
  {
    name: "Crust",
    type: "single" as const,
    required: true,
    options: [
      { name: "Hand Tossed", price: 0 },
      { name: "Thin Crust", price: 0 },
      { name: "Cheese Burst", price: 120 },
      { name: "New York Style", price: 80 },
    ],
  },
  {
    name: "Extra Toppings",
    type: "multiple" as const,
    required: false,
    options: [
      { name: "Extra Cheese", price: 60 },
      { name: "Jalapenos", price: 40 },
      { name: "Mushrooms", price: 50 },
      { name: "Olives", price: 50 },
      { name: "Onions", price: 30 },
      { name: "Paneer", price: 70 },
      { name: "Grilled Chicken", price: 90 },
    ],
  },
];

const pizzaSlugs = [
  "margherita-pizza",
  "pepperoni-feast",
  "bbq-chicken-pizza",
  "veggie-supreme",
  "farmhouse-pizza",
  "meat-lovers-pizza",
  "cheese-burst-pizza",
];

const initialInventoryBySlug: Record<
  string,
  { onHandQuantity: number; lowStockThreshold: number }
> = {
  "margherita-pizza": { onHandQuantity: 50, lowStockThreshold: 10 },
  "pepperoni-feast": { onHandQuantity: 40, lowStockThreshold: 10 },
  "bbq-chicken-pizza": { onHandQuantity: 40, lowStockThreshold: 10 },
  "veggie-supreme": { onHandQuantity: 50, lowStockThreshold: 10 },
  "farmhouse-pizza": { onHandQuantity: 50, lowStockThreshold: 10 },
  "meat-lovers-pizza": { onHandQuantity: 35, lowStockThreshold: 8 },
  "cheese-burst-pizza": { onHandQuantity: 40, lowStockThreshold: 10 },
  "creamy-alfredo-pasta": { onHandQuantity: 35, lowStockThreshold: 8 },
  "garlic-breadsticks": { onHandQuantity: 60, lowStockThreshold: 12 },
  "classic-french-fries": { onHandQuantity: 60, lowStockThreshold: 12 },
  "grilled-chicken-wings": { onHandQuantity: 30, lowStockThreshold: 8 },
  "coca-cola": { onHandQuantity: 100, lowStockThreshold: 20 },
  "fresh-lemonade": { onHandQuantity: 75, lowStockThreshold: 15 },
  "cold-coffee": { onHandQuantity: 75, lowStockThreshold: 15 },
  "fruit-punch": { onHandQuantity: 75, lowStockThreshold: 15 },
};

const menuData = [
  {
    name: "Pizzas",
    position: 1,
    slug: "pizzas",
    image: "/uploads/pizza-1.avif",
    productSlugs: pizzaSlugs,
  },
  {
    name: "Pasta",
    position: 2,
    slug: "pasta",
    image: "/uploads/pasta.avif",
    productSlugs: ["creamy-alfredo-pasta"],
  },
  {
    name: "Sides",
    position: 3,
    slug: "sides",
    image: "/uploads/fries.avif",
    productSlugs: ["garlic-breadsticks", "classic-french-fries"],
  },
  {
    name: "Chicken",
    position: 4,
    slug: "chicken",
    image: "/uploads/chicken.avif",
    productSlugs: ["grilled-chicken-wings"],
  },
  {
    name: "Beverages",
    position: 5,
    slug: "beverages",
    image: "/uploads/coke.avif",
    productSlugs: [
      "coca-cola",
      "fresh-lemonade",
      "cold-coffee",
      "fruit-punch",
    ],
  },
];

/**
 * Seeds only catalog-owned data. Existing records are reused by their stable
 * names/slugs, so this can be run after the admin-only clear-all operation.
 */
export async function seedCatalog() {
  const result = await db.transaction(async (tx) => {
    const categoryIds: Record<string, number> = {};
    for (const category of categoryData) {
      const [saved] = await tx
        .insert(categoriesTable)
        .values(category)
        .onConflictDoUpdate({
          target: categoriesTable.name,
          set: { featured: category.featured },
        })
        .returning({ id: categoriesTable.id, name: categoriesTable.name });
      categoryIds[saved.name] = saved.id;
    }

    const productIds: Record<string, number> = {};
    for (const product of productData) {
      const { category, ...values } = product;
      const productValues = { ...values, categoryId: categoryIds[category] };
      const [saved] = await tx
        .insert(productsTable)
        .values(productValues)
        .onConflictDoUpdate({
          target: productsTable.slug,
          set: productValues,
        })
        .returning({ id: productsTable.id, slug: productsTable.slug });
      productIds[saved.slug] = saved.id;
    }

    const groupIds: number[] = [];
    for (const customization of customizationData) {
      const [existingGroup] = await tx
        .select({ id: customizationGroupsTable.id })
        .from(customizationGroupsTable)
        .where(eq(customizationGroupsTable.name, customization.name))
        .limit(1);

      let groupId = existingGroup?.id;
      if (groupId) {
        await tx
          .update(customizationGroupsTable)
          .set({
            type: customization.type,
            required: customization.required,
          })
          .where(eq(customizationGroupsTable.id, groupId));
      } else {
        const [createdGroup] = await tx
          .insert(customizationGroupsTable)
          .values({
            name: customization.name,
            type: customization.type,
            required: customization.required,
          })
          .returning({ id: customizationGroupsTable.id });
        groupId = createdGroup.id;
      }
      groupIds.push(groupId);

      for (const option of customization.options) {
        const [existingOption] = await tx
          .select({ id: customizationOptionsTable.id })
          .from(customizationOptionsTable)
          .where(
            and(
              eq(customizationOptionsTable.groupId, groupId),
              eq(customizationOptionsTable.name, option.name),
            ),
          )
          .limit(1);

        if (existingOption) {
          await tx
            .update(customizationOptionsTable)
            .set({ price: option.price, isAvailable: true })
            .where(eq(customizationOptionsTable.id, existingOption.id));
        } else {
          await tx
            .insert(customizationOptionsTable)
            .values({ groupId, ...option });
        }
      }
    }

    const existingProductGroups = await tx
      .select()
      .from(productCustomizationGroupMappingTable);
    const productGroupKeys = new Set(
      existingProductGroups.map(
        ({ productId, groupId }) => `${productId}:${groupId}`,
      ),
    );
    const productGroupMappings = pizzaSlugs.flatMap((slug) =>
      groupIds.map((groupId) => ({ productId: productIds[slug], groupId })),
    );
    const missingProductGroups = productGroupMappings.filter(
      ({ productId, groupId }) => !productGroupKeys.has(`${productId}:${groupId}`),
    );
    if (missingProductGroups.length > 0) {
      await tx
        .insert(productCustomizationGroupMappingTable)
        .values(missingProductGroups);
    }

    let menuMappingCount = 0;
    for (const menu of menuData) {
      const menuValues = {
        name: menu.name,
        position: menu.position,
        slug: menu.slug,
        image: menu.image,
      };
      const [savedMenu] = await tx
        .insert(menuItemsTable)
        .values(menuValues)
        .onConflictDoUpdate({
          target: menuItemsTable.slug,
          set: menuValues,
        })
        .returning({ id: menuItemsTable.id });

      const existingMappings = await tx
        .select({ productId: menuItemsMappingTable.productId })
        .from(menuItemsMappingTable)
        .where(eq(menuItemsMappingTable.menuItemId, savedMenu.id));
      const existingProductIds = new Set(
        existingMappings.map(({ productId }) => productId),
      );
      const missingMappings = menu.productSlugs
        .map((slug) => productIds[slug])
        .filter((productId) => !existingProductIds.has(productId))
        .map((productId) => ({ menuItemId: savedMenu.id, productId }));

      if (missingMappings.length > 0) {
        await tx.insert(menuItemsMappingTable).values(missingMappings);
        menuMappingCount += missingMappings.length;
      }
    }

    return {
      categories: categoryData.length,
      products: productData.length,
      customizationGroups: customizationData.length,
      productGroupMappingsAdded: missingProductGroups.length,
      menuItems: menuData.length,
      menuMappingsAdded: menuMappingCount,
    };
  });

  const store = await seedDefaultStore();
  const inventory = await db.transaction(async (tx) => {
    const storeProducts = await tx
      .select({
        id: storeProductsTable.id,
        slug: productsTable.slug,
        onHandQuantity: storeProductsTable.onHandQuantity,
      })
      .from(storeProductsTable)
      .innerJoin(
        productsTable,
        eq(storeProductsTable.productId, productsTable.id),
      )
      .where(eq(storeProductsTable.storeId, store.store.id));

    let initialized = 0;
    let preserved = 0;
    const restockedAt = new Date();

    for (const storeProduct of storeProducts) {
      const initialInventory = initialInventoryBySlug[storeProduct.slug];
      if (!initialInventory) continue;

      if (storeProduct.onHandQuantity !== null) {
        preserved += 1;
        continue;
      }

      const idempotencyKey = `catalog-seed:initial-stock:${storeProduct.id}`;
      const [existingSeedMovement] = await tx
        .select({ id: inventoryMovementsTable.id })
        .from(inventoryMovementsTable)
        .where(eq(inventoryMovementsTable.idempotencyKey, idempotencyKey))
        .limit(1);
      if (existingSeedMovement) {
        preserved += 1;
        continue;
      }

      const [updated] = await tx
        .update(storeProductsTable)
        .set({
          onHandQuantity: initialInventory.onHandQuantity,
          lowStockThreshold: initialInventory.lowStockThreshold,
          lastRestockedAt: restockedAt,
        })
        .where(
          and(
            eq(storeProductsTable.id, storeProduct.id),
            isNull(storeProductsTable.onHandQuantity),
          ),
        )
        .returning({ id: storeProductsTable.id });

      if (!updated) {
        preserved += 1;
        continue;
      }

      await tx
        .insert(inventoryMovementsTable)
        .values({
          storeProductId: storeProduct.id,
          changeType: "restock",
          quantityChange: initialInventory.onHandQuantity,
          previousQuantity: 0,
          newQuantity: initialInventory.onHandQuantity,
          reason: "Initial catalog seed stock",
          idempotencyKey,
        })
        .onConflictDoNothing({
          target: inventoryMovementsTable.idempotencyKey,
        });
      initialized += 1;
    }

    return { initialized, preserved };
  });

  return { ...result, store, inventory };
}

async function run() {
  console.log("⏳ [Catalog Seed] Checking database connection...");
  const isConnected = await checkDatabaseConnection();
  if (!isConnected) {
    throw new Error("Cannot seed catalog without a healthy database connection.");
  }
  console.log("🌱 [Catalog Seed] Seeding catalog, customizations, menus, and default store...");
  const result = await seedCatalog();

  console.log(`Seeded ${result.categories} categories.`);
  console.log(`Seeded ${result.products} products.`);
  console.log(`Seeded ${result.customizationGroups} customization groups.`);
  console.log(`Added ${result.productGroupMappingsAdded} product-group mappings.`);
  console.log(`Seeded ${result.menuItems} menu items.`);
  console.log(`Added ${result.menuMappingsAdded} menu-product mappings.`);
  console.log(
    `${result.store.storeCreated ? "Created" : "Reused"} store: ${result.store.store.name} (#${result.store.store.id}).`,
  );
  console.log(`Added ${result.store.productsMapped} store-product mappings.`);
  console.log(
    `Initialized inventory for ${result.inventory.initialized} products; preserved ${result.inventory.preserved} existing stock levels.`,
  );
}

if (require.main === module) {
  run()
    .then(async () => {
      await closeDatabase().catch(() => {});
      process.exit(0);
    })
    .catch(async (cause) => {
      console.error("Catalog seed failed:", cause);
      await closeDatabase().catch(() => {});
      process.exit(1);
    });
}
