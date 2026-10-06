import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "../../db";
import {
  bundleComponentsTable,
  productsTable,
  storeProductsTable,
  storesTable,
} from "../../db/schema";
import { AppError } from "../../utils/error";
import type { TransactionType } from "../../utils/types";
import { BUNDLE_ERROR_CODES } from "./bundle.constants";
import { buildBundleProductDto, validateBundleDefinition } from "./bundle.logic";
import { loadBundleDefinitions } from "./bundle.repository";
import type { BundleDefinitionWrite } from "./bundle.schemas";

export class BundleService {
  async decorateCatalogProducts<T extends {
    id: number;
    name: string;
    description: string | null;
    image: string;
    productType: "single" | "bundle";
    isAvailable: boolean;
    pricePaise: number;
    compareAtPricePaise?: number | null;
  }>(products: T[], storeId: number) {
    const bundleIds = products.filter((product) => product.productType === "bundle").map((product) => product.id);
    if (bundleIds.length === 0) return products;
    const definitions = await loadBundleDefinitions(bundleIds, storeId);
    return products.map((product) => {
      if (product.productType !== "bundle") return product;
      const definition = definitions.get(product.id);
      const compareAtPricePaise = product.compareAtPricePaise;
      if (!definition || compareAtPricePaise === null || compareAtPricePaise === undefined) {
        return { ...product, isAvailable: false, unavailableComponentIds: [], components: [] };
      }
      const dto = buildBundleProductDto({
        productId: product.id,
        name: product.name,
        description: product.description,
        imageUrl: product.image,
        storeId,
        sellingPricePaise: product.pricePaise,
        compareAtPricePaise,
        bundleIsAvailable: product.isAvailable,
        components: definition.components,
      });
      return {
        ...product,
        sellingPricePaise: dto.sellingPricePaise,
        compareAtPricePaise: dto.compareAtPricePaise,
        markdownPaise: dto.markdownPaise,
        isAvailable: dto.isAvailable,
        unavailableComponentIds: dto.unavailableComponentIds,
        components: dto.components,
      };
    });
  }

  async decorateCart<T extends {
    storeId: number | null;
    items: Array<{
      productId: number;
      quantity: number;
      pricePaise: number;
      product: { name: string; productType: "single" | "bundle" };
    }>;
  }>(cart: T, tx?: TransactionType) {
    const bundleIds = cart.items
      .filter((item) => item.product.productType === "bundle")
      .map((item) => item.productId);
    if (bundleIds.length === 0 || cart.storeId === null) return cart;
    const executor = tx ?? db;
    const definitions = await loadBundleDefinitions(bundleIds, cart.storeId, executor);
    const prices = await executor
      .select({
        productId: storeProductsTable.productId,
        compareAtPricePaise: storeProductsTable.compareAtPricePaise,
      })
      .from(storeProductsTable)
      .where(and(eq(storeProductsTable.storeId, cart.storeId), inArray(storeProductsTable.productId, bundleIds)));
    const pricesByProduct = new Map(prices.map((price) => [price.productId, price.compareAtPricePaise] as const));
    return {
      ...cart,
      items: cart.items.map((item) => {
        if (item.product.productType !== "bundle") return item;
        const definition = definitions.get(item.productId);
        const compareAtUnitPricePaise = pricesByProduct.get(item.productId);
        if (!definition || compareAtUnitPricePaise === null || compareAtUnitPricePaise === undefined) {
          throw new AppError("Bundle definition or pricing is invalid", 409, BUNDLE_ERROR_CODES.INVALID_DEFINITION);
        }
        return {
          ...item,
          productType: "bundle" as const,
          compareAtUnitPricePaise,
          bundleMarkdownPaise: buildBundleProductDto({
            productId: item.productId,
            name: item.product.name,
            description: null,
            imageUrl: "",
            storeId: cart.storeId!,
            sellingPricePaise: item.pricePaise,
            compareAtPricePaise: compareAtUnitPricePaise,
            bundleIsAvailable: true,
            components: definition.components,
          }).markdownPaise * item.quantity,
          bundleComponents: definition.components.map((component) => ({
            ...component,
            totalQuantity: component.quantityPerBundle * item.quantity,
          })),
        };
      }),
    };
  }

  async createDefinition(bundleProductId: number, input: BundleDefinitionWrite) {
    const existing = await db.query.bundleComponentsTable.findFirst({
      where: eq(bundleComponentsTable.bundleProductId, bundleProductId),
      columns: { id: true },
    });
    if (existing) {
      throw new AppError("Bundle definition already exists", 409, BUNDLE_ERROR_CODES.INVALID_DEFINITION);
    }
    return this.replaceDefinition(bundleProductId, input);
  }

  async replaceDefinition(bundleProductId: number, input: BundleDefinitionWrite) {
    return db.transaction(async (tx) => {
      const storeIds = input.storePrices.map((price) => price.storeId);
      const stores = await tx
        .select({ id: storesTable.id })
        .from(storesTable)
        .where(inArray(storesTable.id, storeIds))
        .orderBy(asc(storesTable.id))
        .for("update");
      if (stores.length !== storeIds.length) {
        throw new AppError("One or more stores do not exist", 404, "STORE_NOT_FOUND");
      }

      const productIds = [bundleProductId, ...input.components.map((item) => item.productId)];
      const products = await tx
        .select({ id: productsTable.id, productType: productsTable.productType })
        .from(productsTable)
        .where(inArray(productsTable.id, productIds))
        .orderBy(asc(productsTable.id))
        .for("update");
      const productsById = new Map(products.map((product) => [product.id, product] as const));
      const bundle = productsById.get(bundleProductId);
      if (!bundle || productsById.size !== new Set(productIds).size) {
        throw new AppError("Bundle or component product not found", 404, BUNDLE_ERROR_CODES.NOT_FOUND);
      }
      validateBundleDefinition({
        bundleProductId,
        bundleProductType: bundle.productType,
        components: input.components.map((component) => ({
          ...component,
          productType: productsById.get(component.productId)!.productType,
        })),
      });

      await tx.delete(bundleComponentsTable).where(eq(bundleComponentsTable.bundleProductId, bundleProductId));
      await tx.insert(bundleComponentsTable).values(
        input.components.map((component) => ({
          bundleProductId,
          componentProductId: component.productId,
          quantity: component.quantityPerBundle,
        }))
      );

      for (const price of [...input.storePrices].sort((a, b) => a.storeId - b.storeId)) {
        const [mapping] = await tx
          .select({ id: storeProductsTable.id })
          .from(storeProductsTable)
          .where(and(eq(storeProductsTable.storeId, price.storeId), eq(storeProductsTable.productId, bundleProductId)))
          .for("update")
          .limit(1);
        const values = {
          pricePaise: price.sellingPricePaise,
          compareAtPricePaise: price.compareAtPricePaise,
          isAvailable: price.isAvailable,
          onHandQuantity: null,
          updatedAt: new Date(),
        };
        if (mapping) {
          await tx.update(storeProductsTable).set(values).where(eq(storeProductsTable.id, mapping.id));
        } else {
          await tx.insert(storeProductsTable).values({
            storeId: price.storeId,
            productId: bundleProductId,
            ...values,
          });
        }
      }
      return this.getAdminDefinition(bundleProductId, tx);
    });
  }

  async getAdminDefinition(bundleProductId: number, tx?: TransactionType) {
    const executor = tx ?? db;
    const product = await executor.query.productsTable.findFirst({
      where: eq(productsTable.id, bundleProductId),
      columns: { id: true, name: true, productType: true },
    });
    if (!product || product.productType !== "bundle") {
      throw new AppError("Bundle not found", 404, BUNDLE_ERROR_CODES.NOT_FOUND);
    }
    const definitions = await loadBundleDefinitions([bundleProductId], undefined, executor);
    const definition = definitions.get(bundleProductId);
    if (!definition) {
      throw new AppError("Bundle definition not found", 404, BUNDLE_ERROR_CODES.NOT_FOUND);
    }
    definition.bundleName = product.name;
    const storePrices = await executor
      .select({
        storeId: storeProductsTable.storeId,
        sellingPricePaise: storeProductsTable.pricePaise,
        compareAtPricePaise: storeProductsTable.compareAtPricePaise,
        isAvailable: storeProductsTable.isAvailable,
        onHandQuantity: storeProductsTable.onHandQuantity,
      })
      .from(storeProductsTable)
      .where(eq(storeProductsTable.productId, bundleProductId))
      .orderBy(asc(storeProductsTable.storeId));
    return { ...definition, storePrices };
  }

  async getPublicBundle(bundleProductId: number, storeId: number, tx?: TransactionType) {
    const executor = tx ?? db;
    const [product] = await executor
      .select({
        id: productsTable.id,
        name: productsTable.name,
        description: productsTable.description,
        image: productsTable.image,
        productType: productsTable.productType,
        productIsAvailable: productsTable.isAvailable,
        sellingPricePaise: storeProductsTable.pricePaise,
        compareAtPricePaise: storeProductsTable.compareAtPricePaise,
        storeIsAvailable: storeProductsTable.isAvailable,
        onHandQuantity: storeProductsTable.onHandQuantity,
      })
      .from(productsTable)
      .innerJoin(
        storeProductsTable,
        and(eq(storeProductsTable.productId, productsTable.id), eq(storeProductsTable.storeId, storeId))
      )
      .where(eq(productsTable.id, bundleProductId))
      .limit(1);
    if (!product || product.productType !== "bundle") {
      throw new AppError("Bundle not found", 404, BUNDLE_ERROR_CODES.NOT_FOUND);
    }
    if (product.compareAtPricePaise === null || product.onHandQuantity !== null) {
      throw new AppError("Bundle pricing or inventory configuration is invalid", 409, BUNDLE_ERROR_CODES.INVALID_DEFINITION);
    }
    const definitions = await loadBundleDefinitions([bundleProductId], storeId, executor);
    const definition = definitions.get(bundleProductId);
    if (!definition) {
      throw new AppError("Bundle definition not found", 404, BUNDLE_ERROR_CODES.NOT_FOUND);
    }
    return buildBundleProductDto({
      productId: product.id,
      name: product.name,
      description: product.description,
      imageUrl: product.image,
      storeId,
      sellingPricePaise: product.sellingPricePaise,
      compareAtPricePaise: product.compareAtPricePaise,
      bundleIsAvailable: product.productIsAvailable && product.storeIsAvailable,
      components: definition.components,
    });
  }
}

export default new BundleService();
