import { and, asc, desc, eq, getTableColumns, gt, sql, SQL } from "drizzle-orm";
import { db } from "../../db";
import {
  inventoryReservationsTable,
  menuItemsMappingTable,
  menuItemsTable,
  productCustomizationGroupMappingTable,
  productsTable,
  storeProductsTable,
} from "../../db/schema";
import { AppError } from "../../utils/error";
import {
  deriveStockStatus,
  getAvailableQuantity,
} from "../inventory/inventory.logic";

class ProductService {
  async createProduct(product: typeof productsTable.$inferInsert) {
    const existingProduct = await this.getProductBySlug(product.slug);

    if (existingProduct) {
      throw new AppError(
        `Product with slug ${product.slug} already exists`,
        409
      );
    }

    return await db.insert(productsTable).values(product).returning();
  }

  async getProductBySlug(slug: string) {
    return await db.query.productsTable.findFirst({
      where: eq(productsTable.slug, slug),
    });
  }

  async getProductById(id: number) {
    return await db.query.productsTable.findFirst({
      where: eq(productsTable.id, id),
    });
  }

  async getProductsByMenuSlug({
    menuSlug,
    limit = 10,
    offset = 0,
    sortBy = "default",
    storeId,
  }: {
    menuSlug: string;
    limit?: number;
    offset?: number;
    sortBy?: string;
    storeId?: number;
  }) {
    let order: SQL<unknown>;

    switch (sortBy) {
      case "default":
        order = desc(productsTable.createdAt);
        break;

      case "price_low":
        order = asc(
          storeId !== undefined ? storeProductsTable.price : productsTable.price
        );
        break;

      case "price_high":
        order = desc(
          storeId !== undefined ? storeProductsTable.price : productsTable.price
        );
        break;

      default:
        order = desc(productsTable.createdAt);
        break;
    }

    if (storeId !== undefined) {
      const now = new Date();
      const activeReservationsSubquery = db
        .select({
          storeProductId: inventoryReservationsTable.storeProductId,
          reservedQuantity:
            sql<number>`COALESCE(SUM(${inventoryReservationsTable.quantity}), 0)`
              .mapWith(Number)
              .as("reserved_quantity"),
        })
        .from(inventoryReservationsTable)
        .where(
          and(
            eq(inventoryReservationsTable.status, "reserved"),
            gt(inventoryReservationsTable.expiresAt, now)
          )
        )
        .groupBy(inventoryReservationsTable.storeProductId)
        .as("active_reservations");

      const rows = await db
        .select({
          ...getTableColumns(productsTable),
          price: storeProductsTable.price,
          onHandQuantity: storeProductsTable.onHandQuantity,
          lowStockThreshold: storeProductsTable.lowStockThreshold,
          reservedQuantity:
            sql<number>`COALESCE(${activeReservationsSubquery.reservedQuantity}, 0)`.mapWith(
              Number
            ),
        })
        .from(productsTable)
        .innerJoin(
          storeProductsTable,
          eq(storeProductsTable.productId, productsTable.id)
        )
        .innerJoin(
          menuItemsMappingTable,
          eq(menuItemsMappingTable.productId, productsTable.id)
        )
        .innerJoin(
          menuItemsTable,
          eq(menuItemsTable.id, menuItemsMappingTable.menuItemId)
        )
        .leftJoin(
          activeReservationsSubquery,
          eq(storeProductsTable.id, activeReservationsSubquery.storeProductId)
        )
        .where(
          and(
            eq(menuItemsTable.slug, menuSlug),
            eq(storeProductsTable.storeId, storeId),
            eq(productsTable.isAvailable, true),
            eq(storeProductsTable.isAvailable, true)
          )
        )
        .offset(offset)
        .limit(limit)
        .orderBy(order);

      return rows.map((row) => {
        const isTracked = row.onHandQuantity !== null;
        const availableQuantity = isTracked
          ? getAvailableQuantity(row.onHandQuantity, row.reservedQuantity)
          : null;
        const stockStatus = deriveStockStatus(
          row.onHandQuantity,
          availableQuantity,
          row.lowStockThreshold
        );
        const stockCount =
          stockStatus === "low_stock" ? availableQuantity : null;

        const {
          onHandQuantity,
          lowStockThreshold,
          reservedQuantity,
          ...productData
        } = row;
        return {
          ...productData,
          stockStatus,
          stockCount,
        };
      });
    }

    const rows = await db
      .select({
        ...getTableColumns(productsTable),
      })
      .from(productsTable)
      .innerJoin(
        menuItemsMappingTable,
        eq(menuItemsMappingTable.productId, productsTable.id)
      )
      .innerJoin(
        menuItemsTable,
        eq(menuItemsTable.id, menuItemsMappingTable.menuItemId)
      )
      .where(eq(menuItemsTable.slug, menuSlug))
      .offset(offset)
      .limit(limit)
      .orderBy(order);

    return rows.map((p) => ({
      ...p,
      stockStatus: "untracked" as const,
      stockCount: null,
    }));
  }

  async getProducts({
    limit = 10,
    offset = 0,
    sortBy = "default",
    storeId,
  }: {
    limit?: number;
    offset?: number;
    sortBy?: string;
    storeId?: number;
  }) {
    let order: SQL<unknown>;

    switch (sortBy) {
      case "default":
        order = desc(productsTable.createdAt);
        break;

      case "price_low":
        order = asc(
          storeId !== undefined ? storeProductsTable.price : productsTable.price
        );
        break;

      case "price_high":
        order = desc(
          storeId !== undefined ? storeProductsTable.price : productsTable.price
        );
        break;

      default:
        order = desc(productsTable.createdAt);
        break;
    }

    if (storeId !== undefined) {
      const now = new Date();
      const activeReservationsSubquery = db
        .select({
          storeProductId: inventoryReservationsTable.storeProductId,
          reservedQuantity:
            sql<number>`COALESCE(SUM(${inventoryReservationsTable.quantity}), 0)`
              .mapWith(Number)
              .as("reserved_quantity"),
        })
        .from(inventoryReservationsTable)
        .where(
          and(
            eq(inventoryReservationsTable.status, "reserved"),
            gt(inventoryReservationsTable.expiresAt, now)
          )
        )
        .groupBy(inventoryReservationsTable.storeProductId)
        .as("active_reservations");

      const rows = await db
        .select({
          ...getTableColumns(productsTable),
          price: storeProductsTable.price,
          onHandQuantity: storeProductsTable.onHandQuantity,
          lowStockThreshold: storeProductsTable.lowStockThreshold,
          reservedQuantity:
            sql<number>`COALESCE(${activeReservationsSubquery.reservedQuantity}, 0)`.mapWith(
              Number
            ),
        })
        .from(productsTable)
        .innerJoin(
          storeProductsTable,
          eq(storeProductsTable.productId, productsTable.id)
        )
        .leftJoin(
          activeReservationsSubquery,
          eq(storeProductsTable.id, activeReservationsSubquery.storeProductId)
        )
        .where(
          and(
            eq(storeProductsTable.storeId, storeId),
            eq(productsTable.isAvailable, true),
            eq(storeProductsTable.isAvailable, true)
          )
        )
        .offset(offset)
        .limit(limit)
        .orderBy(order);

      return rows.map((row) => {
        const isTracked = row.onHandQuantity !== null;
        const availableQuantity = isTracked
          ? getAvailableQuantity(row.onHandQuantity, row.reservedQuantity)
          : null;
        const stockStatus = deriveStockStatus(
          row.onHandQuantity,
          availableQuantity,
          row.lowStockThreshold
        );
        const stockCount =
          stockStatus === "low_stock" ? availableQuantity : null;

        const {
          onHandQuantity,
          lowStockThreshold,
          reservedQuantity,
          ...productData
        } = row;
        return {
          ...productData,
          stockStatus,
          stockCount,
        };
      });
    }

    const rows = await db.query.productsTable.findMany({
      offset,
      limit,
      orderBy: order,
    });

    return rows.map((p) => ({
      ...p,
      stockStatus: "untracked" as const,
      stockCount: null,
    }));
  }

  async getProductsA() {
    return await db.query.productsTable.findMany({
      orderBy: desc(productsTable.createdAt),
      with: {
        category: {
          columns: {
            name: true,
          },
        },
      },
    });
  }

  async getProductsByCategory(categoryId: number) {
    return await db.query.productsTable.findMany({
      where: eq(productsTable.categoryId, categoryId),
    });
  }

  async getProductsByGroupId(groupId: number) {
    return await db.query.productCustomizationGroupMappingTable.findMany({
      where: eq(productCustomizationGroupMappingTable.groupId, groupId),
      with: {
        product: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async getNoCustomizeProducts() {
    return await db.query.productsTable.findMany({
      where: eq(productsTable.hasCustomization, false),
    });
  }
}

export default new ProductService();
