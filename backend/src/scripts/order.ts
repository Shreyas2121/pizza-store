import { faker } from "@faker-js/faker";
import userService from "../features/users/user.service";
import customizeService from "../features/customization/customize.service";
import productService from "../features/products/product.service";
import orderService from "../features/order/order.service";
import { db } from "../db";
import {
  orderItemCustomizationsTable,
  orderItemsTable,
  ordersTable,
  productsTable,
} from "../db/schema";
import { eq } from "drizzle-orm";

(async function seedOrders() {
  console.log(`Seeding Orders...`);

  function pickRandomeOptions<T>(arr: T[], count: number) {
    if (count >= arr.length) return [...arr];

    const picked: T[] = [];
    const used = new Set<number>();

    while (picked.length < count) {
      const randIndex = Math.floor(Math.random() * arr.length);
      if (!used.has(randIndex)) {
        used.add(randIndex);
        picked.push(arr[randIndex]);
      }
    }
    return picked;
  }

  const users = await userService.getAllUsers();
  const groups = await customizeService.getAllCustomizationGroups();
  const updatedGroups = groups.map((group) => {
    return {
      id: group.id,
      required: group.required,
      type: group.type,
      options: group.options,
      mapping: group.mapping.map((mapping) => ({
        productId: mapping.productId,
        groupId: mapping.groupId,
      })),
    };
  });

  const products = await db.query.productsTable.findMany({});
  const COUNTS = [2, 5, 10, 20, 30];

  for (const user of users) {
    const randomIndex = Math.floor(Math.random() * COUNTS.length);
    const numOrdersForUser = COUNTS[randomIndex];
    const userId = user.id;

    const addressExists = await userService.addressExists(userId);
    if (!addressExists) {
      console.error(
        `No address found for user ${userId}. Skipping orders seeding.`
      );
      continue;
    }

    for (let i = 0; i < numOrdersForUser; i++) {
      const [{ id: orderId }] = await db
        .insert(ordersTable)
        .values({
          discountAmount: 0,
          userId,
          addressId: addressExists.id,
          orderDate: faker.date.between({
            from: "2024-01-01T00:00:00.000Z",
            to: "2025-02-28T00:00:00.000Z",
          }),
          status: "delievered",
          totalPrice: 0,
        })
        .returning();

      let orderTotal = 0;

      const itemCount = faker.number.int({
        min: 1,
        max: 5,
      });

      const insertedProducts = new Set<number>();

      for (let j = 0; j < itemCount; j++) {
        const randomProduct =
          products[Math.floor(Math.random() * products.length)];

        if (insertedProducts.has(randomProduct.id)) continue;

        insertedProducts.add(randomProduct.id);

        let basePrice = randomProduct.price;
        const quantity = faker.number.int({
          min: 1,
          max: 2,
        });

        const [{ id: orderItemId }] = await db
          .insert(orderItemsTable)
          .values({
            orderId,
            productId: randomProduct.id,
            price: basePrice,
            quantity,
          })
          .returning();

        const productGroups = updatedGroups.filter((grp) =>
          grp.mapping.some((p) => p.productId === randomProduct.id)
        );

        let groupedPrice = 0;

        for (const group of productGroups) {
          let pickCount = 0;
          if (group.required && group.type === "single") {
            pickCount = 1;
          } else if (group.required && group.type === "multiple") {
            pickCount = faker.number.int({
              min: 1,
              max: group.options.length,
            });
          } else if (!group.required && group.type === "single") {
            pickCount = faker.number.int({
              min: 0,
              max: 1,
            });
          } else {
            pickCount = faker.number.int({
              min: 0,
              max: group.options.length,
            });
          }

          if (pickCount > 0) {
            const options = pickRandomeOptions(group.options, pickCount);

            for (const op of options) {
              groupedPrice += op.price ?? 0;
              await db.insert(orderItemCustomizationsTable).values({
                customizationOptionId: op.id,
                orderItemId,
                price: op.price ?? 0,
              });
            }
          }
        }

        orderTotal = orderTotal + (basePrice + groupedPrice) * quantity;
      }

      await db
        .update(ordersTable)
        .set({
          totalPrice: orderTotal,
        })
        .where(eq(ordersTable.id, orderId));
    }
  }

  console.log("Seeding completed!");
  process.exit(0);
})();
