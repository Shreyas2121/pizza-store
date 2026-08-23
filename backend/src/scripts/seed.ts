import bcrypt from "bcryptjs";
import { db } from "../db";
import {
  usersTable,
  categoriesTable,
  productsTable,
  customizationGroupsTable,
  customizationOptionsTable,
  productCustomizationGroupMappingTable,
  menuItemsTable,
  menuItemsMappingTable,
  addressTable,
} from "../db/schema";

/**
 * Master seed script — seeds the entire database with realistic food data.
 *
 * Creates: admin user, test user, categories, products (mapped to existing
 * images in /uploads), customization groups + options, menu items, and
 * all the junction-table mappings between them.
 *
 * Usage: pnpm run seed
 */
async function seed() {
  console.log("🌱 Starting full database seed...\n");

  // ──────────────────────────────────────────────
  // 1. Users (admin + test user)
  // ──────────────────────────────────────────────
  console.log("👤 Creating users...");
  const hashedPassword = await bcrypt.hash("admin123", 10);
  const userPassword = await bcrypt.hash("user123", 10);

  const [admin] = await db
    .insert(usersTable)
    .values({
      fname: "Admin",
      lname: "User",
      email: "admin@pizzastore.com",
      password: hashedPassword,
      role: "admin",
    })
    .returning();

  const [testUser] = await db
    .insert(usersTable)
    .values({
      fname: "Shreyas",
      lname: "Rai",
      email: "shreyas@test.com",
      password: userPassword,
      role: "user",
    })
    .returning();

  console.log(`  ✅ Admin: ${admin.email} (password: admin123)`);
  console.log(`  ✅ User:  ${testUser.email} (password: user123)`);

  // Create a test address for the user
  await db.insert(addressTable).values({
    userId: testUser.id,
    type: "Home",
    street: "123 Main Street, Apartment 4B",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400001",
    phone: "9876543210",
  });
  console.log(`  ✅ Address created for test user\n`);

  // ──────────────────────────────────────────────
  // 2. Categories
  // ──────────────────────────────────────────────
  console.log("📂 Creating categories...");
  const categoryData = [
    { name: "Pizza", featured: true },
    { name: "Pasta", featured: true },
    { name: "Sides", featured: false },
    { name: "Beverages", featured: false },
    { name: "Chicken", featured: true },
  ];

  const categories = await db
    .insert(categoriesTable)
    .values(categoryData)
    .returning();

  const catMap = Object.fromEntries(categories.map((c) => [c.name, c.id]));
  console.log(`  ✅ Created ${categories.length} categories\n`);

  // ──────────────────────────────────────────────
  // 3. Products (mapped to existing uploads)
  // ──────────────────────────────────────────────
  console.log("🍕 Creating products...");
  const productData = [
    // Pizzas (7 images)
    {
      name: "Margherita Pizza",
      description:
        "Classic delight with mozzarella cheese, fresh basil, and tangy tomato sauce on a crispy crust.",
      slug: "margherita-pizza",
      veg: true,
      hasCustomization: true,
      price: 9.99,
      image: "/uploads/pizza-1.avif",
      categoryId: catMap["Pizza"],
    },
    {
      name: "Pepperoni Feast",
      description:
        "Loaded with spicy pepperoni slices, mozzarella, and our signature pizza sauce.",
      slug: "pepperoni-feast",
      veg: false,
      hasCustomization: true,
      price: 13.99,
      image: "/uploads/pizza-2.avif",
      categoryId: catMap["Pizza"],
    },
    {
      name: "BBQ Chicken Pizza",
      description:
        "Smoky BBQ sauce with grilled chicken, red onions, and a blend of cheeses.",
      slug: "bbq-chicken-pizza",
      veg: false,
      hasCustomization: true,
      price: 15.99,
      image: "/uploads/pizza-3.avif",
      categoryId: catMap["Pizza"],
    },
    {
      name: "Veggie Supreme",
      description:
        "A garden-fresh medley of bell peppers, olives, mushrooms, onions, and sweet corn.",
      slug: "veggie-supreme",
      veg: true,
      hasCustomization: true,
      price: 12.99,
      image: "/uploads/pizza-4.webp",
      categoryId: catMap["Pizza"],
    },
    {
      name: "Farmhouse Pizza",
      description:
        "Topped with capsicum, mushrooms, onions, and fresh tomatoes on a cheesy base.",
      slug: "farmhouse-pizza",
      veg: true,
      hasCustomization: true,
      price: 11.99,
      image: "/uploads/pizza-5.avif",
      categoryId: catMap["Pizza"],
    },
    {
      name: "Meat Lovers Pizza",
      description:
        "A hearty combination of chicken tikka, sausage, pepperoni, and grilled chicken.",
      slug: "meat-lovers-pizza",
      veg: false,
      hasCustomization: true,
      price: 17.99,
      image: "/uploads/pizza-6.avif",
      categoryId: catMap["Pizza"],
    },
    {
      name: "Cheese Burst Pizza",
      description:
        "Extra gooey mozzarella stuffed crust with a triple cheese topping.",
      slug: "cheese-burst-pizza",
      veg: true,
      hasCustomization: true,
      price: 13.49,
      image: "/uploads/pizza-7.avif",
      categoryId: catMap["Pizza"],
    },

    // Pasta
    {
      name: "Creamy Alfredo Pasta",
      description:
        "Penne in a rich and creamy Alfredo sauce with garlic, parmesan, and herbs.",
      slug: "creamy-alfredo-pasta",
      veg: true,
      hasCustomization: false,
      price: 10.99,
      image: "/uploads/pasta.avif",
      categoryId: catMap["Pasta"],
    },

    // Sides
    {
      name: "Garlic Breadsticks",
      description:
        "Freshly baked breadsticks brushed with garlic butter and sprinkled with herbs.",
      slug: "garlic-breadsticks",
      veg: true,
      hasCustomization: false,
      price: 5.99,
      image: "/uploads/bread.avif",
      categoryId: catMap["Sides"],
    },
    {
      name: "Classic French Fries",
      description:
        "Golden crispy fries seasoned with salt and served with ketchup.",
      slug: "classic-french-fries",
      veg: true,
      hasCustomization: false,
      price: 3.99,
      image: "/uploads/fries.avif",
      categoryId: catMap["Sides"],
    },

    // Chicken
    {
      name: "Grilled Chicken Wings",
      description:
        "Juicy chicken wings marinated in spices and grilled to perfection. Served with dipping sauce.",
      slug: "grilled-chicken-wings",
      veg: false,
      hasCustomization: false,
      price: 10.99,
      image: "/uploads/chicken.avif",
      categoryId: catMap["Chicken"],
    },

    // Beverages
    {
      name: "Coca-Cola",
      description: "Chilled 300ml can of classic Coca-Cola.",
      slug: "coca-cola",
      veg: true,
      hasCustomization: false,
      price: 2.49,
      image: "/uploads/coke.avif",
      categoryId: catMap["Beverages"],
    },
    {
      name: "Fresh Lemonade",
      description:
        "Refreshing lemonade made with fresh lemons, mint, and a hint of sugar.",
      slug: "fresh-lemonade",
      veg: true,
      hasCustomization: false,
      price: 3.49,
      image: "/uploads/lemon-drink.avif",
      categoryId: catMap["Beverages"],
    },
    {
      name: "Cold Coffee",
      description:
        "Creamy cold coffee blended with milk, coffee, and topped with whipped cream.",
      slug: "cold-coffee",
      veg: true,
      hasCustomization: false,
      price: 4.99,
      image: "/uploads/coffee.avif",
      categoryId: catMap["Beverages"],
    },
    {
      name: "Fruit Punch",
      description:
        "A vibrant mix of tropical fruit juices blended with ice. Refreshing and fruity.",
      slug: "fruit-punch",
      veg: true,
      hasCustomization: false,
      price: 3.99,
      image: "/uploads/drink.avif",
      categoryId: catMap["Beverages"],
    },
  ];

  const products = await db
    .insert(productsTable)
    .values(productData)
    .returning();

  const prodMap = Object.fromEntries(products.map((p) => [p.slug, p.id]));
  console.log(`  ✅ Created ${products.length} products\n`);

  // ──────────────────────────────────────────────
  // 4. Customization Groups + Options
  // ──────────────────────────────────────────────
  console.log("🎨 Creating customization groups and options...");

  // Group 1: Pizza Size (single, required)
  const [sizeGroup] = await db
    .insert(customizationGroupsTable)
    .values({ name: "Size", type: "single", required: true })
    .returning();

  await db.insert(customizationOptionsTable).values([
    { groupId: sizeGroup.id, name: "Regular", price: 0 },
    { groupId: sizeGroup.id, name: "Medium", price: 1.50 },
    { groupId: sizeGroup.id, name: "Large", price: 3.00 },
  ]);
  console.log("  ✅ Size group: Regular / Medium (+$1.50) / Large (+$3.00)");

  // Group 2: Crust Type (single, required)
  const [crustGroup] = await db
    .insert(customizationGroupsTable)
    .values({ name: "Crust", type: "single", required: true })
    .returning();

  await db.insert(customizationOptionsTable).values([
    { groupId: crustGroup.id, name: "Hand Tossed", price: 0 },
    { groupId: crustGroup.id, name: "Thin Crust", price: 0 },
    { groupId: crustGroup.id, name: "Cheese Burst", price: 2.49 },
    { groupId: crustGroup.id, name: "New York Style", price: 1.49 },
  ]);
  console.log(
    "  ✅ Crust group: Hand Tossed / Thin Crust / Cheese Burst (+$2.49) / New York Style (+$1.49)"
  );

  // Group 3: Extra Toppings (multiple, not required)
  const [toppingsGroup] = await db
    .insert(customizationGroupsTable)
    .values({ name: "Extra Toppings", type: "multiple", required: false })
    .returning();

  await db.insert(customizationOptionsTable).values([
    { groupId: toppingsGroup.id, name: "Extra Cheese", price: 1.49 },
    { groupId: toppingsGroup.id, name: "Jalapenos", price: 0.79 },
    { groupId: toppingsGroup.id, name: "Mushrooms", price: 0.99 },
    { groupId: toppingsGroup.id, name: "Olives", price: 0.89 },
    { groupId: toppingsGroup.id, name: "Onions", price: 0.49 },
    { groupId: toppingsGroup.id, name: "Paneer", price: 1.49 },
    { groupId: toppingsGroup.id, name: "Grilled Chicken", price: 1.99 },
  ]);
  console.log(
    "  ✅ Toppings group: Extra Cheese / Jalapenos / Mushrooms / Olives / Onions / Paneer / Grilled Chicken\n"
  );

  // ──────────────────────────────────────────────
  // 5. Product ↔ Customization Group mappings
  //    (all pizzas get all 3 groups)
  // ──────────────────────────────────────────────
  console.log("🔗 Mapping customization groups to pizza products...");

  const pizzaSlugs = [
    "margherita-pizza",
    "pepperoni-feast",
    "bbq-chicken-pizza",
    "veggie-supreme",
    "farmhouse-pizza",
    "meat-lovers-pizza",
    "cheese-burst-pizza",
  ];

  const mappingData = pizzaSlugs.flatMap((slug) => [
    { productId: prodMap[slug], groupId: sizeGroup.id },
    { productId: prodMap[slug], groupId: crustGroup.id },
    { productId: prodMap[slug], groupId: toppingsGroup.id },
  ]);

  await db
    .insert(productCustomizationGroupMappingTable)
    .values(mappingData);

  console.log(
    `  ✅ Mapped ${pizzaSlugs.length} pizzas × 3 groups = ${mappingData.length} mappings\n`
  );

  // ──────────────────────────────────────────────
  // 6. Menu Items + Product Mappings
  // ──────────────────────────────────────────────
  console.log("📋 Creating menu items...");

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

  for (const menu of menuData) {
    const [menuItem] = await db
      .insert(menuItemsTable)
      .values({
        name: menu.name,
        position: menu.position,
        slug: menu.slug,
        image: menu.image,
      })
      .returning();

    const menuMappings = menu.productSlugs.map((slug) => ({
      menuItemId: menuItem.id,
      productId: prodMap[slug],
    }));

    await db.insert(menuItemsMappingTable).values(menuMappings);

    console.log(
      `  ✅ ${menu.name} (position ${menu.position}) → ${menu.productSlugs.length} products`
    );
  }

  console.log("\n🎉 Seed completed successfully!");
  console.log("\n📌 Quick reference:");
  console.log("   Admin login: admin@pizzastore.com / admin123");
  console.log("   User login:  shreyas@test.com / user123");
  console.log(
    `   Data: ${categories.length} categories, ${products.length} products, 3 customization groups, 5 menus`
  );

  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
