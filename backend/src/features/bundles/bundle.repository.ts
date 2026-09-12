import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  bundleComponentsTable,
  productsTable,
  storeProductsTable,
} from "../../db/schema";
import type { DatabaseType, TransactionType } from "../../utils/types";
import type { BundleDefinition } from "./bundle.types";

type Executor = DatabaseType | TransactionType;

export const loadBundleDefinitions = async (
  bundleProductIds: number[],
  storeId?: number,
  executor: Executor = db
) => {
  const ids = [...new Set(bundleProductIds)].sort((a, b) => a - b);
  if (ids.length === 0) return new Map<number, BundleDefinition>();

  const baseQuery = executor
    .select({
      bundleProductId: bundleComponentsTable.bundleProductId,
      componentProductId: bundleComponentsTable.componentProductId,
      quantityPerBundle: bundleComponentsTable.quantity,
      componentName: productsTable.name,
      componentProductIsAvailable: productsTable.isAvailable,
      componentStoreProductId: storeProductsTable.id,
      componentStoreIsAvailable: storeProductsTable.isAvailable,
    })
    .from(bundleComponentsTable)
    .innerJoin(
      productsTable,
      eq(productsTable.id, bundleComponentsTable.componentProductId)
    );

  const rows = storeId === undefined
    ? await baseQuery
        .leftJoin(
          storeProductsTable,
          and(eq(storeProductsTable.productId, productsTable.id), sql`false`)
        )
        .where(inArray(bundleComponentsTable.bundleProductId, ids))
    : await baseQuery
        .leftJoin(
          storeProductsTable,
          and(
            eq(storeProductsTable.productId, productsTable.id),
            eq(storeProductsTable.storeId, storeId)
          )
        )
        .where(inArray(bundleComponentsTable.bundleProductId, ids));

  const definitions = new Map<number, BundleDefinition>();
  for (const row of rows) {
    const definition = definitions.get(row.bundleProductId) ?? {
      bundleProductId: row.bundleProductId,
      bundleName: `Bundle #${row.bundleProductId}`,
      components: [],
    };
    if (!definition.components.some((item) => item.productId === row.componentProductId)) {
      definition.components.push({
        productId: row.componentProductId,
        name: row.componentName,
        quantityPerBundle: row.quantityPerBundle,
        isAvailable:
          row.componentProductIsAvailable &&
          (storeId === undefined ||
            (row.componentStoreProductId !== null && row.componentStoreIsAvailable === true)),
      });
    }
    definitions.set(row.bundleProductId, definition);
  }
  for (const definition of definitions.values()) {
    definition.components.sort((a, b) => a.productId - b.productId);
  }
  return definitions;
};
