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
  deliveryPricingRulesTable,
  productsTable,
  storesTable,
  taxRulesTable,
  DEMO_TAX_DISCLAIMER,
} from "../db/schema";
import { eq } from "drizzle-orm";
import { calculateInclusiveTax } from "../utils/money";

(async function seedOrders() {
  console.log(`Seeding Orders...`);

  function pickRandomOptions<T>(arr: T[], count: number) {
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
  const store = await db.query.storesTable.findFirst({
    where: eq(storesTable.isActive, true),
    orderBy: storesTable.id,
  });

  if (!store) {
    console.error("No active store found. Skipping orders seeding.");
    process.exit(0);
  }
  const deliveryPricingRule = await db.query.deliveryPricingRulesTable.findFirst({
    where: eq(deliveryPricingRulesTable.storeId, store.id),
    orderBy: deliveryPricingRulesTable.version,
  });
  if (!deliveryPricingRule) {
    console.error("No delivery pricing rule found. Seed the default store first.");
    process.exit(1);
  }
  const taxRules = await db.query.taxRulesTable.findMany({
    where: eq(taxRulesTable.storeId, store.id),
  });
  const itemTaxRule = taxRules.find((rule) => rule.component === "item");
  const deliveryTaxRule = taxRules.find((rule) => rule.component === "delivery");
  if (!itemTaxRule || !deliveryTaxRule) {
    console.error("Item and delivery demo tax rules are required. Seed the default store first.");
    process.exit(1);
  }

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
      const orderDate = faker.date.between({
        from: "2024-01-01T00:00:00.000Z",
        to: "2025-02-28T00:00:00.000Z",
      });
      const [{ id: orderId }] = await db
        .insert(ordersTable)
        .values({
          userId,
          storeId: store.id,
          addressId: addressExists.id,
          orderDate,
          status: "delivered",
          deliveredAt: orderDate,
          recognizedAt: orderDate,
          itemsSubtotalPaise: 0,
          discountPaise: 0,
          deliveryFeePaise: 0,
          taxableAmountPaise: 0,
          taxPaise: 0,
          roundingAdjustmentPaise: 0,
          grandTotalPaise: 0,
          currency: "INR",
          quoteVersion: "seed-order-v1",
          pricingPolicyVersion: 1,
          deliveryPricingRuleId: deliveryPricingRule.id,
          deliveryPricingRuleVersion: deliveryPricingRule.version,
          pricingBusinessDate: orderDate.toISOString().slice(0, 10),
          pricingTimezone: store.timezone,
          taxCalculationPolicyVersion: 1,
          taxDisclaimer: DEMO_TAX_DISCLAIMER,
          taxIsDemo: true,
          placeOfSupplyState: store.state,
          deliveryTaxRuleId: deliveryTaxRule.id,
          deliveryTaxRuleVersion: deliveryTaxRule.version,
          deliveryTaxRateBps: deliveryTaxRule.rateBps,
          deliveryTaxableAmountPaise: 0,
          deliveryTaxPaise: 0,
          deliveryHsnSacCode: deliveryTaxRule.hsnSacCode,
        })
        .returning();

      let orderTotalPaise = 0;
      let orderTaxableAmountPaise = 0;
      let orderTaxPaise = 0;

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

        const baseUnitPricePaise = randomProduct.pricePaise;
        const quantity = faker.number.int({
          min: 1,
          max: 2,
        });

        const productGroups = updatedGroups.filter((grp) =>
          grp.mapping.some((p) => p.productId === randomProduct.id)
        );

        let customizationUnitPricePaise = 0;
        const customizationsToInsert: Array<{
          optionId: number;
          name: string;
          pricePaise: number;
        }> = [];

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
            const options = pickRandomOptions(group.options, pickCount);

            for (const op of options) {
              const optionPricePaise = op.pricePaise;
              customizationUnitPricePaise += optionPricePaise;
              customizationsToInsert.push({
                optionId: op.id,
                name: op.name,
                pricePaise: optionPricePaise,
              });
            }
          }
        }

        const unitPricePaise = baseUnitPricePaise + customizationUnitPricePaise;
        const lineSubtotalPaise = unitPricePaise * quantity;
        const lineTax = calculateInclusiveTax(
          lineSubtotalPaise,
          itemTaxRule.rateBps
        );

        const [{ id: orderItemId }] = await db
          .insert(orderItemsTable)
          .values({
            orderId,
            productId: randomProduct.id,
            quantity,
            productName: randomProduct.name,
            unitPricePaise,
            lineSubtotalPaise,
            discountAllocationPaise: 0,
            taxRuleId: itemTaxRule.id,
            taxRuleVersion: itemTaxRule.version,
            taxRateBps: itemTaxRule.rateBps,
            taxableAmountPaise: lineTax.taxableAmountPaise,
            taxPaise: lineTax.taxPaise,
            lineTotalPaise: lineSubtotalPaise,
            hsnSacCode: itemTaxRule.hsnSacCode,
          })
          .returning();

        for (const cust of customizationsToInsert) {
          await db.insert(orderItemCustomizationsTable).values({
            customizationOptionId: cust.optionId,
            orderItemId,
            customizationName: cust.name,
            pricePaise: cust.pricePaise,
          });
        }

        orderTotalPaise += lineSubtotalPaise;
        orderTaxableAmountPaise += lineTax.taxableAmountPaise;
        orderTaxPaise += lineTax.taxPaise;
      }

      await db
        .update(ordersTable)
        .set({
          itemsSubtotalPaise: orderTotalPaise,
          taxableAmountPaise: orderTaxableAmountPaise,
          taxPaise: orderTaxPaise,
          grandTotalPaise: orderTotalPaise,
        })
        .where(eq(ordersTable.id, orderId));
    }
  }

  console.log("Seeding completed!");
  process.exit(0);
})();
